import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createChat, deleteChat, getChat, listChats, setChatPinned, updateChatSettings } from '@/api/chats'
import { keys } from '@/api/queryKeys'
import { optimisticPin } from '@/app/sidebarSection'
import type { Chat, ChatDetail, ChatSettings } from '@/domain/types'

export const useChats = () => useQuery({ queryKey: keys.chats, queryFn: listChats })

export const useChat = (id: string) =>
  useQuery({ queryKey: keys.chat(id), queryFn: () => getChat(id), retry: false })

export function useCreateChat() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createChat,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.chats }),
  })
}

export function useDeleteChat() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteChat,
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: keys.chat(id) })
      return qc.invalidateQueries({ queryKey: keys.chats })
    },
  })
}

/** Persists the chat's answer style / length; the cached chat takes the server's values. */
export function useUpdateChatSettings(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (changes: Partial<ChatSettings>) => updateChatSettings(id, changes),
    onSuccess: (chat) => qc.setQueryData<ChatDetail>(keys.chat(id), (old) => (old ? { ...old, ...chat } : old)),
  })
}

/** Pin / unpin a loose chat in the sidebar: the list reorders at once and rolls back on error. */
export function usePinChat() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; pinned: boolean }) => setChatPinned(v.id, v.pinned),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: keys.chats })
      const prev = qc.getQueryData<Chat[]>(keys.chats)
      qc.setQueryData<Chat[]>(keys.chats, (old) => old && optimisticPin(old, v.id, v.pinned))
      return { prev }
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(keys.chats, ctx.prev) },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.chats }),
  })
}
