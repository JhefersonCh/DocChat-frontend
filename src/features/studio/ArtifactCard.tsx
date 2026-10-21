import { Suspense, lazy, useId } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Artifact, AuditData, SlidesData, ChartData, ConceptMapData, EntityGraphData, RubricData, TimelineData, ExtractionData, FaqData, FlashcardsData, MindMapData, QuizData, StudyGuideData } from '@/domain/artifacts'
import { KIND_META, RUBRIC_PRESETS } from '@/domain/artifacts'
import { Button } from '@/ui/Button'
import { ease } from '@/ui/motion'
import { AuditView } from './AuditView'
import { GraphView } from './GraphView'
import { ConceptMapView } from './conceptmap/ConceptMapView'
import { RubricView } from './RubricView'
import { TimelineView } from './TimelineView'
import { ExtractionView } from './ExtractionView'
import { FaqView, GuideView } from './FaqView'
import { FlashcardsView } from './FlashcardsView'
import { MindMapView } from './MindMapView'
import { QuizView } from './QuizView'
import styles from './Studio.module.css'

const ChartView = lazy(() => import('./ChartView'))
const SlidesView = lazy(() => import('./slides/SlidesView').then((m) => ({ default: m.SlidesView })))
const when = new Intl.DateTimeFormat('es', { dateStyle: 'short', timeStyle: 'short' })

function Body({ a, chatId }: { a: Artifact; chatId: string }) {
  const d = a.data
  switch (a.kind) {
    case 'faq': return <FaqView data={d as FaqData} />
    case 'study_guide': return <GuideView data={d as StudyGuideData} />
    case 'quiz': return <QuizView data={d as QuizData} />
    case 'flashcards': return <FlashcardsView data={d as FlashcardsData} />
    case 'concept_map': return <ConceptMapView data={d as ConceptMapData} chatId={chatId} artifactId={a.id} />
    case 'mind_map': return <MindMapView data={d as MindMapData} />
    case 'chart': return <Suspense fallback={<p className={styles.state}>Cargando gráfico…</p>}><ChartView data={d as ChartData} /></Suspense>
    case 'extraction': return <ExtractionView data={d as ExtractionData} />
    case 'audit': return <AuditView data={d as AuditData} />
    case 'entity_graph': return <GraphView data={d as EntityGraphData} />
    case 'rubric': return <RubricView data={d as RubricData} />
    case 'timeline': return <TimelineView data={d as TimelineData} />
    case 'slides': return <Suspense fallback={<p className={styles.state}>Cargando presentación…</p>}><SlidesView data={d as SlidesData} /></Suspense>
  }
}

interface Props {
  chatId: string
  artifact: Artifact
  open: boolean
  onToggle: () => void
  onDelete: () => void
  onRetry: () => void
  busy: boolean
}

export function ArtifactCard({ chatId, artifact: a, open, onToggle, onDelete, onRetry, busy }: Props) {
  const bodyId = useId()
  const label = KIND_META[a.kind].label
  const sub = a.kind === 'extraction' ? a.options.columns?.join(', ') : a.kind === 'rubric' ? RUBRIC_PRESETS.find((p) => p.value === a.options.preset)?.label : a.kind === 'concept_map' ? [a.options.focus, a.options.depth && `${a.options.depth} niveles`].filter(Boolean).join(' · ') : a.kind === 'slides' ? [a.options.slides && `${a.options.slides} diap.`, a.options.style].filter(Boolean).join(' · ') : a.options.request
  return (
    <li className={styles.card} data-status={a.status}>
      <div className={styles.cardHead}>
        <button type="button" className={styles.cardToggle} aria-expanded={open} aria-controls={bodyId} onClick={onToggle} disabled={a.status !== 'ready'}>
          <span className={styles.cardTitle}>{label}</span>
          <span className={styles.cardMeta}>
            {a.status === 'pending' ? 'Generando…' : a.status === 'failed' ? 'Falló' : when.format(new Date(a.created_at))}{sub ? ` · ${sub}` : ''}
          </span>
        </button>
        <button type="button" className={styles.del} aria-label={`Eliminar ${label}`} onClick={onDelete}>×</button>
      </div>
      {a.status === 'pending' && (
        <div role="status" aria-label={`Generando ${label}`}>
          <span className={styles.shimmer} aria-hidden="true" />
          <span className={`${styles.shimmer} ${styles.short}`} aria-hidden="true" />
        </div>
      )}
      {a.status === 'failed' && (
        <div className={styles.failed}>
          <p role="alert">{a.error ?? 'No se pudo generar.'}</p>
          <Button disabled={busy} onClick={onRetry}>Reintentar</Button>
        </div>
      )}
      <AnimatePresence initial={false}>
        {open && a.status === 'ready' && (
          <motion.div
            id={bodyId} className={styles.cardBody}
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease }}
          >
            <div className={styles.inner}><Body a={a} chatId={chatId} /></div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}
