import { useReading, useReadingStore } from '@/features/viewer/reading'
import styles from './SpoilerToggle.module.css'

/** "Solo lo que leí": answers only use pages up to the one in the viewer, which updates live as you scroll. */
export function SpoilerToggle() {
  const store = useReadingStore()
  const { page, spoilerSafe } = useReading()
  const available = page != null
  const on = spoilerSafe && available
  return (
    <label className={styles.toggle} data-on={on} title={available ? 'Las respuestas solo usan lo que ya leíste, sin spoilers' : 'Este documento no tiene páginas'}>
      <input
        type="checkbox" role="switch" className={styles.input} checked={on} disabled={!available}
        onChange={(e) => store.setSpoilerSafe(e.target.checked)}
      />
      <span className={styles.track} aria-hidden="true"><span className={styles.thumb} /></span>
      <span className={styles.text}>Solo lo que leí</span>
      {on && <span className={styles.page} aria-live="polite">Hasta pág. {page}</span>}
    </label>
  )
}
