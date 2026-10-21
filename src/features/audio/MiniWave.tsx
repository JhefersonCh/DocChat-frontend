import { useMemo } from 'react'
import { barsPath, slicePeaks } from '@/domain/audio'
import { rangeKey, useRangePlayback } from './rangePlayer'
import { useWaveform } from './useWaveform'
import styles from './MiniWave.module.css'

interface Props { docId: string; start: number; end: number; bars?: number; className?: string }

/** The `[start, end]` slice of a recording's waveform; the played part turns amber while its preview plays. */
export function MiniWave({ docId, start, end, bars = 28, className }: Props) {
  const wave = useWaveform(docId)
  const { progress } = useRangePlayback(rangeKey(docId, start, end))
  const path = useMemo(() => barsPath(slicePeaks(wave.peaks, wave.duration ?? Math.max(end, 1), start, end, bars), wave.flat), [wave.peaks, wave.duration, wave.flat, start, end, bars])
  return (
    <svg className={`${styles.wave} ${className ?? ''}`} viewBox={`0 0 ${bars} 100`} preserveAspectRatio="none" aria-hidden="true" focusable="false" data-flat={wave.flat}>
      <path d={path} className={styles.base} />
      {progress > 0 && <path d={path} className={styles.played} style={{ clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` }} />}
    </svg>
  )
}
