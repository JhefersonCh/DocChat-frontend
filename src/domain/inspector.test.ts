import { describe, expect, it } from 'vitest'
import { doc } from '@/test/fixtures'
import { chunkToCitation, groupByPage, boundary } from './inspector'
import type { ChunkInfo } from './types'

const chunk = (ordinal: number, page_start: number | null, over: Partial<ChunkInfo> = {}): ChunkInfo => ({
  chunk_id: `c${ordinal}`, ordinal, page_start, page_end: page_start, section: null, chars: 10, content: 'texto', ...over,
})

describe('groupByPage', () => {
  it('groups consecutive chunks by their first page, keeping reading order', () => {
    const groups = groupByPage([chunk(0, 1), chunk(1, 1), chunk(2, 2), chunk(3, null)])
    expect(groups.map((g) => [g.page, g.chunks.map((c) => c.ordinal)])).toEqual([[1, [0, 1]], [2, [2]], [null, [3]]])
  })
})

describe('chunkToCitation', () => {
  it('is a synthetic inspector citation the viewer can locate', () => {
    expect(chunkToCitation(chunk(4, 3, { page_end: 4, section: 'S', content: 'hola mundo' }), doc())).toMatchObject({
      n: 0, origin: 'inspector', document_id: 'd1', page: 3, page_end: 4, chunk_id: 'c4', content: 'hola mundo', section: 'S',
    })
  })
})

describe('chunkToCitation media', () => {
  it('an image segment becomes an image citation with its bbox and thumb flag; text chunks gain nothing', () => {
    const c = { ...chunk(7, 2, { content: '' }), modality: 'image' as const, origin: 'figure' as const, bbox: [0.1, 0.1, 0.6, 0.5] as [number, number, number, number], has_thumb: true }
    expect(chunkToCitation(c, { ...doc(), kind: 'pdf' })).toMatchObject({ kind: 'image', bbox: [0.1, 0.1, 0.6, 0.5], has_thumb: true, source_kind: 'pdf' })
    expect(chunkToCitation(chunk(1, 1), doc())).not.toHaveProperty('kind')
  })
})

describe('boundary', () => {
  it('shows the start and end of a long chunk, the whole of a short one', () => {
    expect(boundary('corto')).toEqual({ head: 'corto', tail: null })
    const b = boundary(`${'a'.repeat(100)}  ${'b'.repeat(100)}`, 20)
    expect(b.head).toBe(`${'a'.repeat(20)}…`)
    expect(b.tail).toBe(`…${'b'.repeat(20)}`)
  })
})
