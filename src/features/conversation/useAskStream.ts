import { useCallback, useEffect, useReducer, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiClientError } from '@/api/client'
import { askStream } from '@/api/messages'
import { keys } from '@/api/queryKeys'
import { askReducer, initialAsk } from './askReducer'

/** Streaming turn of a chat (plan §7.2). The reducer is pure; this hook only wires fetch + abort. */
export function useAskStream(chatId: string) {
  const qc = useQueryClient()
  const [state, dispatch] = useReducer(askReducer, initialAsk)
  const abort = useRef<AbortController | null>(null)

  /** Resolves with the pre-stream HTTP error, if any (nothing was persisted in that case). */
  const send = useCallback(async (question: string, maxPage?: number | null): Promise<ApiClientError | null> => {
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    dispatch({ type: 'send', question, now: Date.now() })
    try {
      for await (const event of askStream(chatId, question, ctrl.signal, maxPage)) {
        dispatch({ type: 'event', event })
        if (event.event === 'done') void qc.invalidateQueries({ queryKey: keys.messages(chatId) })
      }
      if (!ctrl.signal.aborted) dispatch({ type: 'ended' })
      return null
    } catch (e) {
      if (ctrl.signal.aborted) return null
      const err = e instanceof ApiClientError ? e : new ApiClientError('network_error', String(e), 0)
      dispatch({ type: 'fail', error: err })
      return err
    }
  }, [chatId, qc])

  const cancel = useCallback(() => {
    abort.current?.abort()
    dispatch({ type: 'abort' })
  }, [])
  const reset = useCallback(() => dispatch({ type: 'reset' }), [])

  useEffect(() => () => abort.current?.abort(), [])
  return { state, send, cancel, reset }
}
