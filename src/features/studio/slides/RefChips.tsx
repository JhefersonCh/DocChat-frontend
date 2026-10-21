import type { Slide, SlideRef } from '@/domain/artifacts'
import { refLabel } from '@/domain/slides'
import styles from './slides.module.css'

/** Small citation chips: each opens the verified quote in the viewer (page, or time for audio / video). */
export function RefChips({ slide, aliasOf, onOpen }: { slide: Slide; aliasOf: (id: string | null) => string | null; onOpen: (ref: SlideRef, origin: Element) => void }) {
  if (!slide.refs.length) return null
  return (
    <div className={styles.chips} role="group" aria-label="Fuentes de esta diapositiva">
      <span className={styles.chipsLabel}>Fuentes</span>
      {slide.refs.map((r, i) => {
        const label = refLabel(r, aliasOf(r.document_id))
        return (
          <button key={i} type="button" className={styles.chip} title={`«${r.quote}»`} aria-label={`Abrir fuente ${label}`} onClick={(e) => onOpen(r, e.currentTarget)}>
            {label}
          </button>
        )
      })}
    </div>
  )
}
