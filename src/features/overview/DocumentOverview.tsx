import { useId, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { ApiClientError } from '@/api/client'
import type { Document } from '@/domain/types'
import { QuestionChips } from '@/features/conversation/QuestionChips'
import { Button } from '@/ui/Button'
import { ErrorNote } from '@/ui/ErrorNote'
import { ease } from '@/ui/motion'
import styles from './DocumentOverview.module.css'

interface Props {
  doc: Document
  /** Sends the question exactly as if typed. */
  onAsk: (question: string) => void
  onGenerate: () => void
  generating: boolean
  error: ApiClientError | null
  goToSettings: () => void
  /** The conversation has messages: collapsed by default behind a header toggle. */
  compact: boolean
}

function Body({ doc, onAsk, onGenerate, generating, error, goToSettings }: Omit<Props, 'compact'>) {
  const status = doc.summary_status
  if (status === 'pending') {
    return (
      <div className={styles.pending} role="status">
        <p className={styles.state}>Generando resumen…</p>
        <span className={styles.shimmer} aria-hidden="true" />
        <span className={`${styles.shimmer} ${styles.short}`} aria-hidden="true" />
      </div>
    )
  }
  if (status === 'ready' && doc.summary) {
    return (
      <>
        <p className={styles.summary}>{doc.summary}</p>
        <QuestionChips questions={doc.suggested_questions} onPick={onAsk} label="Preguntas para empezar" />
      </>
    )
  }
  if (status === 'failed' || status === 'skipped') {
    return (
      <div className={styles.generate}>
        {status === 'failed' && <p className={styles.state}>No se pudo generar el resumen.</p>}
        <Button disabled={generating} onClick={onGenerate}>{generating ? 'Generando…' : 'Generar resumen'}</Button>
        {error && <ErrorNote error={error} handlers={{ goToSettings }} />}
      </div>
    )
  }
  return null
}

/** Summary + starter questions of the chat's document. Hidden until the document is ready. */
export function DocumentOverview({ compact, ...rest }: Props) {
  const [userOpen, setUserOpen] = useState<boolean | null>(null)
  const open = userOpen ?? !compact
  const bodyId = useId()
  if (rest.doc.status !== 'ready' || !rest.doc.summary_status) return null

  return (
    <section className={styles.card} aria-label="Resumen del documento">
      {compact ? (
        <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={bodyId} onClick={() => setUserOpen(!open)}>
          <span className={styles.kicker}>Resumen del documento</span>
          <span className={styles.chevron} aria-hidden="true" data-open={open}>▾</span>
        </button>
      ) : (
        <p className={styles.kicker}>Resumen del documento</p>
      )}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={bodyId} key="body" className={styles.body}
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease }}
          >
            <div className={styles.inner}><Body {...rest} /></div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
