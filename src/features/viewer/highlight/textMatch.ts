import { normalize, type Normalized } from './normalize'

export interface PageText { page: number | null; text: string }
export interface MatchSpan { page: number | null; start: number; end: number }
export interface TextMatch { quality: 'exact' | 'anchored' | 'snippet'; spans: MatchSpan[] }

const ANCHOR = 60
const MIN_ANCHORED = 90
const SEGMENT_MIN = 24 // normalized chars per segment: long enough to be unique, short enough to localize
const MIN_COVERAGE = 0.6

/** Pages joined into one comparison string; `first[k]` is where page `k` starts in it. */
function join(pages: PageText[]) {
  const parts = pages.map((p) => normalize(p.text))
  const first: number[] = []
  let at = 0
  for (const p of parts) { first.push(at); at += p.s.length }
  const owner = parts.flatMap((p, k) => Array<number>(p.s.length).fill(k))
  return { parts, owner, first, s: parts.map((p) => p.s).join('') }
}
type Joined = ReturnType<typeof join>

function spansFor(pages: PageText[], j: Joined, a: number, b: number): MatchSpan[] {
  const spans: MatchSpan[] = []
  for (let k = j.owner[a]; k <= j.owner[b - 1]; k++) {
    const n: Normalized = j.parts[k]
    const lo = Math.max(a, j.first[k]) - j.first[k]
    const hi = Math.min(b, j.first[k] + n.s.length) - j.first[k]
    if (hi > lo) spans.push({ page: pages[k].page, start: n.starts[lo], end: n.ends[hi - 1] })
  }
  return spans
}

function anchored(hay: string, needle: string): [number, number] | null {
  if (needle.length < MIN_ANCHORED) return null
  const head = needle.slice(0, ANCHOR)
  const tail = needle.slice(-ANCHOR)
  const reach = needle.length * 1.5 + 100
  for (let h = hay.indexOf(head); h !== -1; h = hay.indexOf(head, h + 1)) {
    const t = hay.indexOf(tail, h + ANCHOR)
    if (t !== -1 && t + ANCHOR - h <= reach) return [h, t + ANCHOR]
  }
  return null
}

/** Content cut at line breaks into groups of at least `SEGMENT_MIN` normalized chars. */
function segmentsOf(content: string): string[] {
  const out: string[] = []
  let group = ''
  for (const line of content.split('\n')) {
    group = group ? `${group}\n${line}` : line
    if (normalize(group).s.length >= SEGMENT_MIN) { out.push(group); group = '' }
  }
  if (group && normalize(group).s) out.push(group)
  return out
}

/** One span per page, from the first to the last located segment on it. */
function mergeByPage(spans: MatchSpan[]): MatchSpan[] {
  const merged: MatchSpan[] = []
  for (const s of spans) {
    const last = merged[merged.length - 1]
    if (last && last.page === s.page) last.end = Math.max(last.end, s.end)
    else merged.push({ ...s })
  }
  return merged
}

/**
 * Tolerant match: the backend strips running headers/footers and page numbers from `content`,
 * so a chunk that crosses a page has no header text between its parts and the continuous
 * string is not in the text layer. Each segment is located in order (skipping those the layer
 * does not have) and the pieces are merged per page. `exact` only when every segment was found.
 */
function segmented(j: Joined, pages: PageText[], content: string): TextMatch | null {
  const segs = segmentsOf(content).map((g) => normalize(g).s)
  const total = segs.reduce((n, g) => n + g.length, 0)
  let cursor = 0
  let found = 0
  const spans: MatchSpan[] = []
  for (const seg of segs) {
    const at = j.s.indexOf(seg, cursor)
    if (at === -1) continue
    cursor = at + seg.length
    found += seg.length
    spans.push(...spansFor(pages, j, at, cursor))
  }
  if (total === 0 || found / total < MIN_COVERAGE) return null
  return { quality: found === total ? 'exact' : 'anchored', spans: mergeByPage(spans) }
}

/**
 * Locates a chunk in the text of its pages. Order (plan §7.3): whole content, then segment by
 * segment (header-tolerant), then both ends of it, then the snippet. `null` = no reliable match (also when `content` is null:
 * old messages jump to the page without painting anything).
 */
export function matchText(pages: PageText[], content: string | null, snippet: string): TextMatch | null {
  if (content == null || pages.length === 0) return null
  const j = join(pages)
  const need = normalize(content).s
  if (!need) return null
  const whole = j.s.indexOf(need)
  if (whole !== -1) return { quality: 'exact', spans: spansFor(pages, j, whole, whole + need.length) }
  const parts = segmented(j, pages, content)
  if (parts) return parts
  const tries: [TextMatch['quality'], () => [number, number] | null][] = [
    ['anchored', () => anchored(j.s, need)],
    ['snippet', () => {
      const sn = normalize(snippet.replace(/(…|\.{3})\s*$/, '')).s
      const i = sn.length >= 12 ? j.s.indexOf(sn) : -1
      return i === -1 ? null : [i, i + sn.length]
    }],
  ]
  for (const [quality, find] of tries) {
    const range = find()
    if (range) return { quality, spans: spansFor(pages, j, range[0], range[1]) }
  }
  return null
}
