// Multi-source chats (phase 7): pure helpers over a chat's sources. No React.
import { progressInfo } from './ingest'
import type { ChatDetail, Citation, Document, Source, SourceKind } from './types'

export const MAX_SOURCES = 12

/** The chat's sources in order. A payload from before phase 7 only has `document`: it is S1. */
export function sourcesOf(chat: Pick<ChatDetail, 'sources' | 'document' | 'disabled_sources'> | null | undefined): Source[] {
  if (!chat) return []
  if (chat.sources) return chat.sources
  const muted = new Set(chat.disabled_sources ?? [])
  return chat.document ? [{ ...chat.document, alias: 'S1', active: !muted.has(chat.document.id) }] : []
}

/** Same sources with the freshest version of each document (polling is fresher than the chat payload). */
export function mergeFresh(sources: Source[], fresh: Record<string, Document | undefined>): Source[] {
  return sources.map((s) => (fresh[s.id] ? { ...fresh[s.id]!, alias: s.alias, active: s.active } : s))
}

export const isReady = (s: Pick<Document, 'status'>) => s.status === 'ready'

/** Sources a question would read: ready and not muted. */
export const readable = (sources: Source[]) => sources.filter((s) => isReady(s) && s.active)

/** The source a citation points to (by document id), if it is still in the chat. */
export const sourceOfCitation = (sources: readonly Source[], c: Pick<Citation, 'document_id'>) =>
  sources.find((s) => s.id === c.document_id) ?? null

/**
 * Alias shown on a citation: only in multi-source chats. The CURRENT alias of the source wins (removing S1
 * renumbers the rest); the alias persisted with the citation is the fallback for sources that are gone.
 */
export function citationAlias(sources: readonly Source[], c: Pick<Citation, 'document_id' | 'source_alias'>): string | null {
  if (sources.length < 2) return null
  return sourceOfCitation(sources, c)?.alias ?? c.source_alias ?? null
}

/** `S2 · pág. 3` : the alias in front of the locator (just the locator when there is no alias). */
export const withAlias = (alias: string | null, where: string | null | undefined) => [alias, where].filter(Boolean).join(' · ')

/**
 * Tab to show when a citation is selected: the citation's own source when it is in the chat,
 * otherwise the tab stays where it is. `null` = no change.
 */
export function tabForCitation(sources: readonly Source[], current: string | null, c: Pick<Citation, 'document_id'> | null): string | null {
  if (!c) return null
  const target = sourceOfCitation(sources, c)
  return target && target.id !== current ? target.id : null
}

/** Tab to keep selected: the current one if it still exists, else the first ready source, else the first. */
export function resolveTab(sources: readonly Source[], current: string | null): string | null {
  if (current && sources.some((s) => s.id === current)) return current
  return (sources.find(isReady) ?? sources[0])?.id ?? null
}

/** Active ids after toggling `id` (the chat keeps at least one source on). */
export function toggleActive(sources: readonly Source[], id: string): string[] | null {
  const next = sources.filter((s) => (s.id === id ? !s.active : s.active)).map((s) => s.id)
  return next.length === 0 ? null : next
}

export const KIND_ICON: Record<SourceKind, string> = { pdf: '▤', text: '≡', image: '▣', audio: '♪', video: '▶' }
export const KIND_LABEL: Record<SourceKind, string> = { pdf: 'PDF', text: 'Texto', image: 'Imagen', audio: 'Audio', video: 'Video' }
export const kindOf = (s: Pick<Document, 'kind' | 'filename'>): SourceKind => s.kind ?? (/\.pdf$/i.test(s.filename) ? 'pdf' : 'text')

/** One-line state of a source for its chip: progress while ingesting, "falló", enrichment, or null when quiet. */
export function sourceStatus(s: Document): string | null {
  if (s.status === 'failed') return 'falló'
  if (s.status === 'pending') return 'en cola'
  if (s.status === 'processing') return progressInfo(s.progress, s.stage, s.kind)?.label ?? 'procesando'
  if (s.enrich_status === 'running') return progressInfo(s.progress, s.stage, s.kind)?.label ?? 'describiendo'
  if (s.enrich_status === 'pending') return 'descripciones en cola'
  return null
}

/** Chat heading: the source's name, or "N fuentes" (mirrors the backend's title rule for the optimistic UI). */
export const sourcesTitle = (names: readonly string[]) => (names.length === 0 ? '' : names.length === 1 ? names[0]! : `${names.length} fuentes`)
