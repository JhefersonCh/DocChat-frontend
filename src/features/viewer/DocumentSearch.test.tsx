// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchDocument } from '@/api/documents'
import { TraceContext } from '@/features/conversation/TraceContext'
import { doc } from '@/test/fixtures'
import { DocumentSearch } from './DocumentSearch'

vi.mock('@/api/documents', () => ({ searchDocument: vi.fn() }))
const search = vi.mocked(searchDocument)

afterEach(() => { cleanup(); search.mockReset() })

function setup() {
  const onCiteSelect = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TraceContext.Provider value={{ activeCitation: null, seq: 0, origin: null, onCiteSelect }}>
        <DocumentSearch doc={doc()} />
      </TraceContext.Provider>
    </QueryClientProvider>,
  )
  return onCiteSelect
}

describe('DocumentSearch', () => {
  it('lists hits for the submitted query and a click traces the hit in the viewer', async () => {
    search.mockResolvedValue({ query: 'plazo', hits: [
      { chunk_id: 'c1', page_start: 3, page_end: 3, section: null, snippet: 'El plazo de entrega', content: 'El plazo de entrega es 30', score: 0.82 },
    ] })
    const onCiteSelect = setup()
    await userEvent.type(screen.getByRole('searchbox'), 'plazo{Enter}')
    expect(search).toHaveBeenCalledWith('d1', 'plazo', 10, expect.anything())
    await userEvent.click(await screen.findByRole('button', { name: /El plazo de entrega/ }))
    expect(onCiteSelect).toHaveBeenCalledWith(expect.objectContaining({ n: 0, page: 3, chunk_id: 'c1', content: 'El plazo de entrega es 30' }), expect.anything())
    expect(screen.queryByRole('button', { name: /El plazo de entrega/ })).toBeNull() // panel closed
  })

  it('says when nothing matches and does not search an empty query', async () => {
    search.mockResolvedValue({ query: 'zzz', hits: [] })
    setup()
    await userEvent.type(screen.getByRole('searchbox'), '  {Enter}')
    expect(search).not.toHaveBeenCalled()
    await userEvent.type(screen.getByRole('searchbox'), 'zzz{Enter}')
    expect(await screen.findByText('Sin resultados.')).toBeTruthy()
  })

  it('an image hit shows its thumbnail and label, and a click traces it with its bbox (BBoxLocator input)', async () => {
    search.mockResolvedValue({ query: 'gato', hits: [
      { chunk_id: 'i1', page_start: 2, page_end: 2, section: null, snippet: 'Un gato naranja', content: 'Un gato naranja', score: 0.7, kind: 'image', bbox: [0.1, 0.1, 0.5, 0.3], has_thumb: true },
    ] })
    const onCiteSelect = setup()
    await userEvent.type(screen.getByRole('searchbox'), 'gato{Enter}')
    const hit = await screen.findByRole('button', { name: /Un gato naranja/ })
    expect(hit.querySelector('img')?.getAttribute('src')).toBe('/api/v1/segments/i1/thumb')
    expect(hit.textContent).toContain('Imagen · pág. 2 · zona superior izquierda')
    await userEvent.click(hit)
    expect(onCiteSelect).toHaveBeenCalledWith(expect.objectContaining({ kind: 'image', bbox: [0.1, 0.1, 0.5, 0.3], page: 2, has_thumb: true }), expect.anything())
  })
})
