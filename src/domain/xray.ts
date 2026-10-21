// Retrieval X-ray: where on the document each retrieved chunk sits. Pure geometry, no React.
import { cleanBBox } from './media'
import { formatRange } from './time'
import type { BBox, Found, Search } from './types'

/** A vertical slice of the scrollable document, as fractions (0..1) of its total height. */
export interface Band { top: number; height: number }
export interface Span { y: number; h: number }

export const MAX_LANES = 4
const MIN_HEAT = 0.3

/** Page boxes (px from the top of the scroll content) -> fractions of `total`. Index i = page i + 1. */
export function bandsFromRects(rects: { top: number; height: number }[], total: number): Band[] {
  if (total <= 0) return []
  return rects.map((r) => ({ top: r.top / total, height: r.height / total }))
}

/** y/h of a page range (1-based, inclusive); null when a page is unknown (not measured yet). */
export function pageSpan(bands: readonly Band[], start: number | null, end?: number | null): Span | null {
  if (start == null) return null
  const first = bands[start - 1]
  const last = bands[Math.max(start, end ?? start) - 1] ?? first
  if (!first || !last) return null
  return { y: first.top, h: Math.max(0, last.top + last.height - first.top) }
}

/** Narrows a page's span to the vertical slice a bbox covers on it (image hits sit where the picture is). */
export function bboxSpan(page: Span, bbox: BBox | null | undefined): Span {
  const b = cleanBBox(bbox)
  return b ? { y: page.y + b[1] * page.h, h: (b[3] - b[1]) * page.h } : page
}

/** Text documents have no pages: chunk `ordinal` of `total` splits the height evenly. */
export function ordinalSpan(ordinal: number, total: number): Span | null {
  if (total <= 0 || ordinal < 0 || ordinal >= total) return null
  return { y: ordinal / total, h: 1 / total }
}

/** Score -> 0.3..1 relative to the answer's own range (cosines cluster: absolute values read flat). */
export function heat(score: number | null, lo: number, hi: number): number {
  if (score == null) return 0.55
  if (hi <= lo) return 1
  return MIN_HEAT + (1 - MIN_HEAT) * Math.min(1, Math.max(0, (score - lo) / (hi - lo)))
}

export interface Tick {
  key: string
  search: number // index of the search (sequence number - 1)
  lane: number
  y: number
  h: number
  heat: number
  cited: boolean
  panorama: boolean
  /** An image segment (drawn hatched); text ticks are solid. */
  media: boolean
  hit: Found
}

/**
 * One tick per (search, hit) the `place` function can position. Lanes keep each query apart
 * (the 5th and later share the last one); `cited` hits are the ones the answer used.
 */
export function layoutTicks(
  searches: readonly Search[],
  place: (hit: Found) => Span | null,
  cited: ReadonlySet<number>,
): Tick[] {
  const scores = searches.flatMap((s) => (s.found ?? []).map((f) => f.score).filter((x): x is number => x != null))
  const lo = Math.min(...scores), hi = Math.max(...scores)
  const ticks: Tick[] = []
  searches.forEach((s, search) => {
    for (const hit of s.found ?? []) {
      const at = place(hit)
      if (!at) continue
      ticks.push({
        key: `${search}:${hit.chunk_id ?? hit.n}`, search, lane: Math.min(search, MAX_LANES - 1), ...at,
        heat: heat(hit.score, lo, hi), cited: cited.has(hit.n), panorama: !!s.panorama, media: !!hit.kind && hit.kind !== 'text', hit,
      })
    }
  })
  return ticks
}

/** Lanes actually in use (>= 1): the strip splits its width in that many. */
export const laneCount = (searches: readonly Search[]) => Math.min(Math.max(searches.length, 1), MAX_LANES)

/** Tooltip lines of a tick: which query found it, where it is and how relevant it was. */
export function tickLabel(t: Tick, query: string): string[] {
  const { page_start: a, page_end: b, section, score, t_start: ts, t_end: te } = t.hit
  const pages = ts != null ? formatRange(ts, te) : a == null ? null : b != null && b !== a ? `pág. ${a}–${b}` : `pág. ${a}`
  const where = [t.hit.kind === 'audio' ? 'audio' : t.hit.kind === 'video' ? 'fotograma' : t.media ? 'imagen' : null, pages, section && `§${section.replace(/\s+/g, ' ').trim().slice(0, 48)}`].filter(Boolean).join(' · ')
  const q = t.panorama ? `#${t.search + 1} panorama` : `#${t.search + 1} «${query.slice(0, 40)}»`
  const rel = score == null ? null : `relevancia ${Math.round(score * 100)}%`
  return [q, where || 'sin página', [rel, t.cited ? `citada [${t.hit.n}]` : null].filter(Boolean).join(' · ')].filter(Boolean)
}
