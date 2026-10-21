import { createContext, useContext } from 'react'
import type { Citation } from '@/domain/types'

/** Where a selection came from: the clicked element (thread origin) and its answer's citations (`[` / `]` stepping). */
export interface CiteSource { origin?: Element | null; group?: Citation[] }

/**
 * The seam between conversation and viewer (plan §7.3 / §8). Chips and margin notes call
 * `onCiteSelect(citation, source)`; the viewer reads `activeCitation` (+ `seq`) to jump to the page and
 * highlight the chunk; chips use it to show the active state; `TraceThread` draws from `origin`.
 */
export interface Trace {
  activeCitation: Citation | null
  /** Bumps on every click, so re-selecting the same citation replays the trace. */
  seq: number
  origin: Element | null
  onCiteSelect: (citation: Citation, source?: CiteSource) => void
}

export const TraceContext = createContext<Trace>({ activeCitation: null, seq: 0, origin: null, onCiteSelect: () => {} })

export const useTrace = () => useContext(TraceContext)

/** Citation objects are refetched after `done`, so identity is structural, not by reference. */
export const sameCitation = (a: Citation | null, b: Citation) =>
  !!a && a.n === b.n && a.chunk_id === b.chunk_id && a.page === b.page && a.snippet === b.snippet
