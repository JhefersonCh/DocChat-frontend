import styles from './ScanBar.module.css'

const TICKS = 28

/** Indeterminate "scan" over mono chunk bars (plan §6 #2; reduced motion: static bar + "···" that advance each second). Decorative: aria-hidden. */
export function ScanBar({ className }: { className?: string }) {
  return (
    <div className={[styles.bar, className].filter(Boolean).join(' ')} aria-hidden="true">
      {Array.from({ length: TICKS }, (_, i) => (
        <span key={i} className={styles.tick} style={{ ['--i' as string]: i / TICKS }} />
      ))}
      <span className={styles.sweep} />
      <span className={styles.dots}><i /><i /><i /></span>
    </div>
  )
}
