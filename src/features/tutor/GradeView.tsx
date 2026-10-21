import { motion } from 'motion/react'
import { percent, type TutorGrade } from '@/domain/tutor'
import type { Document } from '@/domain/types'
import { ease } from '@/ui/motion'
import { SourceLink } from './SourceLink'
import styles from './tutor.module.css'

/** Per-point verdict: covered points quote what the student wrote, missing ones point at the source. */
export function GradeView({ grade, doc }: { grade: TutorGrade; doc: Document }) {
  const covered = grade.points.filter((p) => p.covered).length
  return (
    <div className={styles.grade}>
      <div className={styles.score} role="status">
        <span><b>{covered}</b> de {grade.points.length} puntos · {percent(grade.score)}</span>
        <span className={styles.meter} aria-hidden="true">
          <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: grade.score }} transition={{ duration: 0.5, ease, delay: 0.1 }} />
        </span>
      </div>
      <ul className={styles.points}>
        {grade.points.map((p, i) => (
          <motion.li
            key={i} className={styles.point} data-covered={p.covered}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease, delay: 0.12 + i * 0.07 }}
          >
            <span className={styles.mark} aria-hidden="true">{p.covered ? '✓' : '○'}</span>
            <div className={styles.pointBody}>
              <p className={styles.pointText}><span className={styles.sr}>{p.covered ? 'Cubierto: ' : 'Falta: '}</span>{p.point}</p>
              {p.covered && p.student_quote && <p className={styles.said}>Dijiste: «{p.student_quote}»</p>}
              {!p.covered && (
                <>
                  <p className={styles.quote}>«{p.source_quote}»</p>
                  <SourceLink doc={doc} sourceId={p.document_id} page={p.page} chunkId={p.chunk_id} quote={p.source_quote} />
                </>
              )}
            </div>
          </motion.li>
        ))}
      </ul>
      {grade.feedback && <p className={styles.feedback}>{grade.feedback}</p>}
      {grade.follow_up_question && (
        <motion.blockquote
          className={styles.followUp} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease, delay: 0.3 + grade.points.length * 0.07 }}
        >
          <small>Para seguir pensando</small>
          {grade.follow_up_question}
        </motion.blockquote>
      )}
    </div>
  )
}
