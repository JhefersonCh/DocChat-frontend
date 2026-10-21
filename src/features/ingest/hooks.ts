import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { enrichDocument } from '@/api/media'
import { cancelIngest, getDocument, regenerateSummary, reindexDocument, uploadDocument } from '@/api/documents'
import { keys } from '@/api/queryKeys'
import { finishedIngest, isDocBusy, pollInterval } from '@/domain/ingest'
import type { Document } from '@/domain/types'

/**
 * Polls GET /documents/{id} only while ingestion is in flight or the summary is pending (plan §7.1). The chat's own document
 * (already fetched with the chat) tells whether to start; on in-flight -> terminal the chat + list refresh once.
 */
export function useDocumentPolling(chatId: string, known: Document | null | undefined) {
  const qc = useQueryClient()
  const documentId = known?.id
  const query = useQuery({
    queryKey: keys.document(documentId ?? ''),
    queryFn: () => getDocument(documentId!),
    enabled: !!documentId && isDocBusy(known),
    refetchInterval: (q) => {
      const d = q.state.data ?? known
      return isDocBusy(d) ? pollInterval('processing', Date.now() - Date.parse(d?.created_at ?? '')) : false
    },
  })

  // While in flight the poll is fresher than the chat payload; once the chat refetches, it is authoritative.
  const document = isDocBusy(known) ? (query.data ?? known) : known
  const busy = isDocBusy(document)
  const status = document?.status
  const prev = useRef({ busy, status })
  useEffect(() => {
    // Ingest ended (title/list change) or the summary left `pending` (new summary in the chat payload).
    if (finishedIngest(prev.current.status, status) || (prev.current.busy && !busy)) {
      void qc.invalidateQueries({ queryKey: keys.chat(chatId) })
      void qc.invalidateQueries({ queryKey: keys.chats })
      void qc.invalidateQueries({ queryKey: keys.messages(chatId) }) // re-index renumbers chunk ids
    }
    prev.current = { busy, status }
  }, [busy, status, chatId, qc])

  return { document, error: query.error, refetch: query.refetch }
}

export function useUploadDocument(chatId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => uploadDocument(chatId, file),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: keys.chat(chatId) }),
      qc.invalidateQueries({ queryKey: keys.chats }),
    ]),
  })
}

/** Re-index: the chat refetch brings the document back as `processing`, which starts the polling. */
export function useReindexDocument(chatId: string) {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: keys.chat(chatId) })
  return useMutation({ mutationFn: reindexDocument, onSuccess: refresh, onError: refresh })
}

/** Cancel a running ingest: refetch so the poll sees `failed` as soon as the backend gets to it. */
export function useCancelIngest(chatId: string) {
  const qc = useQueryClient()
  const refresh = (_r: unknown, id: string) => Promise.all([
    qc.invalidateQueries({ queryKey: keys.chat(chatId) }),
    qc.invalidateQueries({ queryKey: keys.document(id) }),
  ])
  return useMutation({ mutationFn: cancelIngest, onSuccess: refresh })
}

/**
 * POST summary -> 202. The cached poll result is flipped to `pending` so the poll (stale `query.data` would
 * otherwise win over the chat payload) restarts from the right state; the chat refetch then confirms it.
 */
export function useRegenerateSummary(chatId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: regenerateSummary,
    onSuccess: (_r, id) => {
      qc.setQueryData<Document>(keys.document(id), (d) => d && { ...d, summary_status: 'pending' })
      return qc.invalidateQueries({ queryKey: keys.chat(chatId) })
    },
    onError: () => qc.invalidateQueries({ queryKey: keys.chat(chatId) }),
  })
}

/** POST enrich -> 202. The cached poll result flips to `pending` so polling restarts from the right state (same trick as the summary). */
export function useEnrichDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: enrichDocument,
    onSuccess: (_r, id) => {
      qc.setQueryData<Document>(keys.document(id), (d) => d && { ...d, enrich_status: 'pending' })
      return qc.invalidateQueries({ queryKey: ['chat'] })
    },
    onError: () => qc.invalidateQueries({ queryKey: ['chat'] }),
  })
}
