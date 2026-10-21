import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteNote, listNotes, noteKeys, renameNote, saveNote } from '@/api/notes'
import type { Note } from '@/domain/types'

export const useNotes = (chatId: string) => useQuery({ queryKey: noteKeys.list(chatId), queryFn: () => listNotes(chatId) })

export function useSaveNote(chatId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (messageId: string) => saveNote(chatId, messageId),
    onSuccess: (created) => qc.setQueryData<Note[]>(noteKeys.list(chatId), (old) => [created, ...(old ?? []).filter((n) => n.id !== created.id)]),
  })
}

export function useRenameNote(chatId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => renameNote(chatId, id, title),
    onSuccess: (updated) => qc.setQueryData<Note[]>(noteKeys.list(chatId), (old) => old?.map((n) => (n.id === updated.id ? updated : n))),
  })
}

export function useDeleteNote(chatId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteNote(chatId, id),
    onSuccess: (_, id) => qc.setQueryData<Note[]>(noteKeys.list(chatId), (old) => old?.filter((n) => n.id !== id)),
  })
}
