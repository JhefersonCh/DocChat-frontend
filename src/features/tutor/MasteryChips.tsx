import { masteryBySection, percent, type TutorQuestion } from '@/domain/tutor'
import styles from './tutor.module.css'

/** Progress by section: how much of each one you have answered and how well. */
export function MasteryChips({ questions }: { questions: readonly TutorQuestion[] }) {
  const items = masteryBySection(questions)
  if (items.length === 0) return null
  return (
    <ul className={styles.chips} aria-label="Dominio por sección">
      {items.map((m) => (
        <li
          key={m.section} className={styles.chip} style={{ ['--m' as string]: m.mastery }} data-answered={m.answered > 0}
          title={`${m.answered} de ${m.total} respondidas`}
        >
          <span className={styles.chipName}>{m.section}</span>
          <b>{m.answered ? percent(m.mastery) : `0/${m.total}`}</b>
        </li>
      ))}
    </ul>
  )
}
