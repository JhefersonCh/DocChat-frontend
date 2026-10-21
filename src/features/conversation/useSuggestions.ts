import { useQuery } from '@tanstack/react-query'
import { getSuggestions } from '@/api/messages'
import { keys } from '@/api/queryKeys'
import type { Message } from '@/domain/types'

/**
 * Follow-ups of an assistant answer. Stored ones (`message.suggestions`) seed the cache and are never refetched.
 * Otherwise POST fires once per (chat, message): the query key dedups StrictMode double-mounts and re-renders,
 * `staleTime: Infinity` keeps the result, and `retry`/`retryOnMount: false` keep a failure silent (no retry storm).
 */
export function useSuggestions(chatId: string, message: Message, enabled: boolean) {
  const stored = message.suggestions?.length ? message.suggestions : undefined
  return useQuery({
    queryKey: keys.suggestions(chatId, message.id),
    queryFn: () => getSuggestions(chatId, message.id),
    initialData: stored,
    enabled,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
