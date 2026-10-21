// Global search over every chat (GET /api/v1/search): types + pure helpers. No React.
// Mirror of the backend rules (domain/chat_search.py): keyword terms, accent/case-insensitive substrings.
import type { ISODate, UUID } from './types'

export type Span = [number, number]

export interface MessageHit {
  message_id: UUID
  chat_id: UUID
  chat_title: string
  project_id: UUID | null
  project_name: string | null
  role: 'user' | 'assistant'
  created_at: ISODate
  snippet: string
  highlights: Span[]
}
export interface ChatHit { chat_id: UUID; title: string; project_id: UUID | null; project_name: string | null; created_at: ISODate; highlights: Span[] }
export interface ProjectHit { project_id: UUID; name: string; created_at: ISODate; highlights: Span[] }
export interface SourceHit { document_id: UUID; filename: string; chat_id: UUID | null; project_id: UUID | null; highlights: Span[] }

export interface SearchResults {
  messages: MessageHit[]
  chats: ChatHit[]
  projects: ProjectHit[]
  sources: SourceHit[]
}

export type Hit =
  | { kind: 'message'; hit: MessageHit }
  | { kind: 'chat'; hit: ChatHit }
  | { kind: 'project'; hit: ProjectHit }
  | { kind: 'source'; hit: SourceHit }

/** Result groups in display order ("Mensajes" first: it is what people look for). */
export function flattenResults(r: SearchResults | undefined): { label: string; items: Hit[] }[] {
  if (!r) return []
  return [
    { label: 'Mensajes', items: r.messages.map((hit) => ({ kind: 'message', hit }) as Hit) },
    { label: 'Chats', items: r.chats.map((hit) => ({ kind: 'chat', hit }) as Hit) },
    { label: 'Proyectos', items: r.projects.map((hit) => ({ kind: 'project', hit }) as Hit) },
    { label: 'Fuentes', items: r.sources.map((hit) => ({ kind: 'source', hit }) as Hit) },
  ].filter((g) => g.items.length > 0)
}

/** Lower-case without accents; same length as the input so offsets stay valid. */
export function fold(text: string): string {
  let out = ''
  for (const ch of text) {
    const f = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    out += f.length === ch.length ? f : ch.toLowerCase().length === ch.length ? ch.toLowerCase() : ch
  }
  return out
}

/** Folded terms: a "quoted phrase" is one term, the rest split on whitespace (max 8). */
export function parseTerms(q: string): string[] {
  const terms: string[] = []
  for (const m of q.matchAll(/"([^"]+)"|(\S+)/g)) {
    const term = fold(m[1] ?? m[2] ?? '').replace(/\s+/g, ' ').replace(/"/g, '').trim()
    if (term && !terms.includes(term)) terms.push(term)
  }
  return terms.slice(0, 8)
}

/** Merged [start, end) ranges of every occurrence of every term in `text`. */
export function findRanges(text: string, terms: string[]): Span[] {
  const folded = fold(text)
  const spans: Span[] = []
  for (const t of terms) {
    for (let i = folded.indexOf(t); i !== -1; i = folded.indexOf(t, i + 1)) spans.push([i, i + t.length])
  }
  spans.sort((a, b) => a[0] - b[0])
  const merged: Span[] = []
  for (const s of spans) {
    const last = merged[merged.length - 1]
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1])
    else merged.push([s[0], s[1]])
  }
  return merged
}

export interface Piece { text: string; mark: boolean }

/** Cuts `text` into plain / highlighted pieces; ranges are clamped and may arrive unsorted. */
export function splitHighlights(text: string, spans: Span[]): Piece[] {
  const pieces: Piece[] = []
  let at = 0
  for (const [s0, e0] of [...spans].sort((a, b) => a[0] - b[0])) {
    const s = Math.max(s0, at)
    const e = Math.min(e0, text.length)
    if (e <= s) continue
    if (s > at) pieces.push({ text: text.slice(at, s), mark: false })
    pieces.push({ text: text.slice(s, e), mark: true })
    at = e
  }
  if (at < text.length) pieces.push({ text: text.slice(at), mark: false })
  return pieces
}

/** Where a result goes. A message arrives as `?msg=&hl=` so the chat can scroll to it and mark the match. */
export function hitLink(h: Hit, query = ''): string {
  switch (h.kind) {
    case 'message': {
      const q = new URLSearchParams({ msg: h.hit.message_id })
      if (query.trim()) q.set('hl', query.trim())
      return `/chats/${h.hit.chat_id}?${q.toString()}`
    }
    case 'chat': return `/chats/${h.hit.chat_id}`
    case 'project': return `/projects/${h.hit.project_id}`
    case 'source':
      if (h.hit.project_id) return `/projects/${h.hit.project_id}`
      return h.hit.chat_id ? `/chats/${h.hit.chat_id}` : '/library'
  }
}

export const hitKey = (h: Hit): string => {
  switch (h.kind) {
    case 'message': return `m:${h.hit.message_id}`
    case 'chat': return `c:${h.hit.chat_id}`
    case 'project': return `p:${h.hit.project_id}`
    case 'source': return `s:${h.hit.document_id}`
  }
}

// --- Recent searches (localStorage; every access may throw: private mode, blocked storage) ---
export const RECENT_KEY = 'search:recent'
export const RECENT_MAX = 6

/** `query` first, no duplicates (case-insensitive), at most RECENT_MAX. */
export function pushRecent(list: string[], query: string): string[] {
  const q = query.trim()
  if (q.length < 2) return list
  return [q, ...list.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, RECENT_MAX)
}

export function loadRecent(): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string').slice(0, RECENT_MAX) : []
  } catch { return [] }
}

export function saveRecent(list: string[]): void {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)) } catch { /* not persisted: fine */ }
}

const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto', style: 'narrow' })

/** "hace 5 min", "hace 3 h", "ayer", "hace 4 d", then a short date. */
export function relativeDate(iso: string, now = Date.now()): string {
  const min = Math.round((new Date(iso).getTime() - now) / 60000)
  if (min > -1) return 'ahora'
  if (min > -60) return rtf.format(min, 'minute')
  if (min > -1440) return rtf.format(Math.round(min / 60), 'hour')
  if (min > -1440 * 7) return rtf.format(Math.round(min / 1440), 'day')
  return new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
}
