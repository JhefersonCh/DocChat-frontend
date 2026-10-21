import { useState } from 'react'
import type { QuizData } from '@/domain/artifacts'
import { scoreQuiz } from '@/domain/studio'
import { Button } from '@/ui/Button'
import { PageLink } from './PageLink'
import styles from './views.module.css'

/** Self-graded: an option locks the question and reveals the explanation; the score counts live. */
export function QuizView({ data }: { data: QuizData }) {
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const { correct, total, answered } = scoreQuiz(data.questions, answers)
  return (
    <div className={styles.quiz}>
      <p className={styles.score} role="status">
        {answered === total ? `Puntaje final: ${correct} de ${total}` : `Respondidas ${answered} de ${total} · aciertos ${correct}`}
      </p>
      {data.questions.map((q, i) => {
        const chosen = answers[i]
        const done = chosen !== undefined
        return (
          <fieldset key={i} className={styles.qs}>
            <legend className={styles.qtext}>{i + 1}. {q.question}</legend>
            {q.options.map((opt, j) => {
              const state = !done ? 'idle' : j === q.answer_index ? 'right' : j === chosen ? 'wrong' : 'idle'
              return (
                <button
                  key={j} type="button" className={styles.opt} data-state={state} disabled={done}
                  aria-pressed={chosen === j} onClick={() => setAnswers((a) => ({ ...a, [i]: j }))}
                >
                  <span aria-hidden="true">{'ABCD'[j]}</span>{opt}
                </button>
              )
            })}
            {done && (
              <p className={styles.a} role="status">
                {chosen === q.answer_index ? 'Correcto. ' : `Incorrecto: era ${'ABCD'[q.answer_index]}. `}{q.explanation} <PageLink pageRef={q} />
              </p>
            )}
          </fieldset>
        )
      })}
      {answered > 0 && <Button onClick={() => setAnswers({})}>Reiniciar</Button>}
    </div>
  )
}
