import { describe, expect, it } from 'vitest'
import { masteryBySection, sessionQueue, type TutorQuestion } from './tutor'

const q = (id: string, section: string | null, last: number | null, due = true): TutorQuestion =>
  ({ id, question: id, section, page: null, points: 3, due, due_at: '', reps: 0, lapses: 0, last_score: last })

describe('tutor session', () => {
  it('mastery averages the answered questions of each section', () => {
    expect(masteryBySection([q('a', 'Plazos', 1), q('b', 'Plazos', 0.5), q('c', 'Plazos', null), q('d', null, null)])).toEqual([
      { section: 'Plazos', total: 3, answered: 2, mastery: 0.75 },
      { section: 'Sin sección', total: 1, answered: 0, mastery: 0 },
    ])
  })

  it('the round is what is due, in the backend order; when nothing is due, everything', () => {
    expect(sessionQueue([q('a', null, 0, true), q('b', null, 1, false), q('c', null, null, true)])).toEqual(['a', 'c'])
    expect(sessionQueue([q('a', null, 1, false), q('b', null, 1, false)])).toEqual(['a', 'b'])
  })
})
