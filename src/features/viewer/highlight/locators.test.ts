import { describe, expect, it } from 'vitest'
import { BBoxLocator } from './BBoxLocator'
import { chooseLocator } from './chooseLocator'
import { RectsLocator } from './RectsLocator'
import { TextMatchLocator } from './TextMatchLocator'
import { TimeLocator } from './TimeLocator'
import type { HighlightTarget, TextSurface } from './types'

const base: HighlightTarget = { documentId: 'd', page: 2, pageEnd: 3, content: 'hola mundo', snippet: 'hola', rects: null }
const texts: Record<number, string> = { 2: 'Pág dos termina con hola', 3: 'mundo y sigue.' }
const surface: TextSurface = {
  pageText: async (p) => (p == null ? null : (texts[p] ?? null)),
  rects: (p, s, e) => [{ x: s, y: p ?? 0, w: e - s, h: 1 }],
  pageSize: () => ({ width: 600, height: 800 }),
}

describe('locators', () => {
  it('chooseLocator picks rects only when the citation has them', () => {
    expect(chooseLocator(base)).toBeInstanceOf(TextMatchLocator)
    expect(chooseLocator({ ...base, rects: [{ page: 2, x0: 0, y0: 0, x1: 1, y1: 1 }] })).toBeInstanceOf(RectsLocator)
  })

  it('TextMatchLocator highlights a chunk crossing a page boundary on both pages', async () => {
    const res = await new TextMatchLocator().locate(base, surface)
    expect(res.quality).toBe('exact')
    expect(res.ranges.map((r) => r.page)).toEqual([2, 3])
    expect(res.ranges[1].rects).toHaveLength(1)
  })

  it('old citation without content is page-only', async () => {
    const res = await new TextMatchLocator().locate({ ...base, content: null, pageEnd: null }, surface)
    expect(res).toEqual({ quality: 'page-only', ranges: [] })
  })

  it('RectsLocator converts PDF points to page fractions', async () => {
    const res = await new RectsLocator().locate({ ...base, rects: [{ page: 2, x0: 60, y0: 80, x1: 300, y1: 160 }] }, surface)
    expect(res.ranges[0].rects[0]).toEqual({ x: 0.1, y: 0.1, w: 0.4, h: 0.1 })
  })

  it('chooseLocator routes image + bbox to BBoxLocator (before rects); other kinds are unchanged', () => {
    const img = { ...base, kind: 'image' as const, bbox: [0.1, 0.2, 0.5, 0.6] as [number, number, number, number] }
    expect(chooseLocator(img)).toBeInstanceOf(BBoxLocator)
    expect(chooseLocator({ ...img, rects: [{ page: 2, x0: 0, y0: 0, x1: 1, y1: 1 }] })).toBeInstanceOf(BBoxLocator)
    expect(chooseLocator({ ...img, bbox: null })).toBeInstanceOf(TextMatchLocator)
    expect(chooseLocator({ ...base, kind: 'text' })).toBeInstanceOf(TextMatchLocator)
  })

  it('BBoxLocator turns the normalized bbox into one box rect on its page, no matter the page size', async () => {
    const img = { ...base, content: '', kind: 'image' as const, bbox: [0.1, 0.2, 0.5, 0.6] as [number, number, number, number] }
    const res = await new BBoxLocator().locate(img, surface)
    expect(res.quality).toBe('bbox')
    expect(res.ranges).toHaveLength(1)
    expect(res.ranges[0]).toMatchObject({ page: 2, box: true })
    expect(res.ranges[0].rects[0].x).toBeCloseTo(0.1)
    expect(res.ranges[0].rects[0].y).toBeCloseTo(0.2)
    expect(res.ranges[0].rects[0].w).toBeCloseTo(0.4)
    expect(res.ranges[0].rects[0].h).toBeCloseTo(0.4)
  })

  it('BBoxLocator degrades to page-only on a malformed bbox or a missing page', async () => {
    const bad = { ...base, kind: 'image' as const, bbox: [0.5, 0.5, 0.2, 0.2] as [number, number, number, number] }
    expect(await new BBoxLocator().locate(bad, surface)).toEqual({ quality: 'page-only', ranges: [] })
    expect(await new BBoxLocator().locate({ ...bad, bbox: [0, 0, 0.5, 0.5], page: null }, surface)).toEqual({ quality: 'page-only', ranges: [] })
  })

  it('chooseLocator routes kind audio to TimeLocator, even with a (stale) bbox or rects', () => {
    const audio = { ...base, page: null, kind: 'audio' as const, tStart: 80, tEnd: 100 }
    expect(chooseLocator(audio)).toBeInstanceOf(TimeLocator)
    expect(chooseLocator({ ...audio, rects: [{ page: 2, x0: 0, y0: 0, x1: 1, y1: 1 }] })).toBeInstanceOf(TimeLocator)
    expect(chooseLocator({ ...base, kind: 'text' })).toBeInstanceOf(TextMatchLocator)
  })

  it('chooseLocator routes kind video (a frame) to TimeLocator too; the band covers the frame range', async () => {
    const frame = { ...base, page: null, kind: 'video' as const, tStart: 30, tEnd: 60 }
    expect(chooseLocator(frame)).toBeInstanceOf(TimeLocator)
    expect(chooseLocator({ ...frame, bbox: [0, 0, 0.5, 0.5] as [number, number, number, number] })).toBeInstanceOf(TimeLocator)
    const res = await chooseLocator(frame).locate(frame, { ...surface, duration: () => 120 })
    expect(res.quality).toBe('time')
    expect(res.ranges[0].rects[0]).toEqual({ x: 0.25, y: 0, w: 0.25, h: 1 })
  })

  it('TimeLocator turns seconds into a band over the duration (time -> x), independent of width', async () => {
    const timed: TextSurface = { ...surface, duration: () => 200 }
    const res = await new TimeLocator().locate({ ...base, page: null, kind: 'audio', tStart: 80, tEnd: 100 }, timed)
    expect(res.quality).toBe('time')
    expect(res.ranges[0]).toMatchObject({ page: null, box: true })
    expect(res.ranges[0].rects[0]).toEqual({ x: 0.4, y: 0, w: 0.1, h: 1 })
  })

  it('TimeLocator without start is page-only; without duration or end it is still `time` but paints nothing', async () => {
    const timed: TextSurface = { ...surface, duration: () => 200 }
    expect(await new TimeLocator().locate({ ...base, page: null, kind: 'audio', tStart: null }, timed)).toEqual({ quality: 'page-only', ranges: [] })
    expect(await new TimeLocator().locate({ ...base, page: null, kind: 'audio', tStart: 80, tEnd: 100 }, surface)).toEqual({ quality: 'time', ranges: [] })
    expect(await new TimeLocator().locate({ ...base, page: null, kind: 'audio', tStart: 80, tEnd: null }, timed)).toEqual({ quality: 'time', ranges: [] })
  })
})
