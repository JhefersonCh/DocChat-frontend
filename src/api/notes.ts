import { api } from './client'
import type { Note } from '@/domain/types'

export const noteKeys = { list: (chatId: string) => ['notes', chatId] as const }

const json = { 'content-type': 'application/json' }

export const listNotes = (chatId: string) => api<Note[]>(`/chats/${chatId}/notes`)

/** 201 Note. Saving the same answer twice returns the existing note. 404 chat_not_found / message_not_found. */
export const saveNote = (chatId: string, messageId: string, title?: string) =>
  api<Note>(`/chats/${chatId}/notes`, { method: 'POST', headers: json, body: JSON.stringify({ message_id: messageId, title }) })

export const renameNote = (chatId: string, id: string, title: string) =>
  api<Note>(`/chats/${chatId}/notes/${id}`, { method: 'PATCH', headers: json, body: JSON.stringify({ title }) })

export const deleteNote = (chatId: string, id: string) => api<void>(`/chats/${chatId}/notes/${id}`, { method: 'DELETE' })
