import { useId, useState } from 'react'
import { KIND_ICON, kindOf } from '@/domain/sources'
import type { CollectionOverview as Collection } from '@/domain/types'
import { QuestionChips } from '@/features/conversation/QuestionChips'
import styles from './DocumentOverview.module.css'
import more from './CollectionOverview.module.css'

interface Props {
  overview: Collection
  onAsk: (question: string) => void
  /** The conversation has messages: collapsed by default behind a header toggle. */
  compact: boolean
}

/** Overview of a chat with several sources: each source's own summary under its alias + cross-source starter questions. */
export function CollectionOverview({ overview, onAsk, compact }: Props) {
  const [userOpen, setUserOpen] = useState<boolean | null>(null)
  const open = userOpen ?? !compact
  const bodyId = useId()
  const withSummary = overview.sources.filter((s) => s.summary)
  return (
    <section className={styles.card} aria-label="Resumen de las fuentes">
      {compact ? (
        <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={bodyId} onClick={() => setUserOpen(!open)}>
          <span className={styles.kicker}>Resumen de las {overview.sources.length} fuentes</span>
          <span className={styles.chevron} aria-hidden="true" data-open={open}>▾</span>
        </button>
      ) : (
        <p className={styles.kicker}>Resumen de las {overview.sources.length} fuentes</p>
      )}
      {open && (
        <div id={bodyId} className={styles.inner}>
          {withSummary.length === 0 && <p className={styles.state}>Las fuentes todavía no tienen resumen.</p>}
          <ul className={more.list}>
            {withSummary.map((s) => (
              <li key={s.document_id} className={more.item}>
                <span className={more.head}><span className={more.alias}>{s.alias}</span><span aria-hidden="true">{KIND_ICON[kindOf(s)]}</span><span className={more.name}>{s.filename}</span></span>
                <p className={styles.summary}>{s.summary}</p>
              </li>
            ))}
          </ul>
          <QuestionChips questions={overview.suggested_questions} onPick={onAsk} label="Preguntas para empezar" />
        </div>
      )}
    </section>
  )
}
