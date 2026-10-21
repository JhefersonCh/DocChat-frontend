// Socratic tutor: API shapes and what the panel derives from them. Pure.
export interface TutorQuestion {
  id: string
  question: string
  section: string | null
  page: number | null
  points: number // size of the (hidden) rubric
  due: boolean
  due_at: string
  reps: number
  lapses: number
  last_score: number | null // null until the first attempt
}

export interface TutorPoint {
  point: string
  covered: boolean
  student_quote: string | null
  source_quote: string
  page: number | null
  chunk_id: string | null
  document_id?: string | null // source of the point in a multi-source chat
}

export interface TutorGrade {
  question_id: string
  points: TutorPoint[]
  score: number // covered / total
  feedback: string
  follow_up_question: string
  due_at: string
}

export interface Mastery { section: string; total: number; answered: number; mastery: number }

export const NO_SECTION = 'Sin sección'

/** Per section: mean of the last scores of the questions already answered (0 when none). */
export function masteryBySection(questions: readonly TutorQuestion[]): Mastery[] {
  const by = new Map<string, TutorQuestion[]>()
  for (const q of questions) by.set(q.section?.trim() || NO_SECTION, [...(by.get(q.section?.trim() || NO_SECTION) ?? []), q])
  return [...by].map(([section, qs]) => {
    const scores = qs.map((q) => q.last_score).filter((x): x is number => x != null)
    return { section, total: qs.length, answered: scores.length, mastery: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0 }
  })
}

/** Ids of one study round: what is due (the backend already puts failed ones first), else everything. */
export function sessionQueue(questions: readonly TutorQuestion[]): string[] {
  const due = questions.filter((q) => q.due)
  return (due.length ? due : questions).map((q) => q.id)
}

export const percent = (score: number) => `${Math.round(score * 100)}%`
