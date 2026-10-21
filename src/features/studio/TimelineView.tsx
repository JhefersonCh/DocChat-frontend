import { motion, useReducedMotion } from 'motion/react'
import type { TimelineData } from '@/domain/artifacts'
import { ease } from '@/ui/motion'
import { useOpenPage } from './useOpenPage'
import styles from './views2.module.css'

export function TimelineView({ data }: { data: TimelineData }) {
  const reduce = useReducedMotion()
  const open = useOpenPage()
  if (data.events.length === 0) return <p className={styles.empty}>{data.message ?? 'No se encontró contenido temporal en el documento.'}</p>
  return (
    <div className={styles.tlWrap}>
      {data.ordered_by === 'document' && <p className={styles.note}>Sin fechas completas: se muestra en el orden del documento.</p>}
      <ol className={styles.timeline} aria-label="Línea de tiempo">
        {data.events.map((e, i) => (
          <motion.li
            key={i} className={styles.event}
            initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease, delay: reduce ? 0 : Math.min(i, 10) * 0.04 }}
          >
            <button type="button" className={styles.eventBtn} onClick={(ev) => open(e, e.quote, ev.currentTarget)} aria-label={`${e.date_text}: ${e.title}`}>
              <time className={styles.date} dateTime={e.date_iso ?? undefined}>{e.date_text}</time>
              <span className={styles.eTitle}>{e.title}</span>
              {e.description && <span className={styles.eDesc}>{e.description}</span>}
              {e.page != null && <span className={styles.eMeta}>pág. {e.page}</span>}
            </button>
          </motion.li>
        ))}
      </ol>
    </div>
  )
}
