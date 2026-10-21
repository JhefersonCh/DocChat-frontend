import { describe, expect, it } from 'vitest'
import { SpeechQueue } from './speechQueue'

/** Controllable fakes: every synth call is a promise the test resolves by hand. */
function harness(opts: { maxInFlight?: number; maxAhead?: number } = {}) {
  const calls: { text: string; resolve: (v: string) => void; reject: (e: unknown) => void; signal: AbortSignal }[] = []
  const scheduled: { audio: string; start: () => void; end: () => void }[] = []
  const log = { stopped: 0, errors: [] as string[] }
  const queue = new SpeechQueue<string>({
    ...opts,
    synth: (text, signal) => new Promise((resolve, reject) => { calls.push({ text, resolve, reject, signal }) }),
    player: {
      schedule: (audio, hooks) => { scheduled.push({ audio, start: hooks.onStart, end: hooks.onEnd }) },
      stop: () => { log.stopped++ },
    },
    onError: (_e, sentence) => { log.errors.push(sentence) },
  })
  const tick = () => new Promise((r) => setTimeout(r, 0))
  return { queue, calls, scheduled, log, tick }
}

describe('SpeechQueue', () => {
  it('synthesizes at most maxInFlight sentences at once (lookahead 2)', () => {
    const h = harness()
    for (const s of ['a', 'b', 'c', 'd']) h.queue.enqueue(s)
    expect(h.calls.map((c) => c.text)).toEqual(['a', 'b'])
  })

  it('starts the next synthesis as soon as one finishes', async () => {
    const h = harness()
    for (const s of ['a', 'b', 'c']) h.queue.enqueue(s)
    h.calls[0]!.resolve('A')
    await h.tick()
    expect(h.calls.map((c) => c.text)).toEqual(['a', 'b', 'c'])
  })

  it('schedules audio strictly in order even if a later sentence finishes first', async () => {
    const h = harness()
    h.queue.enqueue('a')
    h.queue.enqueue('b')
    h.calls[1]!.resolve('B')
    await h.tick()
    expect(h.scheduled).toHaveLength(0) // b is held back until a is ready
    h.calls[0]!.resolve('A')
    await h.tick()
    expect(h.scheduled.map((s) => s.audio)).toEqual(['A', 'B'])
  })

  it('tracks the sentence being heard and goes idle after finish() + last end', async () => {
    const h = harness()
    h.queue.enqueue('a')
    h.calls[0]!.resolve('A')
    await h.tick()
    h.scheduled[0]!.start()
    expect(h.queue.state.current).toBe('a')
    h.queue.finish()
    expect(h.queue.state.idle).toBe(false)
    h.scheduled[0]!.end()
    expect(h.queue.state).toMatchObject({ current: null, remaining: 0, idle: true })
  })

  it('bounds synthesized-ahead work so a barge-in wastes little', async () => {
    const h = harness({ maxInFlight: 2, maxAhead: 3 })
    for (const s of ['a', 'b', 'c', 'd', 'e']) h.queue.enqueue(s)
    h.calls[0]!.resolve('A')
    h.calls[1]!.resolve('B')
    await h.tick()
    expect(h.calls.map((c) => c.text)).toEqual(['a', 'b', 'c']) // 2 scheduled + 1 in flight = 3 ahead
    h.scheduled[0]!.end()
    await h.tick()
    expect(h.calls.map((c) => c.text)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('stop() aborts pending requests, silences the player and ignores late results', async () => {
    const h = harness()
    h.queue.enqueue('a')
    h.queue.enqueue('b')
    h.queue.stop()
    expect(h.calls.every((c) => c.signal.aborted)).toBe(true)
    expect(h.log.stopped).toBe(1)
    h.calls[0]!.resolve('A')
    await h.tick()
    expect(h.scheduled).toHaveLength(0)
    h.queue.enqueue('c')
    expect(h.calls).toHaveLength(2) // nothing new after stop
    expect(h.queue.state.idle).toBe(true)
  })

  it('skips a failed sentence, reports it, and keeps going', async () => {
    const h = harness()
    h.queue.enqueue('a')
    h.queue.enqueue('b')
    h.calls[0]!.reject(new Error('boom'))
    h.calls[1]!.resolve('B')
    await h.tick()
    expect(h.log.errors).toEqual(['a'])
    expect(h.scheduled.map((s) => s.audio)).toEqual(['B'])
  })

  it('ignores blank sentences and input after finish()', () => {
    const h = harness()
    h.queue.enqueue('   ')
    h.queue.finish()
    h.queue.enqueue('late')
    expect(h.calls).toHaveLength(0)
    expect(h.queue.state.idle).toBe(true)
  })
})
