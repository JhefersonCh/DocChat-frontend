// Concept maps (Estudio): pure layout / geometry / export helpers. No React, no DOM.
import type { ConceptLink, ConceptMapData, ConceptNode } from './artifacts'

export interface Box { id: string; cx: number; cy: number; w: number; h: number; lines: string[] }
export type Orientation = 'down' | 'right'
export interface MapLayout { boxes: Map<string, Box>; width: number; height: number; minX: number; minY: number; orientation: Orientation }
export interface Edge { d: string; mx: number; my: number; w: number }
/** Where along the curve the linking phrase sits: nearer the target so fans of edges do not pile their labels up. */
const LABEL_AT = 0.6

const GAP_BREADTH = { down: 26, right: 16 } as const // between siblings
const GAP_DEPTH = { down: 74, right: 190 } as const // between layers (right leaves room for the link label)
const PAD = 40
const LABEL_H = 18

export const ROOT_FONT = 17
export const NODE_FONT = 13

/** Greedy word wrap into at most `maxLines` lines of about `maxChars` (the last one is ellipsized). */
export function wrapLabel(text: string, maxChars: number, maxLines = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    if (line && (line + ' ' + w).length > maxChars) { lines.push(line); line = w } else line = line ? `${line} ${w}` : w
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/…$/, '')}…`
    return kept
  }
  return lines.length ? lines : ['·']
}

export const isRoot = (data: ConceptMapData, id: string) => data.root_id === id

/** Tree structure: the `jerarquia` link that discovered a node makes the endpoint with the higher level its child. */
export function treeOf(data: ConceptMapData) {
  const level = new Map(data.nodes.map((n) => [n.id, n.level]))
  const parent = new Map<string, string>()
  const children = new Map<string, string[]>()
  for (const l of data.links) {
    if (l.kind !== 'jerarquia') continue
    const [p, c] = (level.get(l.source) ?? 0) <= (level.get(l.target) ?? 0) ? [l.source, l.target] : [l.target, l.source]
    if (parent.has(c) || p === c) continue
    parent.set(c, p)
    children.set(p, [...(children.get(p) ?? []), c])
  }
  return { parent, children }
}

/** Ids hidden because an ancestor is collapsed. */
export function hiddenIds(data: ConceptMapData, collapsed: ReadonlySet<string>): Set<string> {
  const { children } = treeOf(data)
  const hidden = new Set<string>()
  const walk = (id: string, under: boolean) => {
    if (under) hidden.add(id)
    for (const c of children.get(id) ?? []) walk(c, under || collapsed.has(id))
  }
  walk(data.root_id, false)
  return hidden
}

/** Descendant count of a node along the tree. */
export function descendants(data: ConceptMapData, id: string): number {
  const { children } = treeOf(data)
  const count = (n: string): number => (children.get(n) ?? []).reduce((s, c) => s + 1 + count(c), 0)
  return count(id)
}

/** Ids from a node up to the root (excluded): what must be expanded for it to be visible. */
export function ancestorsOf(data: ConceptMapData, id: string): string[] {
  const { parent } = treeOf(data)
  const out: string[] = []
  for (let p = parent.get(id); p; p = parent.get(p)) out.push(p)
  return out
}

/** Collapsed-by-default set for big maps (phones): everything below `level` starts folded. */
export function foldBelow(data: ConceptMapData, level: number): Set<string> {
  const { children } = treeOf(data)
  return new Set(data.nodes.filter((n) => n.level === level && (children.get(n.id)?.length ?? 0) > 0).map((n) => n.id))
}

export function sizeOf(n: ConceptNode, root: boolean, compact: boolean): Box {
  const font = root ? ROOT_FONT : NODE_FONT
  const lines = wrapLabel(n.label, compact ? 15 : root ? 20 : 22, root ? 3 : 3)
  const longest = Math.max(...lines.map((l) => l.length))
  const w = Math.max(root ? 120 : 84, Math.ceil(longest * font * 0.55) + 30)
  const h = lines.length * Math.round(font * 1.25) + (root ? 22 : 18)
  return { id: n.id, cx: 0, cy: 0, w, h, lines }
}

/**
 * Top-down layered ("Sugiyama-lite") layout of the visible nodes: layer = concept level; siblings are
 * packed as a tidy tree (parents centered over their children) and reordered by the barycenter of
 * their cross-link neighbours to cut crossings. Deterministic and synchronous.
 */
export function layoutConceptMap(data: ConceptMapData, hidden: ReadonlySet<string> = new Set(), compact = false, orientation: Orientation = 'down'): MapLayout {
  const nodes = data.nodes.filter((n) => !hidden.has(n.id))
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const boxes = new Map(nodes.map((n) => [n.id, sizeOf(n, n.id === data.root_id, compact)]))
  const right = orientation === 'right'
  const gapB = GAP_BREADTH[orientation]
  const breadth = (id: string) => (right ? boxes.get(id)!.h : boxes.get(id)!.w)
  const depthOf = (id: string) => (right ? boxes.get(id)!.w : boxes.get(id)!.h)
  const { children: allChildren, parent } = treeOf(data)
  const kids = new Map<string, string[]>()
  for (const n of nodes) kids.set(n.id, (allChildren.get(n.id) ?? []).filter((c) => byId.has(c)))
  const cross = new Map<string, string[]>()
  for (const l of data.links) {
    if (!byId.has(l.source) || !byId.has(l.target)) continue
    const tree = parent.get(l.target) === l.source || parent.get(l.source) === l.target
    if (tree && l.kind === 'jerarquia') continue
    cross.set(l.source, [...(cross.get(l.source) ?? []), l.target])
    cross.set(l.target, [...(cross.get(l.target) ?? []), l.source])
  }
  const roots = nodes.filter((n) => n.id === data.root_id || !parent.has(n.id) || !byId.has(parent.get(n.id)!)).map((n) => n.id)
  const x = new Map<string, number>()

  const span = new Map<string, number>()
  const measure = (id: string): number => {
    const own = breadth(id) + gapB
    const total = (kids.get(id) ?? []).reduce((s, c) => s + measure(c), 0)
    span.set(id, Math.max(own, total))
    return span.get(id)!
  }
  const place = (id: string, left: number) => {
    const list = kids.get(id) ?? []
    const total = list.reduce((s, c) => s + span.get(c)!, 0)
    let cursor = left + (span.get(id)! - total) / 2
    for (const c of list) { place(c, cursor); cursor += span.get(c)! }
    x.set(id, list.length ? (x.get(list[0])! + x.get(list[list.length - 1])!) / 2 : left + span.get(id)! / 2)
  }
  const run = () => {
    let left = 0
    for (const r of roots) { measure(r) }
    for (const r of roots) { place(r, left); left += span.get(r)! }
  }
  run()
  for (let pass = 0; pass < 3; pass++) {
    for (const [id, list] of kids) {
      if (list.length < 2) continue
      const key = (c: string) => {
        const near = (cross.get(c) ?? []).filter((o) => x.has(o))
        return near.length ? near.reduce((s, o) => s + x.get(o)!, 0) / near.length : x.get(c)!
      }
      const order = new Map(list.map((c, i) => [c, i]))
      kids.set(id, [...list].sort((a, b) => key(a) - key(b) || order.get(a)! - order.get(b)!))
    }
    run()
  }

  const layers = new Map<number, string[]>()
  for (const n of nodes) layers.set(n.level, [...(layers.get(n.level) ?? []), n.id])
  const ds = new Map<number, number>()
  let d = 0
  for (const lvl of [...layers.keys()].sort((a, b) => a - b)) {
    const deepest = Math.max(...layers.get(lvl)!.map(depthOf))
    ds.set(lvl, d + deepest / 2)
    d += deepest + GAP_DEPTH[orientation]
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const n of nodes) {
    const b = boxes.get(n.id)!
    const along = x.get(n.id) ?? 0
    const depth = ds.get(n.level) ?? 0
    b.cx = right ? depth : along
    b.cy = right ? along : depth
    minX = Math.min(minX, b.cx - b.w / 2); maxX = Math.max(maxX, b.cx + b.w / 2)
    minY = Math.min(minY, b.cy - b.h / 2); maxY = Math.max(maxY, b.cy + b.h / 2)
  }
  if (!nodes.length) { minX = maxX = minY = maxY = 0 }
  return { boxes, width: maxX - minX, height: maxY - minY, minX, minY, orientation }
}

/** Curved connector between two boxes: S-curve between layers (vertical or horizontal), an arc over a layer. */
export function edgeGeometry(a: Box, b: Box, label: string, orientation: Orientation = 'down'): Edge {
  const w = Math.min(label.length * 5.6 + 14, 170)
  let p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number]
  if (orientation === 'down') {
    if (Math.abs(b.cy - a.cy) > 4) {
      const down = b.cy > a.cy
      const x1 = a.cx, y1 = a.cy + (down ? a.h / 2 : -a.h / 2)
      const x2 = b.cx, y2 = b.cy + (down ? -b.h / 2 : b.h / 2)
      const k = Math.max(Math.abs(y2 - y1) * 0.5, 24) * (down ? 1 : -1)
      p0 = [x1, y1]; p1 = [x1, y1 + k]; p2 = [x2, y2 - k]; p3 = [x2, y2]
    } else {
      const right = b.cx > a.cx
      const x1 = a.cx + (right ? a.w / 2 : -a.w / 2), y1 = a.cy - a.h / 2 + 6
      const x2 = b.cx + (right ? -b.w / 2 : b.w / 2), y2 = b.cy - b.h / 2 + 6
      const lift = 34 + Math.min(Math.abs(x2 - x1) * 0.12, 40)
      p0 = [x1, y1]; p1 = [x1 + (x2 - x1) * 0.2, y1 - lift]; p2 = [x2 - (x2 - x1) * 0.2, y2 - lift]; p3 = [x2, y2]
    }
  } else if (Math.abs(b.cx - a.cx) > 4) {
    const fwd = b.cx > a.cx
    const x1 = a.cx + (fwd ? a.w / 2 : -a.w / 2), y1 = a.cy
    const x2 = b.cx + (fwd ? -b.w / 2 : b.w / 2), y2 = b.cy
    const k = Math.max(Math.abs(x2 - x1) * 0.5, 24) * (fwd ? 1 : -1)
    p0 = [x1, y1]; p1 = [x1 + k, y1]; p2 = [x2 - k, y2]; p3 = [x2, y2]
  } else {
    const dn = b.cy > a.cy
    const x1 = a.cx + a.w / 2 - 8, y1 = a.cy + (dn ? a.h / 2 : -a.h / 2)
    const x2 = b.cx + b.w / 2 - 8, y2 = b.cy + (dn ? -b.h / 2 : b.h / 2)
    const lift = 40 + Math.min(Math.abs(y2 - y1) * 0.1, 30)
    p0 = [x1, y1]; p1 = [x1 + lift, y1 + (y2 - y1) * 0.2]; p2 = [x2 + lift, y2 - (y2 - y1) * 0.2]; p3 = [x2, y2]
  }
  const f = (n: number) => Math.round(n * 10) / 10
  const arc = orientation === 'down' ? Math.abs(b.cy - a.cy) <= 4 : Math.abs(b.cx - a.cx) <= 4
  const t = arc ? 0.5 : LABEL_AT
  const mid = (i: 0 | 1) => (1 - t) ** 3 * p0[i] + 3 * (1 - t) ** 2 * t * p1[i] + 3 * (1 - t) * t * t * p2[i] + t ** 3 * p3[i]
  return {
    d: `M${f(p0[0])} ${f(p0[1])}C${f(p1[0])} ${f(p1[1])} ${f(p2[0])} ${f(p2[1])} ${f(p3[0])} ${f(p3[1])}`,
    mx: mid(0), my: mid(1), w,
  }
}

/** Nodes whose label / aliases / summary contain every word of `query` (accent and case insensitive). */
export function matchNodes(nodes: ConceptNode[], query: string): string[] {
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  return nodes
    .filter((n) => {
      const hay = fold([n.label, ...(n.aliases ?? []), n.summary].join(' '))
      return words.every((w) => hay.includes(w))
    })
    .sort((a, b) => Number(fold(b.label).includes(words[0])) - Number(fold(a.label).includes(words[0])))
    .map((n) => n.id)
}

/** Propositions touching a node, each read from that node's side: `{link, other, outgoing}`. */
export function connections(data: ConceptMapData, id: string) {
  const byId = new Map(data.nodes.map((n) => [n.id, n]))
  return data.links.flatMap((l) => {
    if (l.source !== id && l.target !== id) return []
    const other = byId.get(l.source === id ? l.target : l.source)
    return other ? [{ link: l, other, outgoing: l.source === id }] : []
  })
}

export const proposition = (data: ConceptMapData, l: ConceptLink) => {
  const byId = new Map(data.nodes.map((n) => [n.id, n.label]))
  return `${byId.get(l.source) ?? '?'} — ${l.label} → ${byId.get(l.target) ?? '?'}`
}

/** Palette for multi-source maps (amber is reserved for selection). */
export const SOURCE_COLORS = ['#7AA2F7', '#6FCF97', '#C792EA', '#FF8FA3', '#4DD0E1', '#E6C86E', '#9AA3AD', '#FF9E64']
/** Source of a node = the source of its first verified ref. */
export const sourceOf = (n: ConceptNode) => n.refs.find((r) => r.document_id)?.document_id ?? null

export function sourceColors(data: ConceptMapData): Map<string, string> {
  const ids = [...new Set(data.nodes.map(sourceOf).filter((s): s is string => !!s))]
  return new Map(ids.map((id, i) => [id, SOURCE_COLORS[i % SOURCE_COLORS.length]]))
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Standalone SVG of the visible map (inline styles, no external fonts) for the SVG / PNG exports. */
export function mapToSvg(data: ConceptMapData, layout: MapLayout, colors: ReadonlyMap<string, string> = new Map()): { svg: string; width: number; height: number } {
  const width = Math.ceil(layout.width + PAD * 2)
  const height = Math.ceil(layout.height + PAD * 2)
  const ox = PAD - layout.minX
  const oy = PAD - layout.minY
  const byId = new Map(data.nodes.map((n) => [n.id, n]))
  const edges = data.links.flatMap((l) => {
    const a = layout.boxes.get(l.source)
    const b = layout.boxes.get(l.target)
    if (!a || !b) return []
    const g = edgeGeometry(a, b, l.label, layout.orientation)
    const dash = l.kind === 'cruce' ? ' stroke-dasharray="5 4"' : ''
    return [
      `<path d="${g.d}" fill="none" stroke="#8A8F98" stroke-opacity="0.75" stroke-width="1.3"${dash} marker-end="url(#arr)"/>`,
      `<rect x="${g.mx - g.w / 2}" y="${g.my - LABEL_H / 2}" width="${g.w}" height="${LABEL_H}" rx="9" fill="#0B0C0E" stroke="#2E333B"/>`,
      `<text x="${g.mx}" y="${g.my + 3.5}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="10" fill="#FFB000">${esc(l.label.length > 28 ? `${l.label.slice(0, 27)}…` : l.label)}</text>`,
    ]
  })
  const nodes = [...layout.boxes.values()].map((b) => {
    const n = byId.get(b.id)!
    const root = n.id === data.root_id
    const font = root ? ROOT_FONT : NODE_FONT
    const color = colors.get(sourceOf(n) ?? '')
    const lh = Math.round(font * 1.25)
    const text = b.lines
      .map((line, i) => `<text x="${b.cx}" y="${b.cy - b.h / 2 + (root ? 11 : 9) + lh * (i + 0.8)}" text-anchor="middle" font-family="Georgia,serif" font-size="${font}"${n.kind === 'ejemplo' ? ' font-style="italic"' : ''} fill="${root ? '#FFFFFF' : '#D9DCE1'}">${esc(line)}</text>`)
      .join('')
    return [
      `<rect x="${b.cx - b.w / 2}" y="${b.cy - b.h / 2}" width="${b.w}" height="${b.h}" rx="${n.kind === 'ejemplo' ? b.h / 2 : 6}" fill="${root ? '#2a2210' : '#1A1D22'}" stroke="${root ? '#FFB000' : '#2E333B'}" stroke-width="${root ? 1.6 : 1}"${n.kind === 'ejemplo' ? ' stroke-dasharray="3 3"' : ''}/>`,
      color ? `<rect x="${b.cx - b.w / 2}" y="${b.cy - b.h / 2 + 5}" width="3" height="${b.h - 10}" rx="1.5" fill="${color}"/>` : '',
      text,
    ].join('')
  })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="#8A8F98"/></marker></defs><rect width="100%" height="100%" fill="#0B0C0E"/><g transform="translate(${ox} ${oy})">${edges.join('')}${nodes.join('')}</g></svg>`
  return { svg, width, height }
}

export const mapFileName = (title: string, ext: string) =>
  `${title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'mapa-conceptual'}.${ext}`
