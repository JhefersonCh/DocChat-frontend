import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listMessages, verifyMessage } from '@/api/messages'
import { keys } from '@/api/queryKeys'
import type { Message } from '@/domain/types'

export const useMessages = (chatId: string) =>
  useQuery({ queryKey: keys.messages(chatId), queryFn: () => listMessages(chatId) })

/** POST .../verify; the result is stored by the backend, so it also lands in the cached message list. */
export function useVerify(chatId: string, messageId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => verifyMessage(chatId, messageId),
    onSuccess: (v) => qc.setQueryData<Message[]>(keys.messages(chatId), (old) => old?.map((m) => (m.id === messageId ? { ...m, verification: v } : m))),
  })
}
