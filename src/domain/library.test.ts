import { describe, expect, it } from 'vitest'
import { categoryColor, citationFromParams, hitLocator, openLink, scorePct, type DocHit, type LibraryDoc } from './library'

const hit = (over: Partial<DocHit> = {}): DocHit => ({
  chunk_id: 'c1', kind: 'text', page: 3, page_end: null, t_start: null, t_end: null, bbox: null, has_thumb: false, snippet: 'El presupuesto anual', score: 0.8, ...over,
})
const doc = { id: 'd1', filename: 'plan.pdf', kind: 'pdf', chat_id: 'chat1' } as LibraryDoc

describe('library links', () => {
  it('a hit opens its chat and the URL gives back the same citation', () => {
    const url = openLink(doc, hit())!
    expect(url.startsWith('/chats/chat1?')).toBe(true)
    const params = new URL(url, 'http://x').searchParams
    const cite = citationFromParams(params, [{ id: 'd1', filename: 'plan.pdf', kind: 'pdf' }])
    expect(cite).toMatchObject({ document_id: 'd1', page: 3, chunk_id: 'c1', kind: 'text', origin: 'search' })
  })

  it('has no link without a chat, and ignores a document that is not in the chat', () => {
    expect(openLink({ ...doc, chat_id: null })).toBeNull()
    expect(citationFromParams(new URLSearchParams('doc=zzz'), [{ id: 'd1', filename: 'a', kind: 'pdf' }])).toBeNull()
  })

  it('locates hits by page range or time range', () => {
    expect(hitLocator(hit({ page: 3, page_end: 4 }))).toBe('pág. 3–4')
    expect(hitLocator(hit({ kind: 'audio', page: null, t_start: 80, t_end: 100 }))).toBe('01:20–01:40')
    expect(hitLocator(hit({ page: null }))).toBe('')
  })
})

describe('categories and scores', () => {
  it('colors a category without one deterministically', () => {
    expect(categoryColor({ name: 'Finanzas', color: null })).toBe(categoryColor({ name: 'Finanzas', color: null }))
    expect(categoryColor({ name: 'x', color: '#123456' })).toBe('#123456')
  })
  it('clamps the score percentage', () => {
    expect(scorePct(0.456)).toBe('46%')
    expect(scorePct(2)).toBe('100%')
  })
})
