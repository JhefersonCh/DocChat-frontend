import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import type { ApiClientError } from '@/api/client'
import { sessionQueue, type TutorGrade } from '@/domain/tutor'
import type { Document } from '@/domain/types'
import { Button } from '@/ui/Button'
import { ErrorNote } from '@/ui/ErrorNote'
import { ease } from '@/ui/motion'
import { GradeView } from './GradeView'
import { useAnswerQuestion, useGenerateQuestions, useTutorQuestions } from './hooks'
import { MasteryChips } from './MasteryChips'
import styles from './tutor.module.css'

const COUNT = 5

interface Props { chatId: string; doc: Document | null; goToSettings: () => void }

/**
 * Socratic tutor: one open question at a time, answered in your own words and graded against a rubric
 * whose points are quoted from the document. Failed questions come back first (backend schedule).
 */
export function TutorPanel({ chatId, doc, goToSettings }: Props) {
  const ready = doc?.status === 'ready'
  const list = useTutorQuestions(chatId, ready)
  const generate = useGenerateQuestions(chatId)
  const answer = useAnswerQuestion(chatId)
  const [queue, setQueue] = useState<string[] | null>(null) // ids of this round, fixed while you study
  const [at, setAt] = useState(0)
  const [draft, setDraft] = useState('')
  const [grade, setGrade] = useState<TutorGrade | null>(null)
  const questions = list.data ?? []
  if (queue === null && list.data && list.data.length > 0) setQueue(sessionQueue(list.data))

  const current = queue ? questions.find((q) => q.id === queue[at]) : undefined
  const round = () => { setQueue(sessionQueue(questions)); setAt(0); setGrade(null); setDraft('') }
  const more = () => generate.mutate(COUNT, { onSuccess: (created) => { setQueue(created.map((q) => q.id)); setAt(0); setGrade(null); setDraft('') } })
  const next = () => { setAt((i) => i + 1); setGrade(null); setDraft(''); answer.reset() }
  const submit = () => {
    const text = draft.trim()
    if (!current || !text || answer.isPending || grade) return
    answer.mutate({ id: current.id, text }, { onSuccess: setGrade })
  }
  const error = (generate.error ?? answer.error ?? list.error) as ApiClientError | null

  return (
    <div className={styles.panel}>
      <div className={styles.scroll}>
        {!ready && <p className={styles.state}>El tutor aparece cuando el documento está listo.</p>}
        {ready && list.isPending && <p className={styles.state} role="status">Leyendo tu progreso…</p>}
        {ready && !list.isPending && <MasteryChips questions={questions} />}
        {error && <ErrorNote error={error} handlers={{ goToSettings, retry: list.error ? () => void list.refetch() : undefined }} />}

        {ready && list.data && questions.length === 0 && (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Practicá explicando.</p>
            <p className={styles.state}>Te hago preguntas abiertas sobre el documento y corrijo cada punto clave, con la cita que lo respalda.</p>
            <Button variant="solid" disabled={generate.isPending} onClick={more}>{generate.isPending ? 'Preparando preguntas…' : 'Generar preguntas'}</Button>
          </div>
        )}

        {current && (
          <>
            <p className={styles.kicker}>Pregunta {at + 1} de {queue?.length}{current.section && ` · §${current.section}`}{current.lapses > 0 && ' · para repasar'}</p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${current.id}:${grade ? 'graded' : 'open'}`} className={styles.card}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease }}
              >
                <h3 className={styles.question}>{current.question}</h3>
                {grade && doc ? (
                  <>
                    <GradeView grade={grade} doc={doc} />
                    <div className={styles.actions}>
                      <Button variant="solid" onClick={next}>{at + 1 < (queue?.length ?? 0) ? 'Siguiente' : 'Terminar ronda'}</Button>
                    </div>
                  </>
                ) : (
                  <form className={styles.form} onSubmit={(e) => { e.preventDefault(); submit() }}>
                    <label className={styles.sr} htmlFor="tutor-answer">Tu respuesta</label>
                    <textarea
                      id="tutor-answer" className={styles.textarea} rows={5} value={draft} maxLength={4000} autoFocus
                      placeholder="Explicalo con tus palabras…" onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit() } }}
                    />
                    <div className={styles.actions}>
                      <Button type="submit" variant="solid" disabled={!draft.trim() || answer.isPending}>{answer.isPending ? 'Corrigiendo…' : 'Responder'}</Button>
                      <span className={styles.hint}>{current.points} puntos a cubrir · Ctrl+Enter</span>
                    </div>
                  </form>
                )}
              </motion.div>
            </AnimatePresence>
          </>
        )}

        {queue && !current && questions.length > 0 && (
          <motion.div className={styles.empty} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease }}>
            <p className={styles.emptyTitle}>Ronda completa.</p>
            <p className={styles.state}>Las que no dominaste vuelven primero en la próxima.</p>
            <div className={styles.actions}>
              <Button variant="solid" onClick={round}>Repasar</Button>
              <Button disabled={generate.isPending} onClick={more}>{generate.isPending ? 'Preparando…' : 'Más preguntas'}</Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
