import { describe, expect, it } from 'vitest'
import type { Citation, Claim } from './types'
import { claimCitation, summaryLabel, worstStatus } from './verification'

const claim = (over: Partial<Claim> = {}): Claim => ({ text: 't', sentence_index: 0, status: 'respaldada', source_ns: [1], reason: '', ...over })
const cite = { n: 1, document_id: 'd', filename: 'a.pdf', page: 4, snippet: 's', chunk_id: 'c', page_end: null, content: 'texto completo del fragmento', rects: [{ page: 4, x0: 0, y0: 0, x1: 1, y1: 1 }] } satisfies Citation

describe('verification helpers', () => {
  it('summarizes counts, omitting zeros', () => {
    const claims = [...Array(5).fill(claim()), claim({ status: 'parcial' }), claim({ status: 'sin_respaldo' })]
    expect(summaryLabel(claims)).toBe('5 respaldadas · 1 parcial · 1 sin respaldo')
    expect(summaryLabel([claim()])).toBe('1 respaldada')
    expect(summaryLabel([])).toBe('Sin afirmaciones verificables')
  })

  it('flags a sentence by its weakest claim', () => {
    expect(worstStatus([claim(), claim({ status: 'parcial' })])).toBe('parcial')
    expect(worstStatus([claim({ status: 'sin_respaldo' }), claim()])).toBe('sin_respaldo')
    expect(worstStatus([])).toBeNull()
  })

  it('opens the quote (not the whole chunk) of the claim source, if it has one', () => {
    expect(claimCitation(claim({ quote: 'texto completo' }), [cite])).toMatchObject({ content: 'texto completo', rects: null, page: 4 })
    expect(claimCitation(claim(), [cite])).toBe(cite)
    expect(claimCitation(claim({ source_ns: [] }), [cite])).toBeNull()
  })
})
