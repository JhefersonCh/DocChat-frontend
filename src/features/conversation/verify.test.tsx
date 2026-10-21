// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildSelectionQuestion } from '@/domain/selection'
import type { Citation, Verification } from '@/domain/types'
import { msg } from '@/test/fixtures'
import { HistoryAssistant } from './AssistantMessage'
import { TraceContext } from './TraceContext'
import { VerifiedText } from './VerifiedText'

afterEach(cleanup)

const cite: Citation = { n: 1, document_id: 'd', filename: 'a.pdf', page: 4, snippet: 's', chunk_id: 'c', page_end: null, content: 'El plazo de entrega es de 30 días hábiles.' }
const verification: Verification = {
  sentences: ['El plazo es de 30 días.', 'Hay multa diaria.', 'Se paga en euros.'],
  claims: [
    { text: 'El plazo es de 30 días', sentence_index: 0, status: 'respaldada', source_ns: [1], quote: 'plazo de entrega es de 30 días', reason: 'Lo dice la fuente.' },
    { text: 'Hay multa diaria', sentence_index: 1, status: 'parcial', source_ns: [1], reason: 'Solo se menciona una multa.' },
    { text: 'Se paga en euros', sentence_index: 2, status: 'sin_respaldo', source_ns: [], reason: 'No aparece.' },
  ],
}

const wrap = (ui: React.ReactNode, onCiteSelect = vi.fn()) => render(
  <QueryClientProvider client={new QueryClient()}>
    <TraceContext.Provider value={{ activeCitation: null, seq: 0, origin: null, onCiteSelect }}>{ui}</TraceContext.Provider>
  </QueryClientProvider>,
)

describe('claim check rendering', () => {
  it('flags each sentence by status, with glyph, label and a tooltip carrying reason and quote', () => {
    wrap(<VerifiedText verification={verification} citations={[cite]} />)
    const [ok, partial, none] = screen.getAllByRole('button')
    expect([ok, partial, none].map((b) => b!.getAttribute('data-status'))).toEqual(['respaldada', 'parcial', 'sin_respaldo'])
    expect(none!.textContent).toContain('✕') // not color-only
    expect(none!.textContent).toContain('Sin respaldo:')
    expect(ok!.getAttribute('aria-describedby')).toBe(screen.getAllByRole('tooltip', { hidden: true })[0]!.id)
    expect(screen.getByText('plazo de entrega es de 30 días', { exact: false, selector: 'q' })).toBeTruthy()
    expect(screen.getByText('Solo se menciona una multa.')).toBeTruthy()
  })

  it('opens the quote of a supported claim in the document, and nothing when there is no source', async () => {
    const onCite = vi.fn()
    wrap(<VerifiedText verification={verification} citations={[cite]} />, onCite)
    const [ok, , none] = screen.getAllByRole('button')
    await userEvent.click(none!)
    expect(onCite).not.toHaveBeenCalled()
    await userEvent.click(ok!)
    expect(onCite).toHaveBeenCalledWith(expect.objectContaining({ page: 4, content: 'plazo de entrega es de 30 días' }), expect.anything())
  })

  it('a persisted answer offers "Verificar", and once checked shows the summary chip over the underlined text', () => {
    const plain = msg({ citations: [cite], content: 'El plazo es de 30 días [1].' })
    wrap(<HistoryAssistant message={plain} chatId="c1" />)
    expect(screen.getByRole('button', { name: 'Verificar' })).toBeTruthy()
    cleanup()
    wrap(<HistoryAssistant message={{ ...plain, verification }} chatId="c1" />)
    expect(screen.getByRole('status').textContent).toBe('1 respaldada · 1 parcial · 1 sin respaldo')
    expect(screen.getAllByRole('button').filter((b) => b.getAttribute('data-status'))).toHaveLength(3)
  })

  it('shows readability only on answers to explain questions, and the persona badge', () => {
    const answer = msg({ content: 'El gato come pescado. La niña juega.', persona: 'el zorro' })
    wrap(<HistoryAssistant message={answer} chatId="c1" question={buildSelectionQuestion('explain', 'x', 2)} />)
    expect(screen.getByText(/^Legibilidad \d+ · /)).toBeTruthy()
    expect(screen.getByText(/Voz: el zorro/)).toBeTruthy()
    cleanup()
    wrap(<HistoryAssistant message={answer} chatId="c1" question="¿Qué dice?" />)
    expect(screen.queryByText(/Legibilidad/)).toBeNull()
  })
})
