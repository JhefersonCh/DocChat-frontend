export interface Pt { x: number; y: number }

// Room for the label (centered below the node, up to ~22 chars at 9px) so edge nodes are not clipped.
const MARGIN_X = 64
const MARGIN_Y = 28

/**
 * Force-directed layout, deterministic (nodes start on a circle): pairwise repulsion, spring edges,
 * gentle gravity to the center. Synchronous and pure, so reduced-motion users just get the settled result.
 */
export function layout(ids: string[], edges: { source: string; target: string }[], width: number, height: number, iterations = 260): Record<string, Pt> {
  const n = ids.length
  const cx = width / 2
  const cy = height / 2
  const pos: Pt[] = ids.map((_, i) => {
    const a = (i / Math.max(n, 1)) * Math.PI * 2
    const r = Math.min(width, height) * 0.35
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }
  })
  const index = new Map(ids.map((id, i) => [id, i]))
  const links = edges.flatMap((e) => {
    const a = index.get(e.source)
    const b = index.get(e.target)
    return a === undefined || b === undefined || a === b ? [] : [[a, b] as const]
  })
  const k = Math.sqrt((width * height) / Math.max(n, 1)) * 0.8
  for (let it = 0; it < iterations; it++) {
    const cool = 1 - it / iterations
    const force: Pt[] = pos.map(() => ({ x: 0, y: 0 }))
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pos[i].x - pos[j].x
        let dy = pos[i].y - pos[j].y
        let d2 = dx * dx + dy * dy
        if (d2 < 0.01) { dx = (i - j) * 0.1; dy = 0.1; d2 = dx * dx + dy * dy }
        const d = Math.sqrt(d2)
        const f = (k * k) / d
        force[i].x += (dx / d) * f; force[i].y += (dy / d) * f
        force[j].x -= (dx / d) * f; force[j].y -= (dy / d) * f
      }
    }
    for (const [a, b] of links) {
      const dx = pos[b].x - pos[a].x
      const dy = pos[b].y - pos[a].y
      const d = Math.sqrt(dx * dx + dy * dy) || 1
      const f = (d * d) / k
      force[a].x += (dx / d) * f; force[a].y += (dy / d) * f
      force[b].x -= (dx / d) * f; force[b].y -= (dy / d) * f
    }
    for (let i = 0; i < n; i++) {
      force[i].x += (cx - pos[i].x) * 0.05
      force[i].y += (cy - pos[i].y) * 0.05
      const mag = Math.sqrt(force[i].x ** 2 + force[i].y ** 2) || 1
      const step = Math.min(mag, 30 * cool + 1)
      pos[i].x = Math.min(width - MARGIN_X, Math.max(MARGIN_X, pos[i].x + (force[i].x / mag) * step))
      pos[i].y = Math.min(height - MARGIN_Y, Math.max(MARGIN_Y, pos[i].y + (force[i].y / mag) * step))
    }
  }
  return Object.fromEntries(ids.map((id, i) => [id, pos[i]]))
}

/** Ids adjacent to `id` (for hover highlighting). */
export function neighbors(id: string, edges: { source: string; target: string }[]): Set<string> {
  const out = new Set<string>()
  for (const e of edges) {
    if (e.source === id) out.add(e.target)
    if (e.target === id) out.add(e.source)
  }
  return out
}
