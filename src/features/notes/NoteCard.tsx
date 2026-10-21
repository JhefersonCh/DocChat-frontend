import { useMemo, useState, type FormEvent } from 'react'
import { parseCitedRefs } from '@/domain/citations'
import { noteLabel } from '@/domain/exportMd'
import type { Note } from '@/domain/types'
import { AssistantText } from '@/features/conversation/AssistantText'
import { MarginNotes } from '@/features/conversation/MarginNotes'
import { Paper } from '@/ui/Paper'
import styles from './notes.module.css'

const when = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' })

interface Props { note: Note; onRename: (title: string) => void; onDelete: () => void }

/** One saved answer: editable title, markdown with working citation chips (snapshot), collapsible sources. */
export function NoteCard({ note, onRename, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note.title)
  const cited = useMemo(() => parseCitedRefs(note.content, note.citations.length), [note.content, note.citations.length])
  const label = noteLabel(note)
  const submit = (e: FormEvent) => { e.preventDefault(); setEditing(false); if (draft.trim() !== note.title) onRename(draft.trim()) }
  return (
    <li className={styles.card}>
      <header className={styles.head}>
        {editing ? (
          <form className={styles.rename} onSubmit={submit}>
            <input
              className={styles.input} value={draft} maxLength={200} autoFocus aria-label="Título de la nota" placeholder="Título"
              onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditing(false) } }}
            />
            <button type="submit" className={styles.link}>Guardar</button>
          </form>
        ) : (
          <>
            <h3 className={styles.title}>{label}</h3>
            <button type="button" className={styles.link} onClick={() => { setDraft(note.title); setEditing(true) }}>Renombrar</button>
            <button type="button" className={styles.del} aria-label="Eliminar nota" onClick={onDelete}>×</button>
          </>
        )}
      </header>
      <time className={styles.when} dateTime={note.created_at}>{when.format(new Date(note.created_at))}</time>
      <Paper className={styles.paper}>
        <AssistantText text={note.content} citations={note.citations} reveal={false} />
        <MarginNotes citations={note.citations} cited={cited} settled live={false} />
      </Paper>
    </li>
  )
}
