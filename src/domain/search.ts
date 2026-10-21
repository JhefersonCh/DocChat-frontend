import type { Citation, Document, SearchHit } from './types'

/** A search hit as a citation: the viewer's trace (jump + highlight) only knows citations. `origin: 'search'` marks it as not an answer source. */
export const hitToCitation = (hit: SearchHit, doc: Pick<Document, 'id' | 'filename' | 'kind'>): Citation => ({
  n: 0,
  origin: 'search',
  document_id: doc.id,
  filename: doc.filename,
  page: hit.page_start,
  page_end: hit.page_end,
  snippet: hit.snippet,
  chunk_id: hit.chunk_id,
  content: hit.content,
  section: hit.section,
  score: hit.score,
  ...(hit.kind && hit.kind !== 'text' ? { kind: hit.kind, bbox: hit.bbox ?? null, t_start: hit.t_start ?? null, t_end: hit.t_end ?? null, has_thumb: hit.has_thumb, source_kind: doc.kind ?? null } : {}),
})
