import type { PageRef } from '@/domain/artifacts'
import { useTrace } from '@/features/conversation/TraceContext'
import { useSources } from '@/features/sources/SourcesContext'
import { useDoc } from './DocContext'

/** Opens `pageRef` in the viewer (highlighting `quote`) through the citation seam. */
export function useOpenPage() {
  const { onCiteSelect } = useTrace()
  const fallback = useDoc()
  const sources = useSources()
  return (pageRef: PageRef, quote: string | null | undefined, origin: Element | null) => {
    const doc = sources.find((s) => s.id === pageRef.document_id) ?? fallback // the item's own source, else the chat's main one
    if (pageRef.page == null || !doc) return
    const { page, chunk_id } = pageRef
    onCiteSelect(
      { n: 0, origin: 'studio', document_id: doc.id, filename: doc.filename, page, snippet: quote ?? '', chunk_id, page_end: page, content: quote ?? null },
      { origin },
    )
  }
}
