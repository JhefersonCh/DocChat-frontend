import type { Document, Message } from '@/domain/types'

export const doc = (over: Partial<Document> = {}): Document => ({
  id: 'd1', filename: 'a.pdf', status: 'ready', error: null, page_count: 3, created_at: '2026-10-14T00:00:00Z',
  summary: null, suggested_questions: [], summary_status: 'skipped', ...over,
})

export const msg = (over: Partial<Message> = {}): Message => ({
  id: 'm1', role: 'assistant', content: 'hola', created_at: '2026-10-14T00:00:00Z',
  citations: null, searches: null, suggestions: null, ...over,
})
