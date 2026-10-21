// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChunkInfo } from '@/domain/types'
import { TraceContext } from '@/features/conversation/TraceContext'
import { XrayStateContext, type XraySource } from '@/features/viewer/xray/XrayContext'
import { doc } from '@/test/fixtures'
import { TimeXrayStrip } from './TimeXrayStrip'

const api = vi.hoisted(() => ({ listChunks: vi.fn(), getWaveform: vi.fn() }))
vi.mock('@/api/documents', () => ({ listChunks: api.listChunks }))
vi.mock('@/api/media', () => ({ getWaveform: api.getWaveform }))

afterEach(() => { cleanup(); vi.clearAllMocks() })

const chunk = (i: number, a: number, b: number): ChunkInfo => ({ chunk_id: `c${i}`, ordinal: i, page_start: null, page_end: null, section: null, chars: 9, content: `frase ${i}`, modality: 'audio', t_start: a, t_end: b })
const found = (n: number, score: number, t_start?: number, t_end?: number) => ({ n, chunk_id: `c${n - 1}`, page_start: null, page_end: null, section: null, score, kind: 'audio' as const, t_start, t_end })
const source: XraySource = {
  id: 'm1', live: false, locked: true, cited: [2], citations: [],
  searches: [{ query: 'plazos', k: 3, found: [found(1, 0.4, 0, 20), found(2, 0.8, 80, 100), found(3, 0.5)] }], // #3 has no times: the chunk list gives them
}

function strip(onCiteSelect = vi.fn(), src: XraySource = source, d = doc({ id: 'a1', kind: 'audio', duration_s: 200 })) {
  api.listChunks.mockResolvedValue([chunk(0, 0, 20), chunk(1, 80, 100), chunk(2, 40, 60)])
  api.getWaveform.mockResolvedValue(null)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <TraceContext.Provider value={{ activeCitation: null, seq: 0, origin: null, onCiteSelect }}>
        <XrayStateContext.Provider value={{ source: src, replay: 1 }}>
          <TimeXrayStrip doc={d} />
        </XrayStateContext.Provider>
      </TraceContext.Provider>
    </QueryClientProvider>,
  )
  return onCiteSelect
}

describe('TimeXrayStrip', () => {
  it('places each hit on the time axis (left = t_start / duration) and marks the cited one', async () => {
    strip()
    const ticks = await waitFor(() => { const t = screen.getAllByRole('button'); expect(t).toHaveLength(3); return t })
    expect(ticks[0].style.left).toBe('0%')
    expect(ticks[1].style.left).toBe('40%')
    expect(ticks[1].getAttribute('data-cited')).toBe('true')
    expect(ticks[2].style.left).toBe('20%') // from the chunk list
    expect(ticks[1].getAttribute('aria-label')).toMatch(/audio · 01:20–01:40/)
  })

  it('clicking a tick opens an audio citation at its time range', async () => {
    const onCite = strip()
    const ticks = await waitFor(() => { const t = screen.getAllByRole('button'); expect(t).toHaveLength(3); return t })
    await userEvent.click(ticks[1])
    expect(onCite).toHaveBeenCalledWith(expect.objectContaining({ n: 2, origin: 'xray', kind: 'audio', t_start: 80, t_end: 100, chunk_id: 'c1' }), {})
  })
})

describe('TimeXrayStrip on a video', () => {
  const vdoc = doc({ id: 'v1', kind: 'video', duration_s: 200 })
  const mixed: XraySource = {
    id: 'm2', live: false, locked: true, cited: [], citations: [],
    searches: [{ query: 'pizarra', k: 2, found: [{ ...found(2, 0.8, 80, 100), kind: 'video' as const }, found(1, 0.5, 0, 20)] }],
  }
  it('draws frame ticks hatched and speech ticks solid, on the same axis', async () => {
    strip(vi.fn(), mixed, vdoc)
    const ticks = await waitFor(() => { const t = screen.getAllByRole('button'); expect(t).toHaveLength(2); return t })
    expect(ticks[0].getAttribute('data-media')).toBe('true')
    expect(ticks[0].style.left).toBe('40%')
    expect(ticks[0].getAttribute('aria-label')).toMatch(/fotograma · 01:20–01:40/)
    expect(ticks[1].getAttribute('data-media')).toBe('false')
  })
  it('a frame tick opens a video citation, a speech tick an audio one of a video source (both seek the video)', async () => {
    const onCite = strip(vi.fn(), mixed, vdoc)
    const ticks = await waitFor(() => { const t = screen.getAllByRole('button'); expect(t).toHaveLength(2); return t })
    await userEvent.click(ticks[0])
    expect(onCite).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'video', source_kind: 'video', t_start: 80, t_end: 100 }), {})
    await userEvent.click(ticks[1])
    expect(onCite).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'audio', source_kind: 'video', t_start: 0, t_end: 20 }), {})
  })
})
