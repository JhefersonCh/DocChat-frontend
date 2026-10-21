import { describe, expect, it } from 'vitest'
import { hitToCitation } from './search'
import type { SearchHit } from './types'

const hit: SearchHit = {
  chunk_id: 'c1', page_start: 3, page_end: 4, section: '2. Plazos', snippet: 'El plazo', content: 'El plazo es 30 días', score: 0.8,
}

describe('hitToCitation', () => {
  it('turns a search hit into a citation the viewer can trace (n = 0: not an answer source)', () => {
    expect(hitToCitation(hit, { id: 'd1', filename: 'a.pdf' })).toEqual({
      n: 0, origin: 'search', document_id: 'd1', filename: 'a.pdf', page: 3, page_end: 4, snippet: 'El plazo',
      chunk_id: 'c1', content: 'El plazo es 30 días', section: '2. Plazos', score: 0.8,
    })
  })

  it('keeps the image contract (kind, bbox, thumb) and the source kind; text hits stay exactly as before', () => {
    const img: SearchHit = { ...hit, kind: 'image', bbox: [0.1, 0.1, 0.5, 0.4], has_thumb: true, content: '' }
    expect(hitToCitation(img, { id: 'd1', filename: 'a.pdf', kind: 'pdf' })).toMatchObject({
      kind: 'image', bbox: [0.1, 0.1, 0.5, 0.4], has_thumb: true, source_kind: 'pdf', origin: 'search',
    })
    expect(hitToCitation({ ...hit, kind: 'text' }, { id: 'd1', filename: 'a.pdf' })).not.toHaveProperty('kind')
  })
})
