import { createContext, useContext } from 'react'
import type { Citation, Search } from '@/domain/types'

/** What the X-ray strip draws: one answer's retrieval. */
export interface XraySource {
  id: string // message id, or 'live' for the turn in flight
  searches: Search[]
  citations: Citation[]
  /** `[n]` numbers the answer text references. */
  cited: number[]
  /** Citations arrived: cited ticks lock in (outline), the rest dim. */
  locked: boolean
  /** Arriving over SSE: ticks light as they come. Persisted: a replay staggers the searches. */
  live: boolean
}

export interface XrayState { source: XraySource | null; replay: number }
export interface XrayActions {
  /** The turn in flight keeps the strip up to date (no replay). */
  publishLive: (source: XraySource) => void
  /** A persisted answer: show it and play the sequence again (re-calling it replays). */
  show: (source: XraySource) => void
}

export const XrayStateContext = createContext<XrayState>({ source: null, replay: 0 })
export const XrayActionsContext = createContext<XrayActions>({ publishLive: () => {}, show: () => {} })

export const useXray = () => useContext(XrayStateContext)
export const useXrayActions = () => useContext(XrayActionsContext)
