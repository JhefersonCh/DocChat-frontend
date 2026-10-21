import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  askDocuments, assignCategory, autoCategorize, createCategory, deleteCategory, listCategories, listLibrary, searchLibrary,
  unassignCategory, updateCategory,
} from '@/api/library'
import { keys } from '@/api/queryKeys'
import { isDocBusy } from '@/domain/ingest'
import type { LibraryFilters } from '@/domain/library'

export const useCategories = () => useQuery({ queryKey: keys.categories, queryFn: listCategories })

export const useLibrary = (filters: LibraryFilters) =>
  useQuery({
    queryKey: keys.library(filters), queryFn: () => listLibrary(filters),
    refetchInterval: (q) => (q.state.data?.some((d) => isDocBusy({ ...d, summary_status: 'ready', enrich_status: 'ready' })) ? 3000 : false),
  })

/** Concept search; only runs with a non-empty query. Results stay while a new query is typed. */
export const useLibrarySearch = (query: string, filters: LibraryFilters) =>
  useQuery({
    queryKey: keys.librarySearch({ query, ...filters }), queryFn: () => searchLibrary(query, filters),
    enabled: query.trim().length > 1, staleTime: 30_000, retry: false,
  })

function useRefreshLibrary() {
  const qc = useQueryClient()
  return () => Promise.all([qc.invalidateQueries({ queryKey: keys.categories }), qc.invalidateQueries({ queryKey: ['library'] }), qc.invalidateQueries({ queryKey: ['library-search'] })])
}

export function useCategoryActions() {
  const refresh = useRefreshLibrary()
  return {
    create: useMutation({ mutationFn: (v: { name: string; color?: string | null }) => createCategory(v.name, v.color), onSuccess: refresh }),
    rename: useMutation({ mutationFn: (v: { id: string; name?: string; color?: string | null }) => updateCategory(v.id, { name: v.name, color: v.color }), onSuccess: refresh }),
    remove: useMutation({ mutationFn: deleteCategory, onSuccess: refresh }),
    assign: useMutation({ mutationFn: (v: { id: string; documentIds: string[] }) => assignCategory(v.id, v.documentIds), onSuccess: refresh }),
    unassign: useMutation({ mutationFn: (v: { id: string; documentIds: string[] }) => unassignCategory(v.id, v.documentIds), onSuccess: refresh }),
    auto: useMutation({ mutationFn: autoCategorize, onSuccess: refresh }),
  }
}

export function useAskDocuments() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { ids: string[]; mode: 'chat' | 'project'; name?: string }) => askDocuments(v.ids, v.mode, v.name),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: keys.chats }), qc.invalidateQueries({ queryKey: keys.projects }), qc.invalidateQueries({ queryKey: ['library'] })]),
  })
}
