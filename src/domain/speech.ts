// Text -> speakable sentences. Pure. `stripForSpeech` mirrors backend/src/chat_pdf/domain/speech.py
// (same test vectors in speech.test.ts and backend/tests/test_voice.py).

const FENCE = /```[\s\S]*?(```|$)/g
const IMAGE = /!\[([^\]]*)\]\([^)]*\)/g
const LINK = /\[([^\]]+)\]\([^)]*\)/g
const CITATION = /\s*\[\s*\d+(?:\s*[,;–-]\s*\d+)*\s*\]/g
const HEADING = /^\s{0,3}#{1,6}\s+/gm
const LIST_MARK = /^\s*(?:[-*+•]|\d{1,3}[.)])\s+/gm
const QUOTE = /^\s{0,3}>\s?/gm
const RULE = /^\s*(?:[-*_]\s*){3,}$/gm
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/gm
const EMPHASIS = /(?:(\*\*|\*|~~)(?=\S)([\s\S]+?)(?<=\S)\1|(?<![\p{L}\p{N}_])(__|_)(?=\S)([\s\S]+?)(?<=\S)\3(?![\p{L}\p{N}_]))/gu
const UNSPEAKABLE = new RegExp(['\\u00ad', '[\\u200b-\\u200c\\u200e\\u200f]', '\\u200d', '[\\u2028-\\u202e]', '[\\u2060-\\u206f]', '\\ufeff', '\\ufe0f'].join('|'), 'g')
const SYMBOLS = /[\p{So}\p{Cs}\p{Co}\p{Cn}\0]/gu
const ABBREVIATIONS: [RegExp, string][] = [
  [/\bpágs\./gi, 'páginas'],
  [/\bpág\./gi, 'página'],
  [/\bSra\./g, 'Señora'],
  [/\bSr\./g, 'Señor'],
  [/\bDra\./g, 'Doctora'],
  [/\bDr\./g, 'Doctor'],
]

export function stripForSpeech(text: string): string {
  let t = text.normalize('NFC').replace(UNSPEAKABLE, '').replace(SYMBOLS, '')
  t = t.replace(FENCE, ' ').replace(IMAGE, '$1').replace(LINK, '$1').replace(CITATION, '')
  t = t.replace(/https?:\/\/\S+/g, '')
  t = t.replace(TABLE_SEP, '').replace(RULE, '').replace(HEADING, '').replace(QUOTE, '').replace(LIST_MARK, '')
  for (let i = 0; i < 2; i++) t = t.replace(EMPHASIS, (_m, _a, b: string | undefined, _c, d: string | undefined) => b ?? d ?? '')
  t = t.replace(/[`*~#]/g, '').replace(/\|/g, ' ') // leftovers of emphasis split across sentences
  for (const [pattern, replacement] of ABBREVIATIONS) t = t.replace(pattern, replacement)
  return t.replace(/\s+([,.;:!?])/g, '$1').replace(/\s+/g, ' ').trim()
}

// --- Sentence splitting ------------------------------------------------------------------------

/** Words that end in "." without ending the sentence (lowercase, without the dot). */
/** Words that end in "." without ending the sentence (lowercase, without the dot). */
const ABBREVIATION_WORDS = new Set([
  'pág', 'págs', 'p', 'pp', 'sr', 'sra', 'srta', 'dr', 'dra', 'ud', 'uds', 'núm', 'num', 'art', 'arts',
  'cap', 'caps', 'fig', 'figs', 'vol', 'ej', 'aprox', 'cf', 'vs', 'lic', 'ing', 'prof', 'tel', 'av',
  'inc', 'ltda', 'cía', 'dpto', 'sig', 'sigs', 'párr', 'apdo',
])
const CLOSERS = /["'”’»)]/
const CITE_AT_START = /^\s?\[\s*\d+(?:\s*[,;\u2013-]\s*\d+)*\s*\]/
/** Sentences shorter than this are glued to the next one (a TTS call has ~1 s of fixed cost). */
const MIN_SENTENCE = 24
/** A run without a terminator longer than this is cut at a clause break so audio can start. */
const MAX_RUN = 190
const MIN_CLAUSE = 70

const startsSentence = (c: string) => /[\p{Lu}¿¡"“«(\d[#*_\-•]/u.test(c)

const NEED_MORE = 0
const NOT_A_BOUNDARY = -1

/** Index just after the sentence that ends at `s[i]` (one of `.?!…`), NOT_A_BOUNDARY, or NEED_MORE. */
function boundaryAfter(s: string, i: number, final: boolean): number {
  let j = i + 1
  while (j < s.length && /[.?!…]/.test(s[j]!)) j++ // "?!", "..."
  // Closing quotes/brackets and trailing citation markers belong to this sentence.
  for (;;) {
    if (j < s.length && CLOSERS.test(s[j]!)) { j++; continue }
    const cite = CITE_AT_START.exec(s.slice(j))
    if (cite) { j += cite[0].length; continue }
    break
  }
  if (j >= s.length) return final ? j : NEED_MORE
  if (!/\s/.test(s[j]!)) return NOT_A_BOUNDARY // "3.5", "e.g", "www.x.com"
  if (s[i] !== '.') return j
  const gap = /^[ \t]*/.exec(s.slice(j))![0].length
  const next = s[j + gap]
  if (next === undefined) return final ? j : NEED_MORE // cannot see what follows yet
  if (next === '\n' || s[j] === '\n') return j
  const before = s.slice(0, i)
  const word = /(\p{L}+)$/u.exec(before)?.[1] ?? ''
  if (/^\s*\d{1,3}$/.test(before)) return NOT_A_BOUNDARY // "1. " list marker at the start
  if (word.length === 1 && /\p{Lu}/u.test(word)) return NOT_A_BOUNDARY // initials "J. Pérez"
  if (ABBREVIATION_WORDS.has(word.toLowerCase())) return NOT_A_BOUNDARY
  return startsSentence(next) ? j : NOT_A_BOUNDARY // "etc. y luego" continues
}

/** Incremental splitter: feed streamed text, get complete sentences (raw markdown, not stripped). */
export class SentenceSplitter {
  private buf = ''
  private held = ''

  push(chunk: string): string[] {
    this.buf += chunk
    return this.drain(false)
  }

  /** The stream ended: whatever is left is the last sentence. */
  flush(): string[] {
    const out = this.drain(true)
    const rest = [this.held, this.buf].filter(Boolean).join(' ').trim()
    this.held = ''
    this.buf = ''
    if (rest) out.push(rest)
    return out
  }

  private emit(sentence: string, out: string[]) {
    const text = (this.held ? `${this.held} ${sentence.trim()}` : sentence).trim()
    if (!text) return
    if (stripForSpeech(text).length < MIN_SENTENCE) this.held = text
    else { this.held = ''; out.push(text) }
  }

  private drain(final: boolean): string[] {
    const out: string[] = []
    for (;;) {
      const s = this.buf
      const cut = this.nextCut(s, final)
      if (cut <= 0) break
      this.buf = s.slice(cut)
      this.emit(s.slice(0, cut), out)
    }
    return out
  }

  private nextCut(s: string, final: boolean): number {
    for (let i = 0; i < s.length; i++) {
      const c = s[i]!
      if (c === '\n') return i + 1 // a line break always ends the unit (list items, headings)
      if (c === '.' || c === '?' || c === '!' || c === '…') {
        const end = boundaryAfter(s, i, final)
        if (end === NEED_MORE) break // cannot decide yet; a very long run may still be cut below
        if (end > 0) return end
      }
    }
    return this.clauseCut(s)
  }

  private clauseCut(s: string): number {
    if (s.length <= MAX_RUN) return -1
    for (let i = Math.min(s.length - 2, MAX_RUN); i >= MIN_CLAUSE; i--) {
      if (/[,;:\u2014]/.test(s[i]!) && /\s/.test(s[i + 1]!)) return i + 1
    }
    return -1
  }
}

export function splitSentences(text: string): string[] {
  const splitter = new SentenceSplitter()
  return [...splitter.push(text), ...splitter.flush()]
}
