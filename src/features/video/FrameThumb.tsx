import { formatTime } from '@/domain/time'
import { rangeKey, useRangePlayback } from '@/features/audio/rangePlayer'
import { Thumb } from '@/ui/Thumb'
import styles from './FrameThumb.module.css'

interface Props {
  chunkId: string
  docId: string
  start: number
  end?: number | null
  alt: string
  className?: string
}

/**
 * The frame a citation points at (16:9 well) with its timestamp badge. While the range previews (the ▶ next to it
 * plays that stretch of the video's audio inline) an amber line sweeps the frame: no second video element, no layout shift.
 */
export function FrameThumb({ chunkId, docId, start, end, alt, className }: Props) {
  const { progress } = useRangePlayback(rangeKey(docId, start, end ?? start))
  return (
    <span className={`${styles.wrap} ${className ?? ''}`}>
      <Thumb chunkId={chunkId} alt={alt} width="100%" ratio="16 / 9" />
      <b className={styles.badge}>{formatTime(start)}</b>
      {progress > 0 && <span className={styles.sweep} aria-hidden="true" style={{ transform: `scaleX(${progress})` }} />}
    </span>
  )
}
