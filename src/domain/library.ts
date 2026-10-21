// Projects, categories and the library (global concept search): types + pure helpers. No React.
// Mirror of backend/docs/frontend-api.md "Proyectos, categorías y biblioteca".
import { formatRange } from './time'
import type { Chat, Citation, CitationKind, CollectionOverview, ISODate, Source, SourceKind, UUID } from './types'

export interface Project {
  id: UUID
  name: string
  description: string | null
  color: string | null
  icon: string | null
  created_at: ISODate
  source_count: number
  ready_count: number
  chat_count: number
  /** When the project was pinned in the sidebar; null / absent = not pinned. */
  pinned_at?: ISODate | null
}

export interface ProjectDetail extends Project {
  /** S1..Sn: the same aliases every chat of the project uses. */
  sources: Source[]
  chats: Chat[]
  overview: CollectionOverview | null
}

export interface ProjectIn {
  name: string
  description?: string | null
  color?: string | null
  icon?: string | null
}

export type CategoryOrigin = 'user' | 'auto'

export interface Category {
  id: UUID
  name: string
  origin: CategoryOrigin
  color: string | null
  doc_count: number
  created_at: ISODate
}

export interface CategoryRef {
  id: UUID
  name: string
  origin: CategoryOrigin // of the assignment
  color: string | null
}

export interface LibraryDoc {
  id: UUID
  filename: string
  kind: SourceKind
  status: 'pending' | 'processing' | 'ready' | 'failed'
  mime: string
  created_at: ISODate
  page_count: number | null
  duration_s: number | null
  summary: string | null
  project_id: UUID | null
  project_name: string | null
  chat_id: UUID | null
  chat_title: string | null
  has_vector: boolean
  categories: CategoryRef[]
}

export interface DocHit {
  chunk_id: UUID | null
  kind: CitationKind
  page: number | null
  page_end: number | null
  t_start: number | null
  t_end: number | null
  bbox: [number, number, number, number] | null
  has_thumb: boolean
  snippet: string
  score: number | null
}

export interface SearchResult {
  document: LibraryDoc
  score: number // 0..1
  relevant: boolean
  doc_score: number | null
  hits: DocHit[]
}

export interface LibrarySearch {
  query: string
  results: SearchResult[]
  searched: number
  skipped_unready: number
  skipped_profiles: number
  notes: string[]
}

export interface LibraryFilters {
  kind?: SourceKind | null
  category_id?: UUID | null
  project_id?: UUID | null
  uncategorized?: boolean
}

export interface AutoCategorizeResult {
  categories: { id: UUID; name: string; doc_count: number }[]
  clustered: number
  skipped_incompatible: number
  skipped_without_vector: number
  named_by_model: boolean
  note: string | null
}

export interface AskGroupResult {
  chat_id: UUID
  project_id: UUID | null
  document_ids: UUID[]
}

/** Amber first, then quiet hues that sit on the dark lab surface. */
export const CATEGORY_COLORS = ['#FFB000', '#7FB3D5', '#8FD19E', '#E08E79', '#B39DDB', '#D4C16B', '#6FC7C0', '#E58FB0'] as const

/** Stable color for a category without one (auto ones): hashed from the name. */
export function categoryColor(c: Pick<Category | CategoryRef, 'name' | 'color'>): string {
  if (c.color) return c.color
  let h = 0
  for (const ch of c.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return CATEGORY_COLORS[h % CATEGORY_COLORS.length]!
}

/** Where a hit sits, for humans: "pág. 3", "pág. 3–4", "01:20–01:40" or "" when it has no locator. */
export function hitLocator(h: Pick<DocHit, 'kind' | 'page' | 'page_end' | 't_start' | 't_end'>): string {
  if (h.t_start != null) return formatRange(h.t_start, h.t_end)
  if (h.page == null) return ''
  return h.page_end != null && h.page_end !== h.page ? `pág. ${h.page}–${h.page_end}` : `pág. ${h.page}`
}

/** A synthetic citation for a hit: what the chat's viewer needs to open the source at that spot. */
export function citationFromHit(doc: Pick<LibraryDoc, 'id' | 'filename' | 'kind'>, h: DocHit): Citation {
  return {
    n: 0, origin: 'search', document_id: doc.id, filename: doc.filename, page: h.page, snippet: h.snippet,
    chunk_id: h.chunk_id, page_end: h.page_end, content: h.snippet, score: h.score, kind: h.kind,
    bbox: h.bbox, t_start: h.t_start, t_end: h.t_end, has_thumb: h.has_thumb, source_kind: doc.kind,
  }
}

/** Where a document opens: its chat (or its project's first one) with the hit as `?cite=`; null without a chat. */
export function openLink(doc: Pick<LibraryDoc, 'chat_id' | 'id'>, hit?: DocHit | null): string | null {
  if (!doc.chat_id) return null
  const q = new URLSearchParams({ doc: doc.id })
  if (hit) {
    if (hit.chunk_id) q.set('chunk', hit.chunk_id)
    if (hit.page != null) q.set('page', String(hit.page))
    if (hit.t_start != null) q.set('t', String(hit.t_start))
    if (hit.t_end != null) q.set('te', String(hit.t_end))
    q.set('k', hit.kind)
    if (hit.snippet) q.set('s', hit.snippet.slice(0, 160))
  }
  return `/chats/${doc.chat_id}?${q.toString()}`
}

/** Inverse of `openLink`: the citation the URL asks to open, or null when it carries none. */
export function citationFromParams(params: URLSearchParams, sources: readonly Pick<Source, 'id' | 'filename' | 'kind'>[]): Citation | null {
  const id = params.get('doc')
  const doc = id ? sources.find((s) => s.id === id) : null
  if (!doc) return null
  const num = (k: string) => (params.has(k) && Number.isFinite(Number(params.get(k))) ? Number(params.get(k)) : null)
  const kind = (['text', 'image', 'audio', 'video'] as const).find((k) => k === params.get('k')) ?? 'text'
  return citationFromHit(
    { id: doc.id, filename: doc.filename, kind: doc.kind ?? 'text' },
    {
      chunk_id: params.get('chunk'), kind, page: num('page'), page_end: null, t_start: num('t'), t_end: num('te'),
      bbox: null, has_thumb: false, snippet: params.get('s') ?? '', score: null,
    },
  )
}

/** Query-string keys the deep link uses (removed once the viewer has jumped). */
export const LINK_KEYS = ['doc', 'chunk', 'page', 't', 'te', 'k', 's'] as const

/** Score as a short percentage for the result bar. */
export const scorePct = (s: number) => `${Math.round(Math.max(0, Math.min(1, s)) * 100)}%`
