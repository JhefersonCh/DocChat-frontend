import { api } from './client'
import type { Compatibility } from '@/domain/compat'

export const getChatCompat = (chatId: string) => api<Compatibility>(`/chats/${chatId}/compatibility`)
export const getProjectCompat = (projectId: string) => api<Compatibility>(`/projects/${projectId}/compatibility`)
export const getSelectionCompat = (documentIds: string[]) =>
  api<Compatibility>('/library/compatibility', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ document_ids: documentIds }) })
