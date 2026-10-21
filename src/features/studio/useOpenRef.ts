import type { SlideRef } from '@/domain/artifacts'
import { useTrace } from '@/features/conversation/TraceContext'
import { useSources } from '@/features/sources/SourcesContext'
import { useDoc } from './DocContext'

/** Opens a slide's verified quote in the viewer (page or time), switching to its source in multi-source chats. */
export function useOpenRef() {
  const { onCiteSelect } = useTrace()
  const fallback = useDoc()
  const sources = useSources()
  return (ref: SlideRef, origin: Element | null) => {
    const doc = sources.find((s) => s.id === ref.document_id) ?? fallback
    if (!doc) return
    onCiteSelect(
      {
        n: 0, origin: 'studio', document_id: doc.id, filename: doc.filename, page: ref.page, snippet: ref.quote, chunk_id: ref.chunk_id,
        page_end: ref.page, content: ref.quote, kind: ref.kind === 'image' ? 'image' : ref.kind, t_start: ref.t_start, t_end: ref.t_end, bbox: ref.bbox ?? null, source_kind: doc.kind ?? null,
      },
      { origin },
    )
  }
}

/** Alias of a source to label refs with: only in chats with several sources. */
export function useAliasOf() {
  const sources = useSources()
  return (id: string | null) => (sources.length > 1 ? (sources.find((s) => s.id === id)?.alias ?? null) : null)
}
