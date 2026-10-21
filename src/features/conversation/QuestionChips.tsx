import styles from './QuestionChips.module.css'

export const MAX_CHIPS = 3

interface Props {
  questions: string[]
  onPick: (question: string) => void
  /** Accessible name of the group. */
  label: string
}

/** Clickable question suggestions. Plain buttons: Tab/Enter/Space work natively. */
export function QuestionChips({ questions, onPick, label }: Props) {
  const shown = questions.filter((q) => q.trim()).slice(0, MAX_CHIPS)
  if (shown.length === 0) return null
  return (
    <ul className={styles.chips} aria-label={label}>
      {shown.map((q) => (
        <li key={q} className={styles.item}>
          <button type="button" className={styles.chip} onClick={() => onPick(q)}>{q}</button>
        </li>
      ))}
    </ul>
  )
}
