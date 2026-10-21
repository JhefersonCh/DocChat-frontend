import { api } from './client'
import type { SearchResults } from '@/domain/globalSearch'

/** Keyword search over every chat (project chats included). Aborts with the signal when the query changes. */
export const searchAll = (q: string, limit = 20, signal?: AbortSignal) =>
  api<SearchResults>(`/search?${new URLSearchParams({ q, limit: String(limit) }).toString()}`, { signal })
