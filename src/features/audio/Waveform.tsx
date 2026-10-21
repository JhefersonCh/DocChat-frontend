import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { barsPath, downsamplePeaks, type TimedSegment } from '@/domain/audio'
import { formatTime, rangeBand, timeFrac, xToTime } from '@/domain/time'
import { BBoxOverlay } from '@/features/viewer/BBoxOverlay'
import { useTimeSelector, type TimeStore } from './useAudioPlayer'
import styles from './Waveform.module.css'

const BAR_PX = 4 // pitch of one bar
const MAX_BANDS = 400 // beyond this the segment bands are noise, not information
const KEY_STEP = 5

interface Props {
  peaks: readonly number[]
  /** True while the peaks are the flat fallback (no waveform endpoint / still computing). */
  flat: boolean
  duration: number | null
  store: TimeStore
  segments: readonly TimedSegment[]
  current: number
  /** The cited range: amber box that draws itself in; `seq` replays it. */
  cite: { start: number; end: number | null } | null
  seq: number
  label: string
  /** Shorter lane (video: it shares the deck with the picture and the filmstrip). */
  compact?: boolean
  onSeek: (t: number) => void
}

/**
 * The waveform: bars in SVG (one path for the track, the same path clipped for the played part in amber),
 * segment bands behind, the cited range as an amber box on top, a hairline playhead. Pointer down/drag scrubs;
 * hover shows the time under the cursor. Pure-geometry props: it never touches the audio element.
 */
export function Waveform({ peaks, flat, duration, store, segments, current, cite, seq, label, compact, onSeek }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<number | null>(null)
  const scrubbing = useRef(false)
  const clip = useId()
  const time = useTimeSelector(store, (t) => t)
  const frac = timeFrac(time, duration)

  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const read = () => setWidth(el.clientWidth)
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const bars = Math.min(500, Math.max(48, Math.floor(width / BAR_PX)))
  const path = useMemo(() => barsPath(downsamplePeaks(peaks, bars), flat), [peaks, bars, flat])

  const band = cite ? rangeBand(cite.start, cite.end, duration, 8 / Math.max(width, 1)) : null
  const at = (e: { clientX: number }) => {
    const r = root.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, w: r.width }
  }
  const onDown = (e: ReactPointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    scrubbing.current = true
    const { x, w } = at(e)
    onSeek(xToTime(x, w, duration))
  }
  const onMove = (e: ReactPointerEvent) => {
    const { x, w } = at(e)
    setHover(Math.min(Math.max(x, 0), w))
    if (scrubbing.current) onSeek(xToTime(x, w, duration))
  }
  const onKey = (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' ? KEY_STEP : e.key === 'ArrowLeft' ? -KEY_STEP : e.key === 'Home' ? -Infinity : e.key === 'End' ? Infinity : 0
    if (!d) return
    e.preventDefault()
    e.stopPropagation()
    onSeek(Math.min(duration ?? Infinity, Math.max(0, d === Infinity ? duration ?? 0 : time + d)))
  }

  return (
    <div
      ref={root} className={styles.root} data-waveform data-duration={duration ?? ''} data-flat={flat} data-compact={compact || undefined}
      role="slider" tabIndex={0} aria-label={label} aria-valuemin={0} aria-valuemax={Math.round(duration ?? 0)}
      aria-valuenow={Math.round(time)} aria-valuetext={`${formatTime(time)} de ${formatTime(duration)}`}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => { scrubbing.current = false }}
      onPointerCancel={() => { scrubbing.current = false }} onPointerLeave={() => setHover(null)} onKeyDown={onKey}
    >
      {duration != null && segments.length > 0 && segments.length <= MAX_BANDS && (
        <div className={styles.bands} aria-hidden="true">
          {segments.map((s, i) => {
            const b = rangeBand(s.start, s.end, duration)
            return b && <span key={s.key} className={styles.seg} data-odd={i % 2} data-current={i === current} style={{ left: `${b.x * 100}%`, width: `${b.w * 100}%` }} />
          })}
        </div>
      )}
      <svg className={styles.svg} viewBox={`0 0 ${bars} 100`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <defs><clipPath id={clip} clipPathUnits="userSpaceOnUse"><rect x={0} y={0} width={frac * bars} height={100} /></clipPath></defs>
        <path d={path} className={styles.track} />
        <path d={path} className={styles.played} clipPath={`url(#${clip})`} />
      </svg>
      {band && <BBoxOverlay key={seq} rect={{ x: band.x, y: 0.04, w: band.w, h: 0.92 }} />}
      <span className={styles.head} aria-hidden="true" style={{ left: `${frac * 100}%` }} />
      {hover != null && duration != null && (
        <span className={styles.ghost} aria-hidden="true" data-flip={hover > width - 56} style={{ left: hover }}>
          <b>{formatTime(xToTime(hover, width, duration))}</b>
        </span>
      )}
    </div>
  )
}
