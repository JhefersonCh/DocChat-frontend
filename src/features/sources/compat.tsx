import { useState } from 'react'
import { bannerText, warningText, type Compatibility, type SourceCompat } from '@/domain/compat'
import styles from './compat.module.css'

/** Amber ⚠ with the explanation as tooltip (and for screen readers). */
export function CompatMark({ compat }: { compat: SourceCompat }) {
  const text = warningText(compat)
  return <span className={styles.mark} role="img" aria-label={text.replace(/\n/g, '. ')} title={text}>⚠</span>
}

interface BannerProps { compat: Compatibility | undefined; label?: (s: SourceCompat) => string; className?: string }

/** Small dismissible notice: informs, never blocks. Dismissal lasts until the message changes. */
export function CompatBanner({ compat, label, className }: BannerProps) {
  const text = bannerText(compat, label)
  const [dismissed, setDismissed] = useState<string | null>(null)
  if (!text || dismissed === text) return null
  return (
    <p className={`${styles.banner} ${className ?? ''}`} role="status" data-compat-banner>
      <span aria-hidden="true">⚠</span>
      <span className={styles.text}>{text}</span>
      <button type="button" className={styles.close} aria-label="Cerrar aviso" onClick={() => setDismissed(text)}>×</button>
    </p>
  )
}
