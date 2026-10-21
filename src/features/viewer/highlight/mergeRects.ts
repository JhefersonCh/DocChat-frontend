import type { PageRect } from './types'

/** Joins rects on the same text line that touch or nearly touch (one box per line, not per item). */
export function mergeRects(rects: PageRect[], gap = 0.004): PageRect[] {
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x)
  const out: PageRect[] = []
  for (const r of sorted) {
    const p = out.at(-1)
    const sameLine = p && Math.abs(p.y - r.y) < Math.min(p.h, r.h) * 0.5
    if (p && sameLine && r.x <= p.x + p.w + gap) {
      const x = Math.min(p.x, r.x)
      const y = Math.min(p.y, r.y)
      out[out.length - 1] = { x, y, w: Math.max(p.x + p.w, r.x + r.w) - x, h: Math.max(p.y + p.h, r.y + r.h) - y }
    } else out.push({ ...r })
  }
  return out
}
