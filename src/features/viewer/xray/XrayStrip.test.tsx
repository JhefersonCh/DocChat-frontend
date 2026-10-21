// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChunkInfo } from '@/domain/types'
import { TraceContext } from '@/features/conversation/TraceContext'
import { doc } from '@/test/fixtures'
import { XrayStateContext, type XraySource } from './XrayContext'
import { XrayStrip } from './XrayStrip'

const api = vi.hoisted(() => ({ listChunks: vi.fn() }))
vi.mock('@/api/documents', () => ({ listChunks: api.listChunks }))

afterEach(() => { cleanup(); vi.clearAllMocks() })

const chunk = (ordinal: number): ChunkInfo => ({ chunk_id: `c${ordinal}`, ordinal, page_start: null, page_end: null, section: null, chars: 9, content: `texto ${ordinal}` })
const found = (n: number, score: number) => ({ n, chunk_id: `c${n - 1}`, page_start: null, page_end: null, section: 'Plazos', score })
const source: XraySource = {
  id: 'm1', live: false, locked: true, cited: [2], citations: [],
  searches: [
    { query: 'plazo de entrega', k: 2, found: [found(1, 0.4), found(2, 0.8)] },
    { query: 'resumen', k: 1, panorama: true, found: [found(3, 0.5)] },
  ],
}

function strip(onCiteSelect = vi.fn()) {
  api.listChunks.mockResolvedValue([0, 1, 2, 3].map(chunk))
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <TraceContext.Provider value={{ activeCitation: null, seq: 0, origin: null, onCiteSelect }}>
        <XrayStateContext.Provider value={{ source, replay: 1 }}>
          <XrayStrip doc={doc({ filename: 'a.txt' })} scroller={null} />
        </XrayStateContext.Provider>
      </TraceContext.Provider>
    </QueryClientProvider>,
  )
  return onCiteSelect
}

describe('X-ray strip', () => {
  it('draws one tick per retrieved chunk (text docs by chunk ordinal), marking the cited and panorama ones', async () => {
    strip()
    const ticks = await screen.findAllByRole('button', { name: /relevancia/ })

    expect(ticks).toHaveLength(3)
    expect(ticks.map((t) => t.getAttribute('data-cited'))).toEqual(['false', 'true', 'false'])
    expect(ticks.map((t) => t.getAttribute('data-panorama'))).toEqual(['false', 'false', 'true'])
    expect(ticks[1].style.top).toBe('25%') // ordinal 1 of 4
  })

  it('a tick explains itself on hover and jumps through the trace seam as origin "xray"', async () => {
    const onCite = strip()
    const [, cited] = await screen.findAllByRole('button', { name: /relevancia/ })

    await userEvent.hover(cited)
    expect(screen.getByRole('tooltip').textContent).toContain('#1 «plazo de entrega»')
    expect(screen.getByRole('tooltip').textContent).toContain('citada [2]')

    await userEvent.click(cited)
    await waitFor(() => expect(onCite).toHaveBeenCalledWith(expect.objectContaining({ n: 2, origin: 'xray', chunk_id: 'c1', content: 'texto 1' }), {}))
  })

  it('the legend lists each query with its sequence number', async () => {
    strip()
    await userEvent.click(screen.getByRole('button', { name: 'Leyenda de los rayos X' }))
    expect(screen.getByText('plazo de entrega')).toBeTruthy()
    expect(screen.getByText('panorama', { selector: 'li' }) ).toBeTruthy()
  })
})
