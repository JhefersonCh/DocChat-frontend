/**
 * Comparison form of a text, with a map back to the original offsets.
 *
 * PyMuPDF (chunk `content`) and pdf.js (text layer) disagree on whitespace, ligatures,
 * soft hyphens and end-of-line hyphenation, so both sides go through the same function:
 * no whitespace, no accents, lowercase, NFKC-folded, quotes/dashes unified and
 * `letter-\nletter` re-joined. `starts[i]`/`ends[i]` delimit the original chars behind `s[i]`.
 */
export interface Normalized {
  s: string
  starts: number[]
  ends: number[]
}

const INVISIBLE = /^[­​-‍⁠﻿]$/
const HYPHEN = /^[-‐‑]$/
const DASH = /^[‒-―−]$/
const QUOTE_SINGLE = /^[‘’‚‛′]$/
const QUOTE_DOUBLE = /^[“”„‟″]$/
const LETTER = /^\p{L}$/u

export function normalize(text: string): Normalized {
  let s = ''
  const starts: number[] = []
  const ends: number[] = []
  const push = (out: string, from: number, to: number) => {
    for (const ch of out) {
      s += ch
      starts.push(from)
      ends.push(to)
    }
  }
  const lastChar = () => (s.length ? String.fromCodePoint(s.codePointAt(s.length - 1) ?? 0) : '')

  let i = 0
  while (i < text.length) {
    const cp = text.codePointAt(i) ?? 0
    const ch = String.fromCodePoint(cp)
    const next = i + ch.length
    if (/^\s$/u.test(ch) || INVISIBLE.test(ch)) {
      i = next
    } else if (HYPHEN.test(ch)) {
      let j = next
      let newline = false
      while (j < text.length && /\s/u.test(text[j])) newline ||= text[j++] === '\n'
      const after = text.codePointAt(j)
      const joins = newline && LETTER.test(lastChar()) && after != null && LETTER.test(String.fromCodePoint(after))
      if (!joins) push('-', i, next)
      i = next
    } else {
      const out = DASH.test(ch) ? '-' : QUOTE_SINGLE.test(ch) ? "'" : QUOTE_DOUBLE.test(ch) ? '"'
        : ch.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
      push(out, i, next)
      i = next
    }
  }
  return { s, starts, ends }
}
