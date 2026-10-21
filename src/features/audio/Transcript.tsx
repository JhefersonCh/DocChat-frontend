import { memo, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import type { TimedSegment } from '@/domain/audio'
import { formatTime } from '@/domain/time'
import { Thumb } from '@/ui/Thumb'
import styles from './Transcript.module.css'

interface Props {
  segments: readonly TimedSegment[]
  /** Segment being heard (-1 = none). */
  current: number
  /** Second lit row (video: the frame on screen while `current` is the window being heard). */
  currentAlt?: number
  /** Segment the active citation points at (-1 = none). */
  cited: number
  /** Citation number of `cited`, for its tag. */
  citedN: number | null
  /** Bumps on a new citation: turns auto-follow back on. */
  seq: number
  onSeek: (segment: TimedSegment) => void
}

/** Transcript as a list of timed windows: the heard one is lit and kept in view; a click seeks there. */
export const Transcript = memo(function Transcript({ segments, current, currentAlt = -1, cited, citedN, seq, onSeek }: Props) {
  const scroller = useRef<HTMLOListElement>(null)
  const [follow, setFollow] = useState(true)
  const calm = useReducedMotion()
  const [seen, setSeen] = useState(seq)
  if (seen !== seq) { setSeen(seq); setFollow(true) }

  useEffect(() => {
    const sc = scroller.current
    const at = current >= 0 ? current : currentAlt
    const row = at >= 0 ? sc?.children[at] as HTMLElement | undefined : undefined
    if (!follow || !sc || !row) return
    const top = row.offsetTop - sc.clientHeight * 0.3
    sc.scrollTo({ top: Math.max(0, top), behavior: calm ? 'auto' : 'smooth' })
  }, [current, currentAlt, follow, calm])

  if (segments.length === 0) return <p className={styles.empty} role="status">Sin transcripción todavía.</p>
  return (
    <div className={styles.wrap}>
      <ol
        ref={scroller} className={styles.list} aria-label="Transcripción"
        // Programmatic scrolls fire neither of these: only the user's hands pause the follow.
        onWheel={() => setFollow(false)} onTouchMove={() => setFollow(false)}
      >
        {segments.map((s, i) => (
          <li key={s.key} data-current={i === current || i === currentAlt} data-cited={i === cited} data-frame={s.frame || undefined}>
            <button type="button" className={styles.row} aria-current={i === current || i === currentAlt ? 'true' : undefined} onClick={() => { setFollow(true); onSeek(s) }}>
              <span className={styles.time}>{formatTime(s.start)}</span>
              {s.frame && (s.thumb ? <Thumb chunkId={s.thumb} alt={`Fotograma ${formatTime(s.start)}`} width="100%" ratio="16 / 9" className={styles.thumb} /> : <span className={styles.thumb} aria-hidden="true" />)}
              <span className={styles.text}>{s.text || <i>{s.frame ? '(sin descripción)' : '(sin texto)'}</i>}</span>
              {i === cited && <span className={styles.tag}>{citedN ? `cita [${citedN}]` : 'cita'}</span>}
            </button>
          </li>
        ))}
      </ol>
      {!follow && <button type="button" className={styles.resume} onClick={() => setFollow(true)}>Seguir la reproducción</button>}
    </div>
  )
})
