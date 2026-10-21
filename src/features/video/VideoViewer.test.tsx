// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChunkInfo, Citation } from '@/domain/types'
import { doc } from '@/test/fixtures'
import { VideoViewer } from './VideoViewer'

const api = vi.hoisted(() => ({ listChunks: vi.fn(), getWaveform: vi.fn(), getStoryboard: vi.fn() }))
vi.mock('@/api/documents', () => ({ listChunks: api.listChunks }))
vi.mock('@/api/media', () => ({
  getWaveform: api.getWaveform, getStoryboard: api.getStoryboard,
  videoSrc: (id: string) => `/api/v1/documents/${id}/file?variant=playable`,
  audioSrc: (id: string) => `/api/v1/documents/${id}/file`,
  segmentThumbUrl: (id: string) => `/api/v1/segments/${id}/thumb`,
  segmentAssetUrl: (id: string) => `/api/v1/segments/${id}/asset`,
}))

const frame = (i: number, t: number): ChunkInfo => ({
  chunk_id: `f${i}`, ordinal: i, page_start: null, page_end: null, section: null, chars: 9, content: `pizarra ${i}`,
  modality: 'frame', origin: 'frame', t_start: t, t_end: t + 20, has_thumb: true,
})
const win = (i: number, t0: number, t1: number): ChunkInfo => ({
  chunk_id: `a${i}`, ordinal: 10 + i, page_start: null, page_end: null, section: null, chars: 9, content: `frase ${i}`,
  modality: 'audio', origin: 'window', t_start: t0, t_end: t1,
})
const cite = (over: Partial<Citation> = {}): Citation => ({
  n: 1, document_id: 'v1', filename: 'clase.mp4', page: null, page_end: null, snippet: 'x', chunk_id: 'f1', content: 'x',
  kind: 'video', source_kind: 'video', t_start: 20, t_end: 40, has_thumb: true, ...over,
})
const videoDoc = doc({ id: 'v1', filename: 'clase.mp4', kind: 'video', duration_s: 60, width: 640, height: 360 })

let play: ReturnType<typeof vi.fn>
beforeEach(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo
  play = vi.fn(async () => {})
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: vi.fn() })
  api.listChunks.mockResolvedValue([frame(0, 0), frame(1, 20), frame(2, 40), win(0, 0, 20), win(1, 16, 36)])
  api.getStoryboard.mockResolvedValue(null)
  api.getWaveform.mockResolvedValue(null)
})
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear() })

function view(citation: Citation | null = null, seq = 0, onTrace = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><VideoViewer doc={videoDoc} citation={citation} seq={seq} onTrace={onTrace} /></QueryClientProvider>)
  return { onTrace }
}

describe('VideoViewer', () => {
  it('plays the playable variant and lays filmstrip + waveform on the same duration', async () => {
    view()
    const video = document.querySelector('video')!
    expect(video.getAttribute('src')).toContain('variant=playable')
    expect(document.querySelector('[data-filmstrip]')!.getAttribute('data-duration')).toBe('60')
    expect(screen.getByRole('slider').getAttribute('aria-valuemax')).toBe('60')
    await screen.findByText('frase 1')
  })

  it('interleaves frame captions with the transcript and can collapse them', async () => {
    view()
    expect(await screen.findByText('pizarra 1')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Descripciones de fotogramas' }))
    expect(screen.queryByText('pizarra 1')).toBeNull()
    expect(screen.getByText('frase 1')).toBeTruthy()
  })

  it('a click on a caption row seeks the video there', async () => {
    view()
    await userEvent.click(await screen.findByRole('button', { name: /pizarra 2/ }))
    expect(document.querySelector('video')!.currentTime).toBe(40)
  })

  it('a frame citation seeks, plays its range, draws the band and lights the cited thumbnail and row', async () => {
    const { onTrace } = view(cite(), 1)
    await waitFor(() => expect(onTrace).toHaveBeenCalledWith(1, expect.objectContaining({ quality: 'time' })))
    expect(document.querySelector('video')!.currentTime).toBe(20)
    expect(play).toHaveBeenCalled()
    expect(document.querySelectorAll('[data-bbox]').length).toBe(2) // filmstrip + waveform lane
    expect(await screen.findByText('cita [1]')).toBeTruthy()
  })

  it('a transcript citation of a video source (kind audio) seeks the VIDEO and lights the spoken window', async () => {
    const { onTrace } = view(cite({ kind: 'audio', chunk_id: 'a1', t_start: 16, t_end: 36 }), 2)
    await waitFor(() => expect(onTrace).toHaveBeenCalledWith(2, expect.objectContaining({ quality: 'time' })))
    expect(document.querySelector('video')!.currentTime).toBe(16)
    expect(play).toHaveBeenCalled()
    const row = (await screen.findByText('frase 1')).closest('li')!
    expect(row.getAttribute('data-cited')).toBe('true')
  })

  it('shows an error note when the browser cannot play the video', async () => {
    view()
    fireEvent.error(document.querySelector('video')!)
    expect((await screen.findByRole('alert')).textContent).toMatch(/no pudo reproducir/)
  })
})
