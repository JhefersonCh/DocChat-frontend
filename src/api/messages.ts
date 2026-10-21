import { api } from './client'
import { postSse } from './sse'
import type { Message, Verification } from '@/domain/types'

export const listMessages = (chatId: string) => api<Message[]>(`/chats/${chatId}/messages`)

/** POST + SSE. Pre-stream failures throw ApiClientError; mid-stream ones arrive as `error` events. */
export const askStream = (chatId: string, content: string, signal: AbortSignal, maxPage?: number | null) =>
  postSse(`/chats/${chatId}/messages`, maxPage == null ? { content } : { content, max_page: maxPage }, signal)

/** 200 {sentences, claims}; idempotent (stored). 404 message_not_found, 409 no_chat_profile, 502 invalid_provider_response. */
export const verifyMessage = (chatId: string, messageId: string) =>
  api<Verification>(`/chats/${chatId}/messages/${messageId}/verify`, { method: 'POST' })

/** 200 {questions}; idempotent (the backend stores them). 404 message_not_found, 409 no_chat_profile, provider errors. */
export const getSuggestions = async (chatId: string, messageId: string): Promise<string[]> =>
  (await api<{ questions: string[] }>(`/chats/${chatId}/messages/${messageId}/suggestions`, { method: 'POST' })).questions
