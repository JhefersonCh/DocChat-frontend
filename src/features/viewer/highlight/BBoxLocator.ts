import { bboxToRect } from '@/domain/media'
import type { HighlightLocator, HighlightResult, HighlightTarget, TextSurface } from './types'

/**
 * Image citations on a PDF: the backend ships a normalized bbox (0-1 over the page), so the box is just
 * the fractions themselves: no text matching, no page size, independent of zoom. A malformed bbox
 * degrades to page-only (jump to the page, paint nothing).
 */
export class BBoxLocator implements HighlightLocator {
  async locate(target: HighlightTarget, _surface: TextSurface): Promise<HighlightResult> {
    const rect = target.page != null && target.bbox ? bboxToRect(target.bbox) : null
    if (!rect) return { quality: 'page-only', ranges: [] }
    return { quality: 'bbox', ranges: [{ page: target.page, start: 0, end: 0, rects: [rect], box: true }] }
  }
}
