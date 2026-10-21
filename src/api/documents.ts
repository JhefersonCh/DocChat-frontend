import { API_BASE, api, request, toApiError } from './client'
import type { ChunkInfo, ChunkPage, Document, DocumentSearchResult, UploadResult } from '@/domain/types'

/** FormData: the browser sets the multipart boundary; never set content-type by hand. */
export function uploadDocument(chatId: string, file: File) {
  const fd = new FormData()
  fd.append('file', file)
  return api<UploadResult>(`/chats/${chatId}/documents`, { method: 'POST', body: fd })
}

/** 202 {document_id, status:'processing'}; 404 document_not_found / file_not_found; 409 document_busy. */
export const reindexDocument = (id: string) =>
  api<UploadResult>(`/documents/${id}/reindex`, { method: 'POST' })

/** 202; 404 document_not_found; 409 document_not_busy. The document ends `failed` ("Ingesta cancelada"). */
export const cancelIngest = (id: string) => api<unknown>(`/documents/${id}/cancel`, { method: 'POST' })

export const getDocument = (id: string) => api<Document>(`/documents/${id}`)

/** URL of the original file (pdf.js fetches it itself). */
export const documentFileUrl = (id: string) => `${API_BASE}/documents/${id}/file`

/** Hybrid search inside one document (no LLM). 404 document_not_found; 409 document_not_ready. */
export const searchDocument = (id: string, q: string, k = 10, signal?: AbortSignal) =>
  api<DocumentSearchResult>(`/documents/${id}/search?${new URLSearchParams({ q, k: String(k) })}`, { signal })

/** Original file of a TXT/MD document, as text. */
export async function getDocumentText(id: string): Promise<string> {
  const res = await request(`/documents/${id}/file`)
  if (!res.ok) throw await toApiError(res)
  return res.text()
}

/** 202 regenerates the summary; 404 document_not_found; 409 document_busy / no_chat_profile. */
export async function regenerateSummary(id: string): Promise<void> {
  const res = await request(`/documents/${id}/summary`, { method: 'POST' })
  if (!res.ok) throw await toApiError(res) // the 202 body (if any) is not needed: the poll brings the state
}

const CHUNK_PAGE = 500

/** Every chunk of the document in reading order (GET /documents/{id}/chunks, paged until `total`). 404 document_not_found. */
export async function listChunks(id: string): Promise<ChunkInfo[]> {
  const all: ChunkInfo[] = []
  for (;;) {
    const page = await api<ChunkPage>(`/documents/${id}/chunks?${new URLSearchParams({ offset: String(all.length), limit: String(CHUNK_PAGE) })}`)
    all.push(...page.items)
    if (page.items.length === 0 || all.length >= page.total) return all
  }
}
