import { describe, expect, it } from 'vitest'
import type { Citation, SseEvent } from '@/domain/types'
import { askReducer, initialAsk, isActive, type AskState } from './askReducer'

const cite = (n: number): Citation => ({
  n, document_id: 'd', filename: 'f.pdf', page: n, snippet: 's', chunk_id: null, page_end: null, content: null,
})
const ev = (e: SseEvent) => ({ type: 'event', event: e }) as const
const run = (actions: Parameters<typeof askReducer>[1][], from: AskState = initialAsk): AskState =>
  actions.reduce(askReducer, from)

describe('askReducer', () => {
  it('walks the happy path search -> citations -> token -> done', () => {
    const s = run([
      { type: 'send', question: 'q', now: 1 },
      ev({ event: 'search', data: { query: 'a', k: 5, hits: 3 } }),
      ev({ event: 'search', data: { query: 'b', k: 5, hits: 0 } }),
      ev({ event: 'citations', data: [cite(1)] }),
      ev({ event: 'token', data: { text: 'Hola ' } }),
      ev({ event: 'token', data: { text: '[1]' } }),
      ev({ event: 'done', data: { message_id: 'm1', cited: [1] } }),
    ])
    expect(s).toMatchObject({ phase: 'complete', text: 'Hola [1]', messageId: 'm1', cited: [1], question: 'q' })
    expect(s.searches).toHaveLength(2)
  })

  it('done carries the weak-evidence flag (off by default)', () => {
    const done = (weak?: boolean) =>
      run([{ type: 'send', question: 'q', now: 0 }, ev({ event: 'done', data: { message_id: 'm', cited: [], weak_evidence: weak } })])
    expect(done(true).weak).toBe(true)
    expect(done(undefined).weak).toBe(false)
    expect(run([{ type: 'send', question: 'q', now: 0 }]).weak).toBe(false)
  })

  it('an error event keeps the partial text and fails', () => {
    const s = run([
      { type: 'send', question: 'q', now: 0 },
      ev({ event: 'token', data: { text: 'parcial' } }),
      ev({ event: 'error', data: { code: 'provider_unreachable', message: 'x' } }),
    ])
    expect(s).toMatchObject({ phase: 'failed', text: 'parcial', error: { code: 'provider_unreachable' } })
  })

  it('abort cancels an active turn, ignores late events, and send restarts clean', () => {
    const cancelled = run([{ type: 'send', question: 'q', now: 0 }, { type: 'abort' }, ev({ event: 'token', data: { text: 'late' } })])
    expect(cancelled.phase).toBe('cancelled')
    expect(cancelled.text).toBe('')
    expect(isActive(cancelled)).toBe(false)
    expect(askReducer(cancelled, { type: 'send', question: 'q2', now: 5 })).toMatchObject({ phase: 'connecting', question: 'q2', text: '' })
  })

  it('abort after done does not clobber the finished turn', () => {
    const done = run([{ type: 'send', question: 'q', now: 0 }, ev({ event: 'done', data: { message_id: 'm', cited: [] } })])
    expect(askReducer(done, { type: 'abort' }).phase).toBe('complete')
  })

  it('a stream that ends without done fails the turn, keeping the partial text', () => {
    const s = run([
      { type: 'send', question: 'q', now: 0 },
      ev({ event: 'token', data: { text: 'parcial' } }),
      { type: 'ended' },
    ])
    expect(s).toMatchObject({ phase: 'failed', text: 'parcial', error: { code: 'network_error' } })
  })

  it('ended after done or error is a no-op', () => {
    const done = run([{ type: 'send', question: 'q', now: 0 }, ev({ event: 'done', data: { message_id: 'm', cited: [] } })])
    expect(askReducer(done, { type: 'ended' })).toBe(done)
    const failed = run([{ type: 'send', question: 'q', now: 0 }, ev({ event: 'error', data: { code: 'x', message: 'y' } })])
    expect(askReducer(failed, { type: 'ended' })).toBe(failed)
  })

  it('refuses a second send while a turn is in flight', () => {
    const s = run([{ type: 'send', question: 'q', now: 0 }])
    expect(askReducer(s, { type: 'send', question: 'other', now: 1 }).question).toBe('q')
  })
})
