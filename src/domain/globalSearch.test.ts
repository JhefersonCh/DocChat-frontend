import { describe, expect, it } from 'vitest'
import { findRanges, hitLink, parseTerms, pushRecent, splitHighlights } from './globalSearch'

describe('global search helpers', () => {
  it('terms ignore case/accents, keep quoted phrases whole and highlight partial words', () => {
    expect(parseTerms('Presu "plan ANUAL" presu')).toEqual(['presu', 'plan anual'])
    const text = 'La Inversión inicial y el presupuesto'
    const spans = findRanges(text, parseTerms('inversion presu'))
    expect(splitHighlights(text, spans).filter((p) => p.mark).map((p) => p.text)).toEqual(['Inversión', 'presu'])
  })

  it('a message result links to its chat with the message and the query; recents dedupe', () => {
    const url = hitLink({ kind: 'message', hit: { message_id: 'm1', chat_id: 'c1' } as never }, ' zorro ')
    expect(url).toBe('/chats/c1?msg=m1&hl=zorro')
    expect(pushRecent(['b', 'zorro', 'ab'], 'ZORRO')).toEqual(['ZORRO', 'b', 'ab'])
  })
})
