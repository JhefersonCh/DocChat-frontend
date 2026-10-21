import { api } from './client'
import type { Chat, ChatDetail, ChatSettings } from '@/domain/types'

export const listChats = () => api<Chat[]>('/chats')
export const createChat = () => api<Chat>('/chats', { method: 'POST' })
export const getChat = (id: string) => api<ChatDetail>(`/chats/${id}`)
export const updateChatSettings = (id: string, changes: Partial<ChatSettings>) =>
  api<Chat>(`/chats/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(changes) })
export const setChatPinned = (id: string, pinned: boolean) =>
  api<Chat>(`/chats/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pinned }) })
export const deleteChat = (id: string) => api<void>(`/chats/${id}`, { method: 'DELETE' })
