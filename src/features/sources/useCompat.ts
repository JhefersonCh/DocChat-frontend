import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getChatCompat, getProjectCompat, getSelectionCompat } from '@/api/compat'
import { keys } from '@/api/queryKeys'
import { sourceSignature } from '@/domain/compat'

type Item = { id: string; status: string; active?: boolean }
const options = { staleTime: 5 * 60_000, retry: false, placeholderData: keepPreviousData } as const

/** Compatibility of the active sources of a chat; re-checked whenever the source set / mute toggles / indexing state change. */
export function useChatCompat(chatId: string, sources: Item[]) {
  const signature = sourceSignature(sources)
  return useQuery({ queryKey: keys.compat('chat', chatId, signature), queryFn: () => getChatCompat(chatId), enabled: sources.length > 1, ...options }).data
}

export function useProjectCompat(projectId: string, sources: Item[]) {
  const signature = sourceSignature(sources)
  return useQuery({ queryKey: keys.compat('project', projectId, signature), queryFn: () => getProjectCompat(projectId), enabled: sources.length > 1, ...options }).data
}

/** A library selection, before "Preguntar a estos documentos". */
export function useSelectionCompat(ids: string[]) {
  const signature = [...ids].sort().join('|')
  return useQuery({ queryKey: keys.compat('selection', 'library', signature), queryFn: () => getSelectionCompat(ids), enabled: ids.length > 1 && ids.length <= 12, ...options }).data
}

