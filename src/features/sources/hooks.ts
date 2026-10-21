import { useEffect, useRef } from 'react'
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query'
import { getDocument } from '@/api/documents'
import { keys } from '@/api/queryKeys'
import { addSource, removeSource, setActiveSources } from '@/api/sources'
import { finishedIngest, isDocBusy, pollInterval } from '@/domain/ingest'
import { mergeFresh } from '@/domain/sources'
import type { ChatDetail, Document, Source } from '@/domain/types'

/**
 * Polls every source that is ingesting (or still summarizing / describing). While in flight the poll is
 * fresher than the chat payload; once a source settles the chat + list + messages refresh once.
 */
export function useSourcesPolling(chatId: string, known: Source[]) {
  const qc = useQueryClient()
  const queries = useQueries({
    queries: known.map((s) => ({
      queryKey: keys.document(s.id),
      queryFn: () => getDocument(s.id),
      enabled: isDocBusy(s),
      refetchInterval: (q: { state: { data?: Document } }) => {
        const d = q.state.data ?? s
        return isDocBusy(d) ? pollInterval('processing', Date.now() - Date.parse(d.created_at)) : false
      },
    })),
  })
  const fresh: Record<string, Document | undefined> = {}
  known.forEach((s, i) => { if (isDocBusy(s)) fresh[s.id] = queries[i]?.data ?? s })
  const sources = mergeFresh(known, fresh)

  const prev = useRef(new Map<string, { busy: boolean; status: Document['status'] }>())
  const signature = sources.map((s) => `${s.id}:${s.status}:${isDocBusy(s)}`).join('|')
  useEffect(() => {
    let settled = false
    for (const s of sources) {
      const before = prev.current.get(s.id)
      const busy = isDocBusy(s)
      if (before && (finishedIngest(before.status, s.status) || (before.busy && !busy))) settled = true
      prev.current.set(s.id, { busy, status: s.status })
    }
    if (settled) {
      void qc.invalidateQueries({ queryKey: keys.chat(chatId) })
      void qc.invalidateQueries({ queryKey: keys.chats })
      void qc.invalidateQueries({ queryKey: keys.messages(chatId) }) // re-index renumbers chunk ids
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `signature` summarizes `sources`
  }, [signature, chatId, qc])

  const error = queries.find((q) => q.error)?.error ?? null
  return { sources, error, refetch: () => queries.forEach((q) => void q.refetch()) }
}

/** Uploads the files one after the other (the backend orders them by arrival: S1, S2…). */
export function useAddSources(chatId: string) {
  const qc = useQueryClient()
  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: keys.chat(chatId) }),
    qc.invalidateQueries({ queryKey: keys.chats }),
  ])
  return useMutation({
    mutationFn: async (files: File[]) => { for (const f of files) await addSource(chatId, f) },
    onSuccess: refresh,
    onError: refresh, // some of the files may have gone through
  })
}

export function useRemoveSource(chatId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (documentId: string) => removeSource(chatId, documentId),
    onSuccess: (_r, id) => {
      qc.removeQueries({ queryKey: keys.document(id) })
      return Promise.all([
        qc.invalidateQueries({ queryKey: keys.chat(chatId) }),
        qc.invalidateQueries({ queryKey: keys.chats }),
      ])
    },
  })
}

/** Optimistic: the chips flip at once; the server's answer (or a rollback) settles it. */
export function useSetActiveSources(chatId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => setActiveSources(chatId, ids),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: keys.chat(chatId) })
      const before = qc.getQueryData<ChatDetail>(keys.chat(chatId))
      qc.setQueryData<ChatDetail>(keys.chat(chatId), (c) => c && {
        ...c, active_source_ids: ids, sources: c.sources?.map((s) => ({ ...s, active: ids.includes(s.id) })),
      })
      return { before }
    },
    onError: (_e, _ids, ctx) => { if (ctx?.before) qc.setQueryData(keys.chat(chatId), ctx.before) },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.chat(chatId) }),
  })
}
