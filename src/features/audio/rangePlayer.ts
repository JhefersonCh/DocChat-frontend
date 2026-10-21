import { useSyncExternalStore } from 'react'
import { audioSrc } from '@/api/media'
import { joinFocus, takeFocus } from '@/domain/audioFocus'

interface State { key: string | null; progress: number }
const IDLE: State = { key: null, progress: 0 }

/**
 * Inline preview of an audio range (citation chips / notes / inspector rows): one shared element, so a second
 * preview cuts the first. Independent of the viewer's player, but they share audio focus (never two sounds).
 */
class RangePlayer {
  private el: HTMLAudioElement | null = null
  private src = ''
  private state: State = IDLE
  private subs = new Set<() => void>()
  private raf = 0

  subscribe = (cb: () => void) => { this.subs.add(cb); return () => { this.subs.delete(cb) } }
  snapshot = () => this.state
  private set(s: State) { this.state = s; this.subs.forEach((f) => f()) }

  toggle(key: string, docId: string, start: number, end: number) {
    if (this.state.key === key) { this.stop(); return }
    takeFocus('preview')
    const url = audioSrc(docId)
    if (!this.el) this.el = new Audio()
    const el = this.el
    if (this.src !== url) { this.src = url; el.src = url }
    el.pause()
    const go = () => { el.currentTime = start; this.set({ key, progress: 0 }); void Promise.resolve(el.play()).catch(() => this.stop()); this.loop(start, end) }
    if (el.readyState >= 1) go()
    else { el.addEventListener('loadedmetadata', go, { once: true }); el.load() }
    this.set({ key, progress: 0 })
  }

  private loop(start: number, end: number) {
    cancelAnimationFrame(this.raf)
    const step = () => {
      const el = this.el
      if (!el || !this.state.key) return
      if (el.currentTime >= end - 0.04 || el.ended) { this.stop(); return }
      this.set({ key: this.state.key, progress: Math.min(1, Math.max(0, (el.currentTime - start) / (end - start))) })
      this.raf = requestAnimationFrame(step)
    }
    this.raf = requestAnimationFrame(step)
  }

  stop = () => {
    cancelAnimationFrame(this.raf)
    this.el?.pause()
    if (this.state.key) this.set(IDLE)
  }
}

export const rangePlayer = new RangePlayer()
joinFocus('preview', rangePlayer.stop)

export const rangeKey = (docId: string, start: number, end: number) => `${docId}:${start}-${end}`

/** Playing flag + 0..1 progress of one range (idle for every other key). */
export function useRangePlayback(key: string) {
  const s = useSyncExternalStore(rangePlayer.subscribe, rangePlayer.snapshot, () => IDLE)
  return s.key === key ? { playing: true, progress: s.progress } : { playing: false, progress: 0 }
}
