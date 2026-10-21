import type { SpeechQueueDeps } from '@/domain/speechQueue'

type Hooks = Parameters<SpeechQueueDeps<AudioBuffer>['player']['schedule']>[1]

/** Gapless Web Audio output: every buffer starts exactly where the previous one ends. */
export class AudioScheduler {
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private nextStart = 0
  private sources = new Set<AudioBufferSourceNode>()
  private timers = new Set<ReturnType<typeof setTimeout>>()
  private samples: Uint8Array<ArrayBuffer> | null = null

  /** Must run inside a user gesture the first time (autoplay policy). */
  async unlock(): Promise<AudioContext> {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.analyser = this.ctx.createAnalyser()
      this.analyser.fftSize = 512
      this.analyser.connect(this.ctx.destination)
      this.samples = new Uint8Array(this.analyser.fftSize)
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    return this.ctx
  }

  decode(bytes: ArrayBuffer): Promise<AudioBuffer> {
    if (!this.ctx) return Promise.reject(new Error('audio not unlocked'))
    return this.ctx.decodeAudioData(bytes)
  }

  schedule = (buffer: AudioBuffer, hooks: Hooks) => {
    const ctx = this.ctx
    if (!ctx || !this.analyser) return
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(this.analyser)
    const startAt = Math.max(ctx.currentTime + 0.03, this.nextStart)
    this.nextStart = startAt + buffer.duration
    this.sources.add(source)
    const timer = setTimeout(() => { this.timers.delete(timer); hooks.onStart() }, Math.max(0, (startAt - ctx.currentTime) * 1000))
    this.timers.add(timer)
    source.onended = () => { this.sources.delete(source); hooks.onEnd() }
    source.start(startAt)
  }

  stop = () => {
    for (const t of this.timers) clearTimeout(t)
    this.timers.clear()
    for (const s of this.sources) { s.onended = null; try { s.stop() } catch { /* not started */ } s.disconnect() }
    this.sources.clear()
    this.nextStart = 0
  }

  /** 0..1 loudness of what is playing now (for the orb). */
  level = (): number => {
    if (!this.analyser || !this.samples || this.sources.size === 0) return 0
    this.analyser.getByteTimeDomainData(this.samples)
    let sum = 0
    for (const v of this.samples) { const d = (v - 128) / 128; sum += d * d }
    return Math.min(1, Math.sqrt(sum / this.samples.length) * 3)
  }
}
