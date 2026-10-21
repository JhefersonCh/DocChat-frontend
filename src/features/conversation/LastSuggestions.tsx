import type { Message } from '@/domain/types'
import { QuestionChips } from './QuestionChips'
import { useSuggestions } from './useSuggestions'
import styles from './LastSuggestions.module.css'

interface Props {
  chatId: string
  /** The last assistant answer (see `suggestionTarget`). */
  message: Message
  /** A new turn is running: hide and don't fetch. */
  pending: boolean
  onPick: (question: string) => void
}

/** Follow-up chips under the last finished answer. Reserves its height while loading; silent on failure. */
export function LastSuggestions({ chatId, message, pending, onPick }: Props) {
  const { data, isPending, isError } = useSuggestions(chatId, message, !pending)
  if (pending || isError) return null
  if (isPending) return <div className={styles.skeleton} aria-hidden="true"><span /><span /></div>
  return (
    <div className={styles.wrap}>
      <QuestionChips questions={data ?? []} onPick={onPick} label="Preguntas sugeridas" />
    </div>
  )
}
