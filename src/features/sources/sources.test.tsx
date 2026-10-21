// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { doc } from '@/test/fixtures'
import type { Citation, Source } from '@/domain/types'
import { CitationChip } from '@/features/conversation/CitationChip'
import { TraceContext } from '@/features/conversation/TraceContext'
import { SourcesBar } from './SourcesBar'
import { SourcesContext } from './SourcesContext'

const api = vi.hoisted(() => ({ addSource: vi.fn(), removeSource: vi.fn(), setActiveSources: vi.fn() }))
vi.mock('@/api/sources', () => api)

const src = (id: string, alias: string, over: Partial<Source> = {}): Source => ({ ...doc({ id, filename: `${id}.mp4`, kind: 'video' }), alias, active: true, ...over })

beforeEach(() => { api.addSource.mockResolvedValue({}); api.removeSource.mockResolvedValue(undefined); api.setActiveSources.mockResolvedValue({}) })
afterEach(() => { cleanup(); vi.clearAllMocks() })

function bar(sources: Source[], onSelect = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SourcesBar chatId="chat" sources={sources} selectedId={sources[0]!.id} onSelect={onSelect} />
    </QueryClientProvider>,
  )
  return onSelect
}

describe('SourcesBar', () => {
  it('shows alias, name and state of every source; the selected one is marked and clicking another selects it', async () => {
    const onSelect = bar([src('a', 'S1'), src('b', 'S2', { status: 'processing', progress: { done: 2, total: 8 }, stage: 'embedding' })])
    const list = screen.getByRole('list', { name: 'Fuentes del chat' })
    expect(within(list).getByText('S2')).toBeTruthy()
    expect(within(list).getByText('Indexando 2/8')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^S1 a\.mp4/ }).getAttribute('aria-current')).toBe('true')
    await userEvent.click(screen.getByRole('button', { name: /^S2 b\.mp4/ }))
    expect(onSelect).toHaveBeenCalledWith('b')
  })

  it('a single source is a plain chip: no alias, no toggle', () => {
    bar([src('a', 'S1')])
    expect(screen.queryByText('S1')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('unticking a source sends the active ids that remain', async () => {
    bar([src('a', 'S1'), src('b', 'S2')])
    await userEvent.click(screen.getByRole('checkbox', { name: /Usar S2/ }))
    expect(api.setActiveSources).toHaveBeenCalledWith('chat', ['a'])
  })

  it('removing asks for confirmation first', async () => {
    bar([src('a', 'S1'), src('b', 'S2')])
    await userEvent.click(screen.getByRole('button', { name: /Quitar S2/ }))
    expect(api.removeSource).not.toHaveBeenCalled()
    expect(screen.getByText(/¿Quitar «b\.mp4»\?/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Quitar' }))
    expect(api.removeSource).toHaveBeenCalledWith('chat', 'b')
  })

  it('uploads picked files into the existing chat', async () => {
    bar([src('a', 'S1')])
    const file = new File(['x'], 'nuevo.pdf', { type: 'application/pdf' })
    await userEvent.upload(document.querySelector('input[type=file]')!, file)
    expect(api.addSource).toHaveBeenCalledWith('chat', expect.objectContaining({ name: 'nuevo.pdf' }))
  })
})

describe('citation chip in a multi-source chat', () => {
  const citation: Citation = { n: 2, document_id: 'b', filename: 'b.mp4', page: null, snippet: 's', chunk_id: 'c', page_end: null, content: null, source_alias: 'S2' }
  const show = (sources: Source[]) => render(
    <SourcesContext.Provider value={sources}>
      <TraceContext.Provider value={{ activeCitation: null, seq: 0, origin: null, onCiteSelect: vi.fn() }}>
        <CitationChip citation={citation} group={[citation]} />
      </TraceContext.Provider>
    </SourcesContext.Provider>,
  )
  it('carries the source alias', () => {
    show([src('a', 'S1'), src('b', 'S2')])
    expect(screen.getByRole('button', { name: /Cita 2, fuente S2/ }).textContent).toBe('2S2')
  })
  it('is a plain number with a single source', () => {
    show([src('b', 'S1')])
    expect(screen.getByRole('button', { name: 'Cita 2' }).textContent).toBe('2')
  })
})
