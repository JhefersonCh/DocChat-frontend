// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { doc } from '@/test/fixtures'
import type { ChatDetail, Citation, Source } from '@/domain/types'
import { TraceContext } from '@/features/conversation/TraceContext'
import { ChatWorkspace } from './ChatWorkspace'

vi.mock('@/features/viewer/DocumentViewer', () => ({
  DocumentViewer: ({ doc: d, autoOpen }: { doc: { id: string }; autoOpen?: boolean }) => <div data-testid="viewer" data-auto={String(!!autoOpen)}>{d.id}</div>,
}))
vi.mock('@/features/conversation/Conversation', () => ({ Conversation: () => <div /> }))
vi.mock('@/features/studio/ChatColumn', () => ({ ChatColumn: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
vi.mock('./ChatSettings', () => ({ ChatSettings: () => null }))
vi.mock('@/features/ingest/ReindexButton', () => ({ ReindexButton: () => null }))
vi.mock('@/features/sources/hooks', () => ({
  useSourcesPolling: (_id: string, sources: Source[]) => ({ sources, error: null, refetch: () => {} }),
  useAddSources: () => ({ mutate: () => {}, isPending: false, error: null }),
  useRemoveSource: () => ({ mutate: () => {}, isPending: false }),
  useSetActiveSources: () => ({ mutate: () => {} }),
}))

afterEach(cleanup)

const src = (id: string, alias: string): Source => ({ ...doc({ id, filename: `${id}.pdf` }), alias, active: true })
const chat: ChatDetail = {
  id: 'chat', title: '2 fuentes', created_at: '2026-10-14T00:00:00Z', document: src('a', 'S1'), sources: [src('a', 'S1'), src('b', 'S2')],
}
const cite = (document_id: string): Citation => ({ n: 1, document_id, filename: 'x', page: 2, snippet: 's', chunk_id: 'c', page_end: null, content: null })

const shown = () => screen.getAllByTestId('viewer').map((v) => v.textContent)

function mount(activeCitation: Citation | null, seq: number) {
  return (
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <TraceContext.Provider value={{ activeCitation, seq, origin: null, onCiteSelect: () => {} }}>
          <ChatWorkspace chat={chat} />
        </TraceContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('ChatWorkspace viewer tabs', () => {
  it('starts on the first ready source and switches with the chips', async () => {
    render(mount(null, 0))
    expect(shown()).toEqual(['a'])
    await userEvent.click(screen.getByRole('button', { name: /^S2 b\.pdf/ }))
    await waitFor(() => expect(shown()).toEqual(['b']))
    expect(screen.getByTestId('viewer').dataset.auto).toBe('false') // chosen by hand: nothing opens by itself
  })

  it("selecting a citation of another source switches to that source's tab", async () => {
    const { rerender } = render(mount(null, 0))
    expect(shown()).toEqual(['a'])
    rerender(mount(cite('b'), 1))
    await waitFor(() => expect(shown()).toEqual(['b']))
    expect(screen.getByTestId('viewer').dataset.auto).toBe('true') // phones open the sheet on the new tab
  })

  it('a citation of the source already open leaves the tab alone; one of a removed source is ignored', async () => {
    const { rerender } = render(mount(null, 0))
    rerender(mount(cite('a'), 1))
    expect(shown()).toEqual(['a'])
    rerender(mount(cite('gone'), 2))
    expect(shown()).toEqual(['a'])
  })
})
