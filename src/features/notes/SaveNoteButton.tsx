import { useNotes, useSaveNote } from './hooks'
import styles from './notes.module.css'

/** "Guardar nota" under an answer; once a note exists for it, a quiet disabled "Guardada" (also after a reload). */
export function SaveNoteButton({ chatId, messageId }: { chatId: string; messageId: string }) {
  const notes = useNotes(chatId)
  const save = useSaveNote(chatId)
  const saved = notes.data?.some((n) => n.message_id === messageId) ?? false
  return (
    <button
      type="button" className={`${styles.save} ${saved ? styles.saved : ''}`} data-saved={saved}
      disabled={saved || save.isPending} aria-label={saved ? 'Guardada en notas' : 'Guardar nota'}
      onClick={() => save.mutate(messageId)}
    >
      <span className={styles.mark} aria-hidden="true">{saved ? '✓' : '+'}</span>
      <span>{saved ? 'Guardada' : save.isPending ? 'Guardando…' : save.isError ? 'No se guardó · reintentar' : 'Guardar nota'}</span>
    </button>
  )
}
