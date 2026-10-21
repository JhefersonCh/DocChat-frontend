import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { LINK_KEYS, citationFromParams } from '@/domain/library'
import type { Source } from '@/domain/types'
import { useTrace } from '@/features/conversation/TraceContext'

/**
 * Library / search results open a chat with `?doc=…&page=…` (see `openLink`): once the chat's sources are here
 * the viewer jumps to that spot exactly like a click on a citation, and the params are dropped (replace) so
 * a reload or back does not replay it.
 */
export function useOpenFromLink(sources: readonly Source[]) {
  const [params, setParams] = useSearchParams()
  const { onCiteSelect } = useTrace()
  const done = useRef(false)
  useEffect(() => {
    if (done.current || !params.has('doc')) return
    const target = sources.find((s) => s.id === params.get('doc'))
    if (!target || target.status !== 'ready') return // wait: the source may still be indexing
    const citation = citationFromParams(params, sources)
    done.current = true
    if (citation) onCiteSelect(citation)
    const rest = new URLSearchParams(params)
    LINK_KEYS.forEach((k) => rest.delete(k))
    setParams(rest, { replace: true })
  }, [params, sources, onCiteSelect, setParams])
}
