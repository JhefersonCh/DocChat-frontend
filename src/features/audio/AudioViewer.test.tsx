// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChunkInfo, Citation } from '@/domain/types'
import { joinFocus } from '@/domain/audioFocus'
import { doc } from '@/test/fixtures'
import { AudioViewer } from './AudioViewer'

const api = vi.hoisted(() => ({ listChunks: vi.fn(), getWaveform: vi.fn() }))
vi.mock('@/api/documents', () => ({ listChunks: api.listChunks }))
vi.mock('@/api/media', () => ({ getWaveform: api.getWaveform, audioSrc: (id: string) => `/api/v1/documents/${id}/file` }))

const seg = (ordinal: number, t_start: number, t_end: number): ChunkInfo => ({
  chunk_id: `c${ordinal}`, ordinal, page_start: null, page_end: null, section: null, chars: 9, content: `frase ${ordinal}`,
  modality: 'audio', origin: 'window', t_start, t_end,
})
const cite = (over: Partial<Citation> = {}): Citation => ({
  n: 1, document_id: 'a1', filename: 'voz.mp3', page: null, page_end: null, snippet: 'frase 1', chunk_id: 'c1', content: 'frase 1',
  kind: 'audio', t_start: 16, t_end: 36, ...over,
})
const audioDoc = doc({ id: 'a1', filename: 'voz.mp3', kind: 'audio', duration_s: 60 })

let play: ReturnType<typeof vi.fn>
let scrollTo: ReturnType<typeof vi.fn>
beforeEach(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
  scrollTo = vi.fn()
  Element.prototype.scrollTo = scrollTo as unknown as typeof Element.prototype.scrollTo
  play = vi.fn(async () => {})
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: vi.fn() })
  api.listChunks.mockResolvedValue([seg(0, 0, 20), seg(1, 16, 36), seg(2, 32, 52)])
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

function view(citation: Citation | null = null, seq = 0, onTrace = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const el = (c: Citation | null, s: number) => (
    <QueryClientProvider client={qc}><AudioViewer doc={audioDoc} citation={c} seq={s} onTrace={onTrace} /></QueryClientProvider>
  )
  const r = render(el(citation, seq))
  return { onTrace, rerender: (c: Citation | null, s: number) => r.rerender(el(c, s)) }
}

describe('AudioViewer', () => {
  it('shows the transcript with timestamps and a flat waveform when there are no peaks', async () => {
    api.getWaveform.mockResolvedValue(null)
    view()
    expect(await screen.findByText('frase 2')).toBeTruthy()
    expect(screen.getByText('00:16')).toBeTruthy()
    const wave = screen.getByRole('slider')
    expect(wave.getAttribute('data-flat')).toBe('true')
    expect(wave.getAttribute('aria-valuemax')).toBe('60')
  })

  it('draws real peaks when the endpoint answers', async () => {
    api.getWaveform.mockResolvedValue({ peaks: [0.2, 0.9, 0.4], duration_s: 60 })
    view()
    await waitFor(() => expect(screen.getByRole('slider').getAttribute('data-flat')).toBe('false'))
  })

  it('a click on a transcript row seeks there (and lights it)', async () => {
    api.getWaveform.mockResolvedValue(null)
    view()
    await userEvent.click(await screen.findByRole('button', { name: /frase 2/ }))
    const audio = document.querySelector('audio')!
    expect(audio.currentTime).toBe(32)
    await waitFor(() => expect(screen.getByRole('button', { name: /frase 2/ }).getAttribute('aria-current')).toBe('true'))
    expect(scrollTo).toHaveBeenCalled() // follows the heard window
  })

  it('a citation seeks to t_start, plays, draws its band and reports a `time` trace', async () => {
    api.getWaveform.mockResolvedValue(null)
    const { onTrace } = view(cite(), 1)
    await waitFor(() => expect(onTrace).toHaveBeenCalledWith(1, expect.objectContaining({ quality: 'time' })))
    expect(document.querySelector('audio')!.currentTime).toBe(16)
    expect(play).toHaveBeenCalled()
    expect(document.querySelector('[data-bbox]')).toBeTruthy()
    expect(await screen.findByText('cita [1]')).toBeTruthy()
  })

  it('does not replay a click it already handled (remount) and respects the Auto toggle', async () => {
    api.getWaveform.mockResolvedValue(null)
    const first = view(cite(), 7)
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1))
    first.rerender(cite(), 7)
    cleanup()
    view(cite(), 7)
    await screen.findByText('frase 1')
    expect(play).toHaveBeenCalledTimes(1)
    // New click with Auto off: seeks, does not play.
    cleanup()
    const off = view(null, 7)
    await userEvent.click(await screen.findByRole('button', { name: 'Auto' }))
    off.rerender(cite({ t_start: 32, t_end: 52 }), 8)
    await waitFor(() => expect(document.querySelector('audio')!.currentTime).toBe(32))
    expect(play).toHaveBeenCalledTimes(1)
    localStorage.clear()
  })

  it('space toggles play and ← / → move ±5 s', async () => {
    api.getWaveform.mockResolvedValue(null)
    view()
    const wave = await screen.findByRole('slider')
    wave.focus()
    fireEvent.keyDown(wave, { key: ' ' })
    expect(play).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(wave, { key: 'ArrowRight' })
    expect(document.querySelector('audio')!.currentTime).toBe(5)
    fireEvent.keyDown(wave, { key: 'ArrowLeft' })
    expect(document.querySelector('audio')!.currentTime).toBe(0)
  })

  it('shows an error note when the original cannot be played', async () => {
    api.getWaveform.mockResolvedValue(null)
    view()
    fireEvent.error(document.querySelector('audio')!)
    expect((await screen.findByRole('alert')).textContent).toMatch(/Audio no disponible/)
  })

  it('playing silences the voice (shared audio focus) and the viewer yields to it', async () => {
    api.getWaveform.mockResolvedValue(null)
    const voice = vi.fn()
    const off = joinFocus('tts', voice)
    view()
    await userEvent.click(await screen.findByRole('button', { name: 'Reproducir' }))
    expect(voice).toHaveBeenCalledOnce()
    const { takeFocus } = await import('@/domain/audioFocus')
    takeFocus('tts')
    expect((HTMLMediaElement.prototype.pause as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalled()
    off()
  })
})
