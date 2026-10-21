// Pure state machine of one ask turn (plan §7.2). No React, no fetch.
import type { ApiError, Citation, SearchEvent, SseEvent } from '@/domain/types'

export type AskPhase =
  | 'idle' | 'connecting' | 'retrieving' | 'thinking' | 'streaming'
  | 'complete' | 'failed' | 'cancelled'

export interface AskState {
  phase: AskPhase
  question: string
  searches: SearchEvent[]
  citations: Citation[]
  text: string
  messageId: string | null
  cited: number[]
  /** The best source was a weak match: the answer carries the "Evidencia débil" badge. */
  weak: boolean
  error: ApiError | null
  startedAt: number
}

export type AskAction =
  | { type: 'send'; question: string; now: number }
  | { type: 'event'; event: SseEvent }
  | { type: 'fail'; error: ApiError }
  | { type: 'ended' }
  | { type: 'abort' }
  | { type: 'reset' }

export const initialAsk: AskState = {
  phase: 'idle', question: '', searches: [], citations: [], text: '',
  messageId: null, cited: [], weak: false, error: null, startedAt: 0,
}

/** A turn is in flight: the composer is locked and Esc cancels. */
export const isActive = (s: AskState) =>
  s.phase === 'connecting' || s.phase === 'retrieving' || s.phase === 'thinking' || s.phase === 'streaming'

function onEvent(s: AskState, e: SseEvent): AskState {
  switch (e.event) {
    case 'search':
      return { ...s, phase: 'retrieving', searches: [...s.searches, e.data] }
    case 'citations':
      return { ...s, phase: 'thinking', citations: e.data }
    case 'token':
      return { ...s, phase: 'streaming', text: s.text + e.data.text }
    case 'done':
      return { ...s, phase: 'complete', messageId: e.data.message_id, cited: e.data.cited, weak: e.data.weak_evidence ?? false }
    case 'error':
      return { ...s, phase: 'failed', error: e.data }
  }
}

export function askReducer(s: AskState, a: AskAction): AskState {
  switch (a.type) {
    case 'send':
      return isActive(s) ? s : { ...initialAsk, phase: 'connecting', question: a.question, startedAt: a.now }
    case 'event':
      return isActive(s) ? onEvent(s, a.event) : s
    case 'fail':
      return isActive(s) ? { ...s, phase: 'failed', error: a.error } : s
    case 'ended':
      // The stream closed with no `done`/`error` event: still active means it was cut.
      return isActive(s) ? { ...s, phase: 'failed', error: { code: 'network_error', message: 'stream interrupted' } } : s
    case 'abort':
      // A cancelled turn persisted nothing on the backend: drop the partial.
      return isActive(s) ? { ...initialAsk, phase: 'cancelled', question: s.question } : s
    case 'reset':
      return initialAsk
  }
}
