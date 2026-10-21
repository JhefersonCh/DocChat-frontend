// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { deleteNote, listNotes, saveNote } from '@/api/notes'
import { TraceContext } from '@/features/conversation/TraceContext'
import { downloadText } from '@/ui/download'
import { doc } from '@/test/fixtures'
import type { Citation, Note } from '@/domain/types'
import { NotesPanel } from './NotesPanel'
import { SaveNoteButton } from './SaveNoteButton'

vi.mock('@/api/notes', async (orig) => ({ ...(await orig<typeof import('@/api/notes')>()), listNotes: vi.fn(), saveNote: vi.fn(), deleteNote: vi.fn(), renameNote: vi.fn() }))
vi.mock('@/ui/download', () => ({ downloadText: vi.fn() }))

const cite: Citation = { n: 1, document_id: 'd1', filename: 'a.pdf', page: 3, snippet: 'El plazo', chunk_id: 'c1', page_end: null, content: 'El plazo es 30', section: null }
const note = (over: Partial<Note> = {}): Note => ({ id: 'n1', message_id: 'm1', title: 'Plazo', content: 'Son 30 días [1].', citations: [cite], created_at: '2026-10-14T00:00:00Z', ...over })

afterEach(() => { cleanup(); vi.clearAllMocks() })

function wrap(ui: ReactNode, onCiteSelect = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TraceContext.Provider value={{ activeCitation: null, seq: 0, origin: null, onCiteSelect }}>{ui}</TraceContext.Provider>
    </QueryClientProvider>,
  )
  return onCiteSelect
}

describe('SaveNoteButton', () => {
  it('saves the answer, then shows the saved state and does not save twice', async () => {
    vi.mocked(listNotes).mockResolvedValueOnce([])
    vi.mocked(saveNote).mockResolvedValue(note())
    wrap(<SaveNoteButton chatId="c" messageId="m1" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar nota' }))
    expect(saveNote).toHaveBeenCalledWith('c', 'm1')
    expect(await screen.findByText('Guardada')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Guardada/ }).hasAttribute('disabled')).toBe(true)
  })

  it('starts saved when a note already exists for the answer', async () => {
    vi.mocked(listNotes).mockResolvedValue([note()])
    wrap(<SaveNoteButton chatId="c" messageId="m1" />)
    expect(await screen.findByText('Guardada')).toBeTruthy()
  })
})

describe('NotesPanel', () => {
  it('lists notes with working citation chips and exports them as markdown', async () => {
    vi.mocked(listNotes).mockResolvedValue([note()])
    const onCiteSelect = wrap(<NotesPanel chatId="c" chatTitle="Contrato" doc={doc()} />)
    expect(await screen.findByText('Plazo')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /Cita 1/ }))
    expect(onCiteSelect).toHaveBeenCalledWith(expect.objectContaining({ n: 1, page: 3, content: 'El plazo es 30' }), expect.anything())
    await userEvent.click(screen.getByRole('button', { name: /Exportar/ }))
    expect(downloadText).toHaveBeenCalledWith('a.md', expect.stringContaining('## Plazo'))
  })

  it('shows an empty hint, and deleting calls the API', async () => {
    vi.mocked(listNotes).mockResolvedValueOnce([])
    wrap(<NotesPanel chatId="c" chatTitle="" doc={null} />)
    expect(await screen.findByText(/Todavía no guardaste notas/)).toBeTruthy()
    cleanup()
    vi.mocked(listNotes).mockResolvedValue([note()])
    vi.mocked(deleteNote).mockResolvedValue(undefined)
    wrap(<NotesPanel chatId="c" chatTitle="" doc={null} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar nota' }))
    await waitFor(() => expect(deleteNote).toHaveBeenCalledWith('c', 'n1'))
  })
})
