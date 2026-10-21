import type { ApiClientError } from '@/api/client'
import { exportFilename, notesToMarkdown } from '@/domain/exportMd'
import type { Document } from '@/domain/types'
import { useSources } from '@/features/sources/SourcesContext'
import { Button } from '@/ui/Button'
import { downloadText } from '@/ui/download'
import { ErrorNote } from '@/ui/ErrorNote'
import { useDeleteNote, useNotes, useRenameNote } from './hooks'
import { NoteCard } from './NoteCard'
import styles from './notes.module.css'

interface Props { chatId: string; chatTitle: string; doc: Document | null }

/** "Notas" tab: the answers the user saved in this chat, newest first. */
export function NotesPanel({ chatId, chatTitle, doc }: Props) {
  const list = useNotes(chatId)
  const rename = useRenameNote(chatId)
  const remove = useDeleteNote(chatId)
  const notes = list.data ?? []
  const all = useSources()
  const name = all.length > 1 ? chatTitle : doc?.filename || chatTitle
  const exportAll = () => downloadText(
    exportFilename(name, 'md'),
    notesToMarkdown({ title: chatTitle || name || '', doc, notes, date: new Date(), sources: all }),
  )
  return (
    <div className={styles.panel}>
      <div className={styles.bar}>
        <p className={styles.count}>{notes.length} {notes.length === 1 ? 'nota' : 'notas'}</p>
        <Button onClick={exportAll} disabled={notes.length === 0}>Exportar notas .md</Button>
      </div>
      <div className={styles.scroll}>
        {list.error && <ErrorNote error={list.error as ApiClientError} handlers={{ retry: () => void list.refetch() }} />}
        {list.data && notes.length === 0 && <p className={styles.state}>Todavía no guardaste notas. Usá «Guardar nota» debajo de una respuesta.</p>}
        <ul className={styles.list}>
          {notes.map((n) => (
            <NoteCard key={n.id} note={n} onRename={(title) => rename.mutate({ id: n.id, title })} onDelete={() => remove.mutate(n.id)} />
          ))}
        </ul>
      </div>
    </div>
  )
}
