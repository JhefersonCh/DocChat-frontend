// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { enrichDocument } from '@/api/media'
import type { Document } from '@/domain/types'
import { doc } from '@/test/fixtures'
import { EnrichStrip } from './EnrichStrip'
import { IngestPanel } from './IngestPanel'

vi.mock('@/api/media', () => ({ enrichDocument: vi.fn(), segmentThumbUrl: vi.fn(), segmentAssetUrl: vi.fn() }))
vi.mock('@/api/documents', () => ({ cancelIngest: vi.fn(), getDocument: vi.fn(), regenerateSummary: vi.fn(), reindexDocument: vi.fn(), uploadDocument: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks() })

const view = (d: Document, ui = <EnrichStrip doc={d} />) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <MemoryRouter>{ui}</MemoryRouter>
  </QueryClientProvider>,
)
const img = (over: Partial<Document>) => doc({ kind: 'image', filename: 'gato.jpg', ...over })

describe('EnrichStrip', () => {
  it('shows stage 2 progress: "Describiendo imágenes 3/12" with a progress bar', () => {
    view(img({ enrich_status: 'running', stage: 'describing', progress: { done: 3, total: 12 } }))
    expect(screen.getByRole('status').textContent).toBe('Describiendo imágenes 3/12')
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('25')
    expect(screen.queryByRole('button')).toBeNull()
  })
  it('partial: badge, error detail and "Reintentar descripciones" -> POST enrich', async () => {
    vi.mocked(enrichDocument).mockResolvedValue({ document_id: 'd1', enrich_status: 'pending' })
    view(img({ enrich_status: 'partial', enrich_error: '2 imágenes sin describir' }))
    expect(screen.getByText('Descripciones parciales')).toBeTruthy()
    expect(screen.getByText('2 imágenes sin describir')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar descripciones' }))
    expect(vi.mocked(enrichDocument).mock.calls[0]?.[0]).toBe('d1')
  })
  it('failed offers the retry; a 409 no_vision_profile explains and links to settings', async () => {
    const { ApiClientError } = await import('@/api/client')
    vi.mocked(enrichDocument).mockRejectedValue(new ApiClientError('no_vision_profile', 'x', 409))
    view(img({ enrich_status: 'failed' }))
    expect(screen.getByText('Descripciones fallidas')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar descripciones' }))
    expect(await screen.findByText(/Falta un perfil de visión activo/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ir a Configuración' })).toBeTruthy()
  })
  it('skipped image: "Sin perfil de visión" with a link to the providers screen, no retry', () => {
    view(img({ enrich_status: 'skipped' }))
    expect(screen.getByText('Sin perfil de visión')).toBeTruthy()
    expect(screen.getByRole('link', { name: /proveedor de visión/ }).getAttribute('href')).toBe('/settings')
    expect(screen.queryByRole('button', { name: /Reintentar/ })).toBeNull()
  })
  it('renders nothing when ready, or for a text pdf whose stage was skipped', () => {
    const a = view(img({ enrich_status: 'ready' }))
    expect(a.container.textContent).toBe('')
    cleanup()
    const b = view(doc({ enrich_status: 'skipped' }))
    expect(b.container.textContent).toBe('')
  })
})

describe('IngestPanel', () => {
  it('names the stage while processing: "Describiendo imágenes 3/12"', () => {
    const d = img({ status: 'processing', stage: 'describing', progress: { done: 3, total: 12 }, enrich_status: 'running' })
    view(d, <IngestPanel chatId="c" doc={d} />)
    expect(screen.getAllByText('DESCRIBIENDO IMÁGENES 3/12').length).toBe(1) // the panel's own readout; no duplicate strip
  })
})
