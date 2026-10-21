// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Artifact } from '@/domain/artifacts'
import { TraceContext } from '@/features/conversation/TraceContext'
import { doc } from '@/test/fixtures'
import { GraphView } from './GraphView'
import { DocContext } from './DocContext'
import { QuizView } from './QuizView'
import { TimelineView } from './TimelineView'
import { StudioPanel } from './StudioPanel'

const api = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), remove: vi.fn() }))
vi.mock('@/api/artifacts', () => ({
  artifactKeys: { list: (id: string) => ['artifacts', id] },
  listArtifacts: api.list, createArtifact: api.create, deleteArtifact: api.remove,
}))

afterEach(() => { cleanup(); vi.clearAllMocks() })
const ref = { page: 3, chunk_id: 'c1' }
const art = (over: Partial<Artifact>): Artifact => ({ id: 'a1', kind: 'faq', status: 'ready', options: {}, data: null, error: null, created_at: '2026-10-14T00:00:00Z', ...over })
const wrap = (ui: React.ReactElement, onCiteSelect = vi.fn()) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <TraceContext.Provider value={{ activeCitation: null, seq: 0, origin: null, onCiteSelect }}>{ui}</TraceContext.Provider>
    </QueryClientProvider>,
  )
}

describe('Estudio', () => {
  it('quiz: locks an answered question, shows explanation and the running score', async () => {
    const data = { questions: [{ question: '¿Q?', options: ['a', 'b', 'c', 'd'], answer_index: 1, explanation: 'Porque sí.', ...ref }] }
    wrap(<QuizView data={data} />)
    await userEvent.click(screen.getByRole('button', { name: 'a' }))
    expect(screen.getByText(/Incorrecto: era B\. Porque sí\./)).toBeTruthy()
    expect(screen.getByText('Puntaje final: 0 de 1')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'b' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('panel: lists artifacts, a page link opens the page through the trace seam', async () => {
    const faq = { items: [{ question: '¿Plazo?', answer: '30 días.', ...ref }] }
    api.list.mockResolvedValue([art({ data: faq })])
    const onCite = vi.fn()
    wrap(<StudioPanel chatId="c" doc={doc()} goToSettings={() => {}} />, onCite)
    await userEvent.click(await screen.findByRole('button', { name: /Preguntas frecuentes/, expanded: false }))
    await userEvent.click(await screen.findByRole('button', { name: 'Ir a la página 3' }))
    expect(onCite).toHaveBeenCalledWith(expect.objectContaining({ page: 3, chunk_id: 'c1', document_id: 'd1' }), expect.anything())
  })

  it('panel: extraction asks for columns, then creates the artifact with them', async () => {
    api.list.mockResolvedValue([])
    api.create.mockResolvedValue(art({ id: 'a2', kind: 'extraction', status: 'pending' }))
    wrap(<StudioPanel chatId="c" doc={doc()} goToSettings={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: /Extracción/ }))
    const generate = screen.getByRole('button', { name: 'Generar' }) as HTMLButtonElement
    expect(generate.disabled).toBe(true)
    await userEvent.type(screen.getByLabelText(/Columnas/), 'Nombre, Monto')
    await userEvent.click(generate)
    await waitFor(() => expect(api.create).toHaveBeenCalledWith('c', 'extraction', { columns: ['Nombre', 'Monto'] }))
  })

  it('panel: kinds are disabled until the document is ready', async () => {
    api.list.mockResolvedValue([])
    wrap(<StudioPanel chatId="c" doc={doc({ status: 'processing' })} goToSettings={() => {}} />)
    expect((await screen.findByRole('button', { name: /Cuestionario/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('grafo: clicking a node shows its card with an ask action; clicking an edge opens its quote', async () => {
    const data = {
      entities: [
        { id: 'e1', name: 'Ana', type: 'persona' as const, description: 'La fundadora', aliases: [], ...ref },
        { id: 'e2', name: 'Acme', type: 'organización' as const, description: '', aliases: [], page: null, chunk_id: null },
      ],
      relations: [{ source: 'e1', target: 'e2', label: 'fundó', quote: 'Ana fundó Acme', ...ref }],
    }
    const onCite = vi.fn()
    wrap(<DocContext.Provider value={doc()}><GraphView data={data} /></DocContext.Provider>, onCite)
    await userEvent.click(screen.getByRole('button', { name: 'Ana (persona)' }))
    expect(screen.getByText('La fundadora')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Preguntar sobre Ana/ })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /Relación: Ana fundó Acme/ }))
    expect(onCite).toHaveBeenCalledWith(expect.objectContaining({ page: 3, snippet: 'Ana fundó Acme' }), expect.anything())
  })

  it('línea de tiempo: renders events in order, click opens the quote; empty shows the message', async () => {
    const events = [
      { date_text: '1909', date_iso: '1909', title: 'Fundación', description: '', quote: 'En 1909 se fundó', ...ref },
      { date_text: 'marzo de 2025', date_iso: '2025-03', title: 'Inauguración', description: 'Planta', quote: 'marzo de 2025', page: 5, chunk_id: 'c2' },
    ]
    const onCite = vi.fn()
    wrap(<DocContext.Provider value={doc()}><TimelineView data={{ events, ordered_by: 'date' }} /></DocContext.Provider>, onCite)
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)[0]).toContain('Fundación')
    await userEvent.click(screen.getByRole('button', { name: '1909: Fundación' }))
    expect(onCite).toHaveBeenCalledWith(expect.objectContaining({ page: 3, snippet: 'En 1909 se fundó' }), expect.anything())
    cleanup()
    wrap(<TimelineView data={{ events: [], ordered_by: null, message: 'Sin contenido temporal.' }} />)
    expect(screen.getByText('Sin contenido temporal.')).toBeTruthy()
  })
})
