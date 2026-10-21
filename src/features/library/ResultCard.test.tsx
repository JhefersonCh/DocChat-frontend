// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import type { SearchResult } from '@/domain/library'
import { ResultCard } from './ResultCard'

const result: SearchResult = {
  score: 0.62, relevant: true, doc_score: 0.5,
  document: {
    id: 'd1', filename: 'presupuesto.txt', kind: 'text', status: 'ready', mime: 'text/plain', created_at: '2026-10-19T00:00:00Z', page_count: null,
    duration_s: null, summary: null, project_id: 'p1', project_name: 'Café', chat_id: 'chat1', chat_title: 'Café', has_vector: true,
    categories: [{ id: 'k1', name: 'Finanzas', origin: 'user', color: null }],
  },
  hits: [{ chunk_id: 'c1', kind: 'text', page: 2, page_end: null, t_start: null, t_end: null, bbox: null, has_thumb: false, snippet: 'El presupuesto total asciende a 120 millones', score: 0.7 }],
}

afterEach(cleanup)

describe('ResultCard', () => {
  it('shows the score, the project and a link that opens the chat at the passage', () => {
    render(<MemoryRouter><ResultCard rank={1} result={result} selected={false} onToggle={() => {}} /></MemoryRouter>)
    expect(screen.getByRole('img', { name: 'Relevancia 62%' })).toBeTruthy()
    expect(screen.getByText('Café')).toBeTruthy()
    expect(screen.getByText('Finanzas')).toBeTruthy()
    const open = screen.getByRole('link', { name: /Abrir presupuesto.txt pág. 2/ })
    expect(open.getAttribute('href')).toContain('/chats/chat1?doc=d1')
    expect(open.getAttribute('href')).toContain('page=2')
  })
})
