// Where in the rendered answer is the sentence being spoken? Pure string alignment: the DOM text
// still has citation chips, list markers and curly quotes, so compare letters/digits only and
// anchor on the sentence's head and tail (whatever sits in the middle is irrelevant).

const ANCHOR = 18

interface Folded { text: string; index: number[] }

/** Lowercase letters/digits only, with each kept char's offset in the original string. */
function fold(raw: string): Folded {
  // Short stand-alone numbers are blanked on both sides: in the DOM they may be citation chips.
  const s = raw.replace(/(?<=^|\s)\d{1,2}(?=\s|$|[.,;:])/g, (m) => ' '.repeat(m.length))
  let text = ''
  const index: number[] = []
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    if (/[\p{L}\p{N}]/u.test(c)) { text += c[0]; index.push(i) }
  }
  return { text, index }
}

/** [start, end) offsets in `haystack` of `sentence`, searching from `from`; null if not found. */
export function findSpoken(haystack: string, sentence: string, from = 0): [number, number] | null {
  const h = fold(haystack)
  const n = fold(sentence).text
  if (n.length < 4) return null
  const head = n.slice(0, ANCHOR)
  const tail = n.slice(-ANCHOR)
  const startFolded = h.index.findIndex((o) => o >= from)
  if (startFolded < 0) return null
  const s = h.text.indexOf(head, startFolded)
  if (s < 0) return null
  const e = n.length <= ANCHOR ? s + n.length : h.text.indexOf(tail, s + head.length - tail.length)
  if (e < 0) return null
  const endFolded = (n.length <= ANCHOR ? s + n.length : e + tail.length) - 1
  return [h.index[s]!, h.index[Math.min(endFolded, h.index.length - 1)]! + 1]
}
