import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { isTyping } from '@/ui/typing'
import type { Citation } from '@/domain/types'
import { TraceContext, sameCitation, type CiteSource, type Trace } from './TraceContext'

interface Sel { citation: Citation | null; seq: number; origin: Element | null }

export function TraceProvider({ children }: { children: ReactNode }) {
  const [sel, setSel] = useState<Sel>({ citation: null, seq: 0, origin: null })
  const group = useRef<Citation[]>([])

  const onCiteSelect = useCallback((citation: Citation, source: CiteSource = {}) => {
    if (source.group) group.current = source.group
    setSel((s) => ({ citation, seq: s.seq + 1, origin: source.origin ?? null }))
  }, [])

  // `[` / `]`: previous / next citation of the answer the active one belongs to (plan §9).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== '[' && e.key !== ']') || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return
      const list = group.current
      const at = list.findIndex((c) => sameCitation(sel.citation, c))
      if (at < 0) return
      const next = list[at + (e.key === ']' ? 1 : -1)]
      if (!next) return
      e.preventDefault()
      const scope = sel.origin?.closest('article')
      // Notes are unmounted while the sources are collapsed: the thread then leaves from the inline chip.
      const origin = scope?.querySelector(`[data-note-n="${next.n}"]`) ?? scope?.querySelector(`[data-chip-n="${next.n}"]`) ?? null
      onCiteSelect(next, { origin })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sel, onCiteSelect])

  const value = useMemo<Trace>(() => ({ ...sel, activeCitation: sel.citation, onCiteSelect }), [sel, onCiteSelect])
  return <TraceContext.Provider value={value}>{children}</TraceContext.Provider>
}
