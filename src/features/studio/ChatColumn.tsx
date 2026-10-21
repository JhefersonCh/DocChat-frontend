import { useId, useState, type ReactNode } from 'react'
import type { Document } from '@/domain/types'
import { NotesPanel } from '@/features/notes/NotesPanel'
import { TutorPanel } from '@/features/tutor/TutorPanel'
import { StudioPanel } from './StudioPanel'
import styles from './ChatColumn.module.css'

type Tab = 'chat' | 'studio' | 'notes' | 'tutor'
const TABS: { id: Tab; label: string }[] = [{ id: 'chat', label: 'Conversación' }, { id: 'studio', label: 'Estudio' }, { id: 'tutor', label: 'Tutor' }, { id: 'notes', label: 'Notas' }]

interface Props {
  chatId: string
  chatTitle: string
  doc: Document | null
  goToSettings: () => void
  /** The conversation stays mounted while hidden, so a stream in flight is not lost on tab switch. */
  children: ReactNode
}

/** Right column: tabs between the conversation and the Estudio panel. */
export function ChatColumn({ chatId, chatTitle, doc, goToSettings, children }: Props) {
  const [tab, setTab] = useState<Tab>('chat')
  const [tutorOpened, setTutorOpened] = useState(false) // mounted on first visit (it fetches), then kept
  if (tab === 'tutor' && !tutorOpened) setTutorOpened(true)
  const base = useId()
  const move = (e: React.KeyboardEvent, i: number) => {
    const n = TABS.length
    const next = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i + n - 1) % n : -1
    if (next >= 0) { e.preventDefault(); setTab(TABS[next].id); document.getElementById(`${base}-${TABS[next].id}`)?.focus() }
  }
  return (
    <div className={styles.col}>
      <div role="tablist" aria-label="Panel" className={styles.tabs}>
        {TABS.map((t, i) => (
          <button
            key={t.id} id={`${base}-${t.id}`} type="button" role="tab" className={styles.tab}
            aria-selected={tab === t.id} aria-controls={`${base}-panel-${t.id}`} tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)} onKeyDown={(e) => move(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${base}-panel-chat`} aria-labelledby={`${base}-chat`} className={styles.pane} hidden={tab !== 'chat'}>
        {children}
      </div>
      <div role="tabpanel" id={`${base}-panel-studio`} aria-labelledby={`${base}-studio`} className={styles.pane} hidden={tab !== 'studio'}>
        <StudioPanel chatId={chatId} doc={doc} goToSettings={goToSettings} />
      </div>
      <div role="tabpanel" id={`${base}-panel-tutor`} aria-labelledby={`${base}-tutor`} className={styles.pane} hidden={tab !== 'tutor'}>
        {tutorOpened && <TutorPanel chatId={chatId} doc={doc} goToSettings={goToSettings} />}
      </div>
      <div role="tabpanel" id={`${base}-panel-notes`} aria-labelledby={`${base}-notes`} className={styles.pane} hidden={tab !== 'notes'}>
        <NotesPanel chatId={chatId} chatTitle={chatTitle} doc={doc} />
      </div>
    </div>
  )
}
