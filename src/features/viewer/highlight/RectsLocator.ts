import type { HighlightLocator, HighlightResult, HighlightTarget, TextSurface } from './types'

/**
 * Future strategy: the backend ships `citation.rects` (PDF points, origin top-left).
 * Converts them to page fractions with the page size; no text matching involved.
 */
export class RectsLocator implements HighlightLocator {
  async locate(target: HighlightTarget, surface: TextSurface): Promise<HighlightResult> {
    const ranges: HighlightResult['ranges'] = []
    for (const r of target.rects ?? []) {
      const size = surface.pageSize(r.page)
      if (!size) continue
      const rect = { x: r.x0 / size.width, y: r.y0 / size.height, w: (r.x1 - r.x0) / size.width, h: (r.y1 - r.y0) / size.height }
      const last = ranges.at(-1)
      if (last && last.page === r.page) last.rects.push(rect)
      else ranges.push({ page: r.page, start: 0, end: 0, rects: [rect] })
    }
    return ranges.length ? { quality: 'rects', ranges } : { quality: 'page-only', ranges: [] }
  }
}
