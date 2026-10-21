import { describe, expect, it } from 'vitest'
import type { Found, Search } from './types'
import { bandsFromRects, bboxSpan, heat, laneCount, layoutTicks, ordinalSpan, pageSpan, tickLabel } from './xray'

const hit = (n: number, page: number | null, score: number | null, end = page): Found =>
  ({ n, chunk_id: `c${n}`, page_start: page, page_end: end, section: null, score })

describe('minimap geometry', () => {
  // Three pages of different heights (px from the top of the scroll content), total 1000.
  const bands = bandsFromRects([{ top: 100, height: 200 }, { top: 316, height: 400 }, { top: 732, height: 200 }], 1000)

  it('page boxes become fractions of the scroll height', () => {
    expect(bands).toEqual([{ top: 0.1, height: 0.2 }, { top: 0.316, height: 0.4 }, { top: 0.732, height: 0.2 }])
    expect(bandsFromRects([{ top: 1, height: 1 }], 0)).toEqual([])
  })

  it('a page span covers its own band; a range runs to the end of the last page; unknown pages give null', () => {
    const one = pageSpan(bands, 2)!
    expect(one.y).toBe(0.316)
    expect(one.h).toBeCloseTo(0.4)
    const range = pageSpan(bands, 1, 2)!
    expect(range.y).toBe(0.1)
    expect(range.h).toBeCloseTo(0.616)
    expect(pageSpan(bands, 9)).toBeNull()
    expect(pageSpan(bands, null)).toBeNull()
  })

  it('text documents split the height by chunk ordinal', () => {
    expect(ordinalSpan(1, 4)).toEqual({ y: 0.25, h: 0.25 })
    expect(ordinalSpan(4, 4)).toBeNull()
  })

  it('heat is relative to the answer range, floored so weak hits stay visible', () => {
    expect(heat(0.8, 0.2, 0.8)).toBe(1)
    expect(heat(0.2, 0.2, 0.8)).toBeCloseTo(0.3)
    expect(heat(0.5, 0.5, 0.5)).toBe(1)
    expect(heat(null, 0, 1)).toBe(0.55)
  })
})

describe('layoutTicks', () => {
  const searches: Search[] = [
    { query: 'plazo', k: 2, found: [hit(1, 1, 0.8), hit(2, 3, 0.4)] },
    { query: 'resumen', k: 1, panorama: true, found: [hit(3, 2, 0.6), hit(4, null, 0.5)] },
  ]
  const place = (f: Found) => (f.page_start == null ? null : { y: f.page_start / 10, h: 0.05 })

  it('one tick per positioned hit, in its own lane, flagging cited and panorama ones', () => {
    const ticks = layoutTicks(searches, place, new Set([2]))

    expect(ticks.map((t) => [t.hit.n, t.search, t.lane, t.cited, t.panorama])).toEqual([
      [1, 0, 0, false, false], [2, 0, 0, true, false], [3, 1, 1, false, true], // n=4 has no position: skipped
    ])
    expect(ticks[0].heat).toBe(1)
    expect(ticks[1].heat).toBeCloseTo(0.3)
  })

  it('answers persisted before the X-ray have no hits: nothing to draw', () => {
    expect(layoutTicks([{ query: 'q', k: 3 }], place, new Set())).toEqual([])
    expect(laneCount([])).toBe(1)
    expect(laneCount(Array(9).fill({ query: 'q', k: 1 }))).toBe(4)
  })
})

describe('image ticks', () => {
  it('bboxSpan narrows a page span to where the picture is', () => {
    const s = bboxSpan({ y: 0.2, h: 0.4 }, [0, 0.5, 1, 1])
    expect(s.y).toBeCloseTo(0.4)
    expect(s.h).toBeCloseTo(0.2)
    expect(bboxSpan({ y: 0.2, h: 0.4 }, null)).toEqual({ y: 0.2, h: 0.4 })
  })
  it('layoutTicks marks image hits (kind tolerated absent) and the label says "imagen"', () => {
    const searches: Search[] = [{ query: 'q', k: 3, found: [{ ...hit(1, 2, 0.5), kind: 'image' }, hit(2, 2, 0.4)] }]
    const ticks = layoutTicks(searches, () => ({ y: 0, h: 0.1 }), new Set())
    expect(ticks.map((t) => t.media)).toEqual([true, false])
    expect(tickLabel(ticks[0], 'q')[1]).toBe('imagen · pág. 2')
    expect(tickLabel(ticks[1], 'q')[1]).toBe('pág. 2')
  })
})
