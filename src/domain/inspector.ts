import { chunkMedia } from './media'
import type { ChunkInfo, Citation, Document } from './types'

export interface PageGroup { page: number | null; chunks: ChunkInfo[] }

/** Chunks (reading order) grouped by the page they start on; consecutive, so the order is kept. */
export function groupByPage(chunks: ChunkInfo[]): PageGroup[] {
  const groups: PageGroup[] = []
  for (const c of chunks) {
    const last = groups[groups.length - 1]
    if (last && last.page === c.page_start) last.chunks.push(c)
    else groups.push({ page: c.page_start, chunks: [c] })
  }
  return groups
}

/** A chunk as a citation: the viewer's trace (jump + highlight) only knows citations. */
export const chunkToCitation = (c: ChunkInfo, doc: Pick<Document, 'id' | 'filename' | 'kind'>): Citation => ({
  n: 0,
  origin: 'inspector',
  document_id: doc.id,
  filename: doc.filename,
  page: c.page_start,
  page_end: c.page_end,
  snippet: c.content.replace(/\s+/g, ' ').trim().slice(0, 160),
  chunk_id: c.chunk_id,
  content: c.content,
  section: c.section,
  ...chunkMedia(c, doc),
})

/** Where a chunk starts and ends (whitespace collapsed); `tail` is null when it fits in `head` whole. */
export function boundary(content: string, edge = 48): { head: string; tail: string | null } {
  const text = content.replace(/\s+/g, ' ').trim()
  if (text.length <= edge * 2) return { head: text, tail: null }
  return { head: `${text.slice(0, edge)}…`, tail: `…${text.slice(-edge)}` }
}
