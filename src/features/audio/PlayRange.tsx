import { formatRange } from '@/domain/time'
import { rangeKey, rangePlayer, useRangePlayback } from './rangePlayer'
import styles from './PlayRange.module.css'

interface Props { docId: string; start: number; end: number; className?: string }

/** ▶ / ■ that plays one range of the original inline, without leaving the conversation (a sibling of the row's own button). */
export function PlayRange({ docId, start, end, className }: Props) {
  const key = rangeKey(docId, start, end)
  const { playing } = useRangePlayback(key)
  const label = formatRange(start, end)
  return (
    <button
      type="button" className={`${styles.btn} ${className ?? ''}`} data-playing={playing}
      aria-label={playing ? `Detener ${label}` : `Escuchar ${label}`} aria-pressed={playing}
      onClick={() => rangePlayer.toggle(key, docId, start, end)}
    >
      <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
        {playing ? <path d="M6 6h12v12H6z" /> : <path d="M8 5.2v13.6a.6.6 0 0 0 .9.5l11-6.8a.6.6 0 0 0 0-1L8.9 4.7a.6.6 0 0 0-.9.5z" />}
      </svg>
    </button>
  )
}
