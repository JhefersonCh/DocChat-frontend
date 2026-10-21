import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { KIND_ICON, KIND_LABEL, kindOf, sourceStatus } from '@/domain/sources'
import type { Source } from '@/domain/types'
import { formatTime } from '@/domain/time'
import { isFlagged, type SourceCompat } from '@/domain/compat'
import { CompatMark } from '@/features/sources/compat'
import { spring } from '@/ui/motion'
import styles from './SourceCard.module.css'

interface Props { source: Source; onRemove: () => void; removing: boolean; compat?: SourceCompat }

function detail(s: Source): string {
  const bits: string[] = [KIND_LABEL[kindOf(s)]]
  if (s.page_count) bits.push(`${s.page_count} pág.`)
  if (s.duration_s) bits.push(formatTime(s.duration_s))
  return bits.join(' · ')
}

/** One source of the project: kind glyph, alias (S1..Sn, as every chat of the project sees it), state, remove (confirmed). */
export function SourceCard({ source, onRemove, removing, compat }: Props) {
  const [confirming, setConfirming] = useState(false)
  const calm = useReducedMotion()
  const status = sourceStatus(source)
  const busy = source.status === 'pending' || source.status === 'processing'
  return (
    <motion.li
      layout="position" className={styles.card} data-failed={source.status === 'failed'} data-busy={busy}
      initial={{ opacity: 0, scale: calm ? 1 : 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: calm ? 1 : 0.96 }}
      transition={calm ? { duration: 0.12 } : spring}
    >
      <span className={styles.glyph} aria-hidden="true">{KIND_ICON[kindOf(source)]}</span>
      <span className={styles.body}>
        <span className={styles.name} title={source.filename}>{source.filename}</span>
        <span className={styles.meta}>
          <span className={styles.alias}>{source.alias}</span>
          {detail(source)}
          {isFlagged(compat) && <CompatMark compat={compat} />}
        </span>
        {status && <span className={styles.status} data-failed={source.status === 'failed'}>{status}</span>}
        {source.status === 'failed' && source.error && <span className={styles.error}>{source.error}</span>}
      </span>
      {confirming ? (
        <span className={styles.confirm} role="group" aria-label={`Quitar ${source.filename}`}>
          <button type="button" className={styles.yes} disabled={removing} onClick={() => { onRemove(); setConfirming(false) }}>Quitar</button>
          <button type="button" className={styles.no} onClick={() => setConfirming(false)} autoFocus>No</button>
        </span>
      ) : (
        <button type="button" className={styles.x} aria-label={`Quitar ${source.filename}`} onClick={() => setConfirming(true)}>×</button>
      )}
    </motion.li>
  )
}
