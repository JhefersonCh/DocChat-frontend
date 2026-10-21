import { api } from './client'
import type { Chat, UploadResult } from '@/domain/types'

/** POST /chats/{id}/sources: adds a source to the chat (it may already have others). 202; 409 too_many_sources. */
export function addSource(chatId: string, file: File) {
  const fd = new FormData()
  fd.append('file', file)
  return api<UploadResult>(`/chats/${chatId}/sources`, { method: 'POST', body: fd })
}

/** 204. Deletes the document, its chunks and its files; 404 source_not_found. */
export const removeSource = (chatId: string, documentId: string) =>
  api<void>(`/chats/${chatId}/sources/${documentId}`, { method: 'DELETE' })

/** PATCH {active_source_ids}: the chat reads only these sources; the rest are muted. */
export const setActiveSources = (chatId: string, ids: string[]) =>
  api<Chat>(`/chats/${chatId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ active_source_ids: ids }) })
