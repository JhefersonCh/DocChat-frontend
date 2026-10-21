const REF = /\[(\d+(?:\s*,\s*\d+)*)\]/g

/** Numbers of the `[n]` / `[n, m]` refs in `content` that exist (1..citationCount), sorted, unique. */
export function parseCitedRefs(content: string, citationCount: number): number[] {
  const found = new Set<number>()
  for (const match of content.matchAll(REF)) {
    for (const part of match[1]!.split(',')) {
      const n = Number(part)
      if (n >= 1 && n <= citationCount) found.add(n)
    }
  }
  return [...found].sort((a, b) => a - b)
}

export interface ResolvedRef { n: number; known: boolean }

/**
 * Splits the payload of one ref (`"2,5"`) into numbers and flags the ones with no citation behind them
 * (the model can write `[7]` with only 2 citations). Same rule as `parseCitedRefs`: unknown = not cited,
 * so the UI renders them as dimmed, non-interactive refs.
 */
export function resolveRefs(refs: string, available: readonly number[]): ResolvedRef[] {
  return refs.split(',').map((p) => Number(p)).map((n) => ({ n, known: available.includes(n) }))
}

/** Section title for a one-line meta readout: whitespace collapsed, cut at a word boundary to `max` chars. */
export function shortSection(section: string | null | undefined, max: number): string | null {
  const text = section?.replace(/\s+/g, ' ').trim()
  if (!text) return null
  if (text.length <= max) return text
  const room = text.slice(0, max - 1)
  const cut = room.lastIndexOf(' ')
  return `${(cut > 0 ? room.slice(0, cut) : room).trimEnd()}…`
}

// Mirror of backend `collapse_letter_spacing`: 3+ spaced capitals/digits ("S E C C I Ó N 0 1"); lowercase is
// excluded so words like "y", "a", "o" survive. Display only: highlighting keeps matching the verbatim `content`.
const LETTER_SPACED = /(?<!\S)[A-ZÀ-ÖØ-Þ0-9](?: [A-ZÀ-ÖØ-Þ0-9]){2,}(?!\S)/g
const LETTER_DIGIT = /(?<=\p{L})(?=\d)|(?<=\d)(?=\p{L})/gu

/** Snippet text for display: letter-spaced headings joined ("S E C C I Ó N 0 1" -> "SECCIÓN 01"). */
export function displaySnippet(text: string): string {
  return text.replace(LETTER_SPACED, (run) => run.replaceAll(' ', '').replace(LETTER_DIGIT, ' '))
}

/** Relevance score (0..1, query similarity) as "87%"; null when the citation has none (old messages). */
export function relevanceLabel(score: number | null | undefined): string | null {
  return score == null ? null : `${Math.round(score * 100)}%`
}
