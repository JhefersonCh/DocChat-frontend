// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { listChunks } from '@/api/documents'
import { TraceContext } from '@/features/conversation/TraceContext'
import { doc } from '@/test/fixtures'
import { ChunkInspector } from './ChunkInspector'

vi.mock('@/api/documents', () => ({ listChunks: vi.fn() }))
afterEach(() => { cleanup(); vi.mocked(listChunks).mockReset() })

const items = [
  { chunk_id: 'c0', ordinal: 0, page_start: 1, page_end: 1, section: 'Intro', chars: 1234, content: 'Primer fragmento' },
  { chunk_id: 'c1', ordinal: 1, page_start: 2, page_end: 3, section: null, chars: 80, content: 'Segundo fragmento' },
]

describe('ChunkInspector', () => {
  it('lists chunks per page with section and size; a click traces the chunk in the viewer', async () => {
    vi.mocked(listChunks).mockResolvedValue(items)
    const onCiteSelect = vi.fn()
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TraceContext.Provider value={{ activeCitation: null, seq: 0, origin: null, onCiteSelect }}>
          <ChunkInspector doc={doc()} />
        </TraceContext.Provider>
      </QueryClientProvider>,
    )
    expect(await screen.findByText('Página 1')).toBeTruthy()
    expect(screen.getByText('Página 2')).toBeTruthy()
    expect(screen.getByText(/1234 car\./)).toBeTruthy()
    expect(screen.getByText(/§Intro/)).toBeTruthy()
    expect(screen.getByText(/2 chunks/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /Segundo fragmento/ }))
    expect(onCiteSelect).toHaveBeenCalledWith(
      expect.objectContaining({ origin: 'inspector', chunk_id: 'c1', page: 2, page_end: 3, content: 'Segundo fragmento' }),
      expect.anything(),
    )
  })

  it('media segments show their modality tag and thumbnail, and trace as an image citation with its bbox', async () => {
    vi.mocked(listChunks).mockResolvedValue([
      { chunk_id: 'm1', ordinal: 0, page_start: 3, page_end: 3, section: null, chars: 0, content: '', modality: 'image', origin: 'figure', bbox: [0.1, 0.1, 0.6, 0.5], text_status: 'pending', has_thumb: true },
    ])
    const onCiteSelect = vi.fn()
    const { container } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TraceContext.Provider value={{ activeCitation: null, seq: 0, origin: null, onCiteSelect }}>
          <ChunkInspector doc={doc({ kind: 'pdf' })} />
        </TraceContext.Provider>
      </QueryClientProvider>,
    )
    expect(await screen.findByText('figura')).toBeTruthy()
    expect(screen.getByText(/sin descripción/)).toBeTruthy()
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/api/v1/segments/m1/thumb')
    await userEvent.click(screen.getByRole('button', { name: /figura/ }))
    expect(onCiteSelect).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'image', bbox: [0.1, 0.1, 0.6, 0.5], page: 3, source_kind: 'pdf' }), expect.anything(),
    )
  })
})
