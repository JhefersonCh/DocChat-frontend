// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TutorGrade, TutorQuestion } from '@/domain/tutor'
import { TraceContext } from '@/features/conversation/TraceContext'
import { doc } from '@/test/fixtures'
import { TutorPanel } from './TutorPanel'

const api = vi.hoisted(() => ({ list: vi.fn(), generate: vi.fn(), answer: vi.fn() }))
vi.mock('@/api/tutor', () => ({
  tutorKeys: { list: (id: string) => ['tutor', id] },
  listTutorQuestions: api.list, generateTutorQuestions: api.generate, answerTutorQuestion: api.answer,
}))

afterEach(() => { cleanup(); vi.clearAllMocks() })

const q = (id: string, over: Partial<TutorQuestion> = {}): TutorQuestion => ({
  id, question: `¿Pregunta ${id}?`, section: 'Plazos', page: 2, points: 2, due: true, due_at: '2026-10-14T00:00:00Z', reps: 0, lapses: 0, last_score: null, ...over,
})
const grade: TutorGrade = {
  question_id: 'a', score: 0.5, feedback: 'Vas bien.', follow_up_question: '¿Y si se atrasa?', due_at: '2026-10-15T00:00:00Z',
  points: [
    { point: 'Plazo de 30 días', covered: true, student_quote: 'son treinta días', source_quote: 'plazo de 30 días', page: 2, chunk_id: 'c1' },
    { point: 'Multa del 5%', covered: false, student_quote: null, source_quote: 'multa del 5% del contrato', page: 3, chunk_id: 'c2' },
  ],
}

function panel(onCiteSelect = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <TraceContext.Provider value={{ activeCitation: null, seq: 0, origin: null, onCiteSelect }}>
        <TutorPanel chatId="c" doc={doc()} goToSettings={() => {}} />
      </TraceContext.Provider>
    </QueryClientProvider>,
  )
  return onCiteSelect
}

describe('Tutor', () => {
  it('asks one question, grades per point and links the missing one to the source', async () => {
    api.list.mockResolvedValue([q('a'), q('b')])
    api.answer.mockResolvedValue(grade)
    const onCite = panel()

    expect(await screen.findByText('¿Pregunta a?')).toBeTruthy()
    expect(screen.queryByText('¿Pregunta b?')).toBeNull() // one at a time
    const box = screen.getByLabelText('Tu respuesta')
    await userEvent.type(box, 'son treinta días{Control>}{Enter}{/Control}')

    expect(api.answer).toHaveBeenCalledWith('c', 'a', 'son treinta días')
    expect(await screen.findByText('Dijiste: «son treinta días»')).toBeTruthy()
    expect(screen.getByText('¿Y si se atrasa?')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('1 de 2 puntos · 50%')

    await userEvent.click(screen.getByRole('button', { name: /ver en el PDF · pág\. 3/ }))
    expect(onCite).toHaveBeenCalledWith(expect.objectContaining({ page: 3, chunk_id: 'c2', content: 'multa del 5% del contrato' }), expect.anything())

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByText('¿Pregunta b?')).toBeTruthy()
  })

  it('with no questions it offers to generate them and starts on the new ones', async () => {
    api.list.mockResolvedValueOnce([]).mockResolvedValue([q('n1')]) // refetched after generating
    api.generate.mockResolvedValue([q('n1')])
    panel()

    await userEvent.click(await screen.findByRole('button', { name: 'Generar preguntas' }))

    expect(api.generate).toHaveBeenCalledWith('c', 5)
    expect(await screen.findByText('¿Pregunta n1?')).toBeTruthy()
  })

  it('shows mastery per section from the last scores', async () => {
    api.list.mockResolvedValue([q('a', { last_score: 1, due: false }), q('b', { last_score: 0.5, due: false })])
    panel()
    expect((await screen.findByLabelText('Dominio por sección')).textContent).toContain('75%')
  })
})
