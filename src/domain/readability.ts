/** Spanish readability: Szigriszt-Pazos (the INFLESZ scale), pure and offline. */

const STRONG = /[aeoáéóíú]/ // an accented i/u is a strong vowel: it breaks the diphthong (rí-o)
const VOWEL = /[aeiouáéíóúü]/

/** Syllables of one Spanish word: vowel nuclei, where only two strong vowels in a row (hiatus) split. */
export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/([qg])u([eiéí])/g, '$1$2').replace(/y$/, 'i')
  let count = 0
  let prev = ''
  for (const ch of w) {
    if (!VOWEL.test(ch)) { prev = ''; continue }
    if (!prev || (STRONG.test(prev) && STRONG.test(ch))) count++
    prev = ch
  }
  return Math.max(count, 1)
}

export interface Readability {
  /** 0-100, higher = easier. */
  score: number
  label: 'muy difícil' | 'algo difícil' | 'normal' | 'bastante fácil' | 'muy fácil'
}

const SCALE: [number, Readability['label']][] = [[40, 'muy difícil'], [55, 'algo difícil'], [65, 'normal'], [80, 'bastante fácil']]

/** INFLESZ labels over the Szigriszt-Pazos score: 206.835 − 62.3·(syllables/words) − words/sentences. Null without words. */
export function readability(text: string): Readability | null {
  const plain = text.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, ' ')
  const words = plain.match(/\p{L}+/gu) ?? []
  if (words.length === 0) return null
  const sentences = Math.max(plain.split(/[.!?…]+(?:\s|$)|\n+/u).filter((s) => /\p{L}/u.test(s)).length, 1)
  const syl = words.reduce((n, w) => n + syllables(w), 0)
  const raw = 206.835 - 62.3 * (syl / words.length) - words.length / sentences
  const score = Math.round(Math.min(100, Math.max(0, raw)))
  return { score, label: SCALE.find(([max]) => score <= max)?.[1] ?? 'muy fácil' }
}

/** "Legibilidad 78 · bastante fácil" */
export const readabilityLabel = (r: Readability) => `Legibilidad ${r.score} · ${r.label}`
