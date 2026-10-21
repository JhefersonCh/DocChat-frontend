import type { BBox, Citation, CitationKind, CitationRect } from '@/domain/types'

/** What the viewer needs from a citation to find the chunk (plan §7.3). */
export interface HighlightTarget {
  documentId: string
  page: number | null
  pageEnd: number | null
  content: string | null
  snippet: string
  rects?: CitationRect[] | null
  /** `image` + `bbox` -> BBoxLocator. */
  kind?: CitationKind
  bbox?: BBox | null
  /** `audio` / `video` + `tStart` -> TimeLocator (seconds). */
  tStart?: number | null
  tEnd?: number | null
}

/** Rectangle as a fraction (0..1) of the rendered page box: survives zoom and resize. */
export interface PageRect { x: number; y: number; w: number; h: number }

/** One highlighted run on one page (`null` = continuous text). `start/end` index the page text. */
export interface HighlightRange {
  page: number | null
  start: number
  end: number
  rects: PageRect[]
  /** Region of an image (outline box) rather than a text run (marker). */
  box?: boolean
}

/** How well the chunk was located. `page-only` = jump to the page, nothing to paint. */
export type MatchQuality = 'exact' | 'anchored' | 'snippet' | 'rects' | 'bbox' | 'time' | 'page-only'

export interface HighlightResult {
  quality: MatchQuality
  ranges: HighlightRange[]
}

/** The only thing a viewer exposes to locators: plain text per page + geometry. */
export interface TextSurface {
  /** Plain text of a page, or null when it cannot be produced (not rendered / out of range). */
  pageText(page: number | null): Promise<string | null>
  /** Page-relative rects for `[start, end)` of that page's text. Empty when unsupported. */
  rects(page: number | null, start: number, end: number): PageRect[]
  /** Page size in PDF points, when known. */
  pageSize(page: number): { width: number; height: number } | null
  /** Length in seconds of a timed source (audio); absent / null for paged ones. */
  duration?(): number | null
}

export interface HighlightLocator {
  locate(target: HighlightTarget, surface: TextSurface): Promise<HighlightResult>
}

export const toTarget = (c: Citation): HighlightTarget => ({
  documentId: c.document_id,
  page: c.page,
  pageEnd: c.page_end,
  content: c.content,
  snippet: c.snippet,
  rects: c.rects,
  kind: c.kind,
  bbox: c.bbox,
  tStart: c.t_start,
  tEnd: c.t_end,
})
