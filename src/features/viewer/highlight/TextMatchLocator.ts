import type { HighlightLocator, HighlightResult, HighlightTarget, TextSurface } from './types'
import { matchText, type PageText } from './textMatch'

const PAGE_ONLY: HighlightResult = { quality: 'page-only', ranges: [] }

/** Pages the chunk lives on: `[null]` for continuous text, else `page..page_end`. */
export function pagesOf(t: Pick<HighlightTarget, 'page' | 'pageEnd'>): (number | null)[] {
  if (t.page == null) return [null]
  const last = Math.max(t.page, t.pageEnd ?? t.page)
  return Array.from({ length: last - t.page + 1 }, (_, i) => t.page! + i)
}

/** MVP strategy: find `content` in the viewer's own text (plan §7.3). Never throws. */
export class TextMatchLocator implements HighlightLocator {
  async locate(target: HighlightTarget, surface: TextSurface): Promise<HighlightResult> {
    if (target.content == null) return PAGE_ONLY
    const texts = await Promise.all(pagesOf(target).map(async (page) => ({ page, text: await surface.pageText(page) })))
    const pages = texts.filter((p): p is PageText => p.text != null)
    const match = matchText(pages, target.content, target.snippet)
    if (!match) return PAGE_ONLY
    return {
      quality: match.quality,
      ranges: match.spans.map((s) => ({ ...s, rects: surface.rects(s.page, s.start, s.end) })),
    }
  }
}
