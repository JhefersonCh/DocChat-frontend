// The speech pipeline as pure logic: sentences in, synthesized in order with a bounded lookahead,
// handed to a gapless player in order. The browser bits (fetch, Web Audio) are injected.

export interface SpeechQueueDeps<T> {
  /** Turn one sentence into playable audio. Must honour `signal`. */
  synth: (text: string, signal: AbortSignal) => Promise<T>
  player: {
    /** Queue `audio` right after whatever is already scheduled (gapless). */
    schedule: (audio: T, hooks: { onStart: () => void; onEnd: () => void }) => void
    /** Drop everything scheduled and silence the output now. */
    stop: () => void
  }
  /** Sentences being synthesized at once. */
  maxInFlight?: number
  /** Synthesized-but-not-yet-played sentences allowed ahead (bounds wasted work on barge-in). */
  maxAhead?: number
  onChange?: (state: SpeechQueueState) => void
  onError?: (error: unknown, sentence: string) => void
}

export interface SpeechQueueState {
  /** The sentence being heard right now. */
  current: string | null
  /** Sentences not finished playing (queued, synthesizing or playing). */
  remaining: number
  /** `finish()` was called and everything has played (or the queue was stopped). */
  idle: boolean
}

type Status = 'queued' | 'synth' | 'ready' | 'scheduled' | 'done' | 'failed'
interface Item<T> { text: string; status: Status; audio?: T; abort: AbortController }

export class SpeechQueue<T> {
  private items: Item<T>[] = []
  private finished = false
  private stopped = false
  private current: string | null = null
  private readonly maxInFlight: number
  private readonly maxAhead: number

  private readonly deps: SpeechQueueDeps<T>

  constructor(deps: SpeechQueueDeps<T>) {
    this.deps = deps
    this.maxInFlight = deps.maxInFlight ?? 2
    this.maxAhead = deps.maxAhead ?? 3
  }

  get state(): SpeechQueueState {
    const remaining = this.items.filter((i) => i.status !== 'done' && i.status !== 'failed').length
    return { current: this.current, remaining, idle: this.stopped || (this.finished && remaining === 0) }
  }

  enqueue(text: string) {
    if (this.stopped || this.finished || !text.trim()) return
    this.items.push({ text, status: 'queued', abort: new AbortController() })
    this.pump()
  }

  /** No more sentences are coming for this answer. */
  finish() {
    this.finished = true
    this.notify()
  }

  /** Barge-in / cancel: abort pending synthesis, clear the queue, silence the player. */
  stop() {
    if (this.stopped) return
    this.stopped = true
    for (const item of this.items) item.abort.abort()
    this.items = []
    this.current = null
    this.deps.player.stop()
    this.notify()
  }

  private count(status: Status) { return this.items.filter((i) => i.status === status).length }

  private pump() {
    if (this.stopped) return
    for (const item of this.items) {
      if (item.status !== 'queued') continue
      if (this.count('synth') >= this.maxInFlight) break
      if (this.count('synth') + this.count('ready') + this.count('scheduled') >= this.maxAhead) break
      this.start(item)
    }
    this.notify()
  }

  private start(item: Item<T>) {
    item.status = 'synth'
    this.deps.synth(item.text, item.abort.signal).then(
      (audio) => {
        if (this.stopped) return
        item.audio = audio
        item.status = 'ready'
        this.deliver()
        this.pump()
      },
      (error: unknown) => {
        if (this.stopped || item.abort.signal.aborted) return
        item.status = 'failed'
        this.deps.onError?.(error, item.text)
        this.deliver()
        this.pump()
      },
    )
  }

  /** Hand finished audio to the player strictly in order (a slow sentence blocks later ones). */
  private deliver() {
    for (const item of this.items) {
      if (item.status === 'done' || item.status === 'failed' || item.status === 'scheduled') continue
      if (item.status !== 'ready') break
      item.status = 'scheduled'
      this.deps.player.schedule(item.audio as T, {
        onStart: () => { if (!this.stopped) { this.current = item.text; this.notify() } },
        onEnd: () => {
          if (this.stopped) return
          item.status = 'done'
          if (this.current === item.text) this.current = null
          this.items = this.items.filter((i) => i.status !== 'done')
          this.pump()
        },
      })
    }
    this.notify()
  }

  private notify() { this.deps.onChange?.(this.state) }
}
