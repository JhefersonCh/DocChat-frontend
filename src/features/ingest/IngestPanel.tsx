import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { progressInfo, SLOW_AFTER_MS } from '@/domain/ingest'
import type { Document } from '@/domain/types'
import { Button } from '@/ui/Button'
import { ScanBar } from '@/ui/ScanBar'
import { EnrichStrip } from './EnrichStrip'
import { useCancelIngest } from './hooks'
import styles from './IngestPanel.module.css'

const STATUS_TEXT: Record<Document['status'], string> = {
  pending: 'EN COLA',
  processing: 'EXTRAYENDO · GENERANDO EMBEDDINGS',
  ready: 'LISTO',
  failed: 'FALLÓ',
}
const STEPS = ['recibido', 'procesando', 'listo'] as const
const stepIndex = (s: Document['status']) => (s === 'pending' ? 0 : s === 'processing' ? 1 : 2)

function useElapsed(startedAt: number, running: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [running])
  return Math.max(0, now - startedAt)
}

const mmss = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Lab-territory ingest readout: file, status, scan bar, elapsed. `failed` shows `error` verbatim. */
export function IngestPanel({ chatId, doc }: { chatId: string; doc: Document }) {
  const cancel = useCancelIngest(chatId)
  const progress = doc.status === 'processing' ? progressInfo(doc.progress, doc.stage, doc.kind) : null
  const failed = doc.status === 'failed'
  const flying = doc.status === 'pending' || doc.status === 'processing'
  const elapsed = useElapsed(Date.parse(doc.created_at), flying)
  const at = stepIndex(doc.status)

  return (
    <section className={`${styles.panel} ${failed ? styles.failed : ''}`} aria-label="Ingesta del documento">
      <p className={styles.kicker}>INGESTA</p>
      <h2 className={styles.file}>{doc.filename}</h2>
      <ol className={styles.steps}>
        {STEPS.map((s, i) => {
          const bad = failed && i === 2
          const cls = bad ? styles.bad : i < at || (i === at && !flying && !failed) ? styles.done : i === at ? styles.now : ''
          return <li key={s} className={cls}>{bad ? 'falló' : s}</li>
        })}
      </ol>
      {flying && !progress && <ScanBar />}
      {progress && (
        <div
          className={styles.progress} role="progressbar" aria-label={`Progreso: ${progress.label}`}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.fraction * 100)}
        >
          <span className={styles.progressFill} style={{ width: `${progress.fraction * 100}%` }} />
        </div>
      )}
      <div className={styles.statusRow}>
        <div role="status" className={styles.status}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={doc.status}
              className={failed ? styles.errText : ''}
              initial={{ opacity: 0, y: 4, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {progress ? progress.label.toUpperCase() : STATUS_TEXT[doc.status]}
              {flying && <span className={styles.dots} aria-hidden="true" />}
            </motion.span>
          </AnimatePresence>
        </div>
        {flying && <span className={styles.clock}>{mmss(elapsed)}</span>}
      </div>
      {doc.status === 'processing' && (
        <div className={styles.actions}>
          <Button disabled={cancel.isPending} onClick={() => cancel.mutate(doc.id)}>
            {cancel.isPending ? 'Cancelando…' : 'Cancelar'}
          </Button>
        </div>
      )}
      {doc.status !== 'pending' && !progress && <EnrichStrip doc={doc} />}
      {flying && elapsed >= SLOW_AFTER_MS && (
        <p className={styles.slow}>Está tardando más de lo normal. Sigue en curso; no es un error.</p>
      )}
      {failed && <p className={styles.errBody} role="alert">{doc.error ?? 'Error desconocido'}</p>}
    </section>
  )
}
