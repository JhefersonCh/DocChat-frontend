import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { joinFocus, takeFocus } from '@/domain/audioFocus'
import { nudge } from '@/domain/time'

/** Current time outside React state: the playhead repaints every frame, the rest of the viewer must not. */
export class TimeStore {
  private t = 0
  private subs = new Set<() => void>()
  subscribe = (cb: () => void) => { this.subs.add(cb); return () => { this.subs.delete(cb) } }
  get = () => this.t
  set(t: number) { if (t !== this.t) { this.t = t; this.subs.forEach((f) => f()) } }
}

/** Re-renders only when `select(time)` changes (e.g. the current segment index, not every frame). */
export const useTimeSelector = <T,>(store: TimeStore, select: (t: number) => T): T =>
  useSyncExternalStore(store.subscribe, () => select(store.get()), () => select(0))

export interface RangePlay { start: number; end: number; loop: boolean }

export interface AudioPlayer {
  /** Callback ref for the `<audio>` / `<video>`: wires the media events (kept out of render on purpose). */
  attach: (el: HTMLMediaElement | null) => void
  store: TimeStore
  playing: boolean
  /** Duration the element reports (null while unknown / Infinity). */
  duration: number | null
  rate: number
  failed: boolean
  /** A citation range is armed: playback stops (or loops) at its end. */
  range: RangePlay | null
  play: () => void
  pause: () => void
  toggle: () => void
  /** User seek: leaves any armed range. */
  seek: (t: number) => void
  skip: (delta: number) => void
  setRate: (r: number) => void
  /** Seek to `start` and play; stops (or loops) at `end`. `play: false` only seeks and arms the range. */
  playRange: (start: number, end: number, opts?: { loop?: boolean; play?: boolean }) => void
  setLoop: (loop: boolean) => void
  clearRange: () => void
}

const STOP_EPS = 0.04

/** One `<audio>` or `<video>` element driven imperatively: state for what the UI shows, a TimeStore for the clock. */
export function useAudioPlayer(): AudioPlayer {
  const audioRef = useRef<HTMLMediaElement | null>(null)
  const [store] = useState(() => new TimeStore())
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState<number | null>(null)
  const [rate, setRateState] = useState(1)
  const [failed, setFailed] = useState(false)
  const [range, setRange] = useState<RangePlay | null>(null)
  const armed = useRef<RangePlay | null>(null)

  const arm = useCallback((r: RangePlay | null) => { armed.current = r; setRange(r) }, [])
  const jump = useCallback((t: number) => {
    const a = audioRef.current
    if (a) a.currentTime = t
    store.set(t)
  }, [store])

  const tick = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    const r = armed.current
    if (r && a.currentTime >= r.end - STOP_EPS) {
      if (r.loop) { jump(r.start); return }
      a.pause()
      jump(r.end)
      arm(null)
      return
    }
    store.set(a.currentTime)
  }, [store, jump, arm])

  const pause = useCallback(() => { audioRef.current?.pause() }, [])
  const play = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    takeFocus('viewer') // silence the voice / previews before the first sound, not after the `play` event
    void a.play().catch(() => { /* autoplay policy or a decode error: the UI just stays paused */ })
  }, [])

  useEffect(() => joinFocus('viewer', pause), [pause])
  useEffect(() => {
    if (!playing) return
    let raf = 0
    const loop = () => { tick(); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [playing, tick])

  const attach = useCallback((el: HTMLMediaElement | null) => {
    audioRef.current = el
    if (!el) return
    const readDuration = () => setDuration(Number.isFinite(el.duration) && el.duration > 0 ? el.duration : null)
    el.addEventListener('play', () => { setPlaying(true); takeFocus('viewer') })
    el.addEventListener('pause', () => { setPlaying(false); tick() })
    el.addEventListener('ended', () => { setPlaying(false); arm(null) })
    el.addEventListener('seeked', tick)
    el.addEventListener('timeupdate', tick)
    el.addEventListener('loadedmetadata', () => { readDuration(); setFailed(false) })
    el.addEventListener('durationchange', readDuration)
    el.addEventListener('error', () => setFailed(true))
    // The element lives as long as the viewer: no teardown needed (listeners die with it).
  }, [tick, arm])

  return {
    attach, store, playing, duration, rate, failed, range,
    play, pause,
    toggle: () => { if (audioRef.current?.paused === false) pause(); else play() },
    seek: (t) => { arm(null); jump(t) },
    skip: (d) => { arm(null); jump(nudge(audioRef.current?.currentTime ?? store.get(), d, duration)) },
    setRate: (r) => { setRateState(r); if (audioRef.current) audioRef.current.playbackRate = r },
    playRange: (start, end, opts) => { arm({ start, end, loop: opts?.loop ?? false }); jump(start); if (opts?.play !== false) play() },
    setLoop: (loop) => { if (armed.current) arm({ ...armed.current, loop }) },
    clearRange: () => arm(null),
  }
}
