export type SelectionAction = 'explain' | 'simplify' | 'define' | 'translate'

export const SELECTION_ACTIONS: { id: SelectionAction; label: string }[] = [
  { id: 'explain', label: 'Explicar' },
  { id: 'simplify', label: 'Simplificar' },
  { id: 'define', label: 'Definir' },
  { id: 'translate', label: 'Traducir' },
]

/** How deep the "Explicar" answer goes: the slider of the selection menu. */
export const EXPLAIN_LEVELS = [
  { label: 'Niño de 10 años', audience: 'un niño de 10 años: frases cortas, palabras cotidianas y un ejemplo simple' },
  { label: 'Secundaria', audience: 'un estudiante de secundaria: lenguaje claro y los términos técnicos explicados' },
  { label: 'Universitario', audience: 'un estudiante universitario: con precisión conceptual y terminología propia del tema' },
  { label: 'Experto', audience: 'un experto en la materia: técnico, denso y sin explicar lo básico' },
] as const
export const DEFAULT_LEVEL = 1

const INSTRUCTION: Record<SelectionAction, string> = {
  explain: 'Explicá este pasaje del documento',
  simplify: 'Explicá con palabras simples, como a un principiante, este pasaje del documento',
  define: 'Definí los términos clave de este pasaje del documento',
  translate: 'Traducí al inglés este pasaje del documento',
}

const MAX_PASSAGE = 600

/**
 * The chat question for a selection: a normal question (so retrieval and citations work as usual)
 * with the passage quoted and its page, when known.
 */
export function buildSelectionQuestion(action: SelectionAction, passage: string, page: number | null, level = DEFAULT_LEVEL): string {
  const flat = passage.replace(/\s+/g, ' ').trim().replaceAll('"', "'")
  const text = flat.length > MAX_PASSAGE ? `${flat.slice(0, MAX_PASSAGE).trimEnd()}…` : flat
  const where = page == null ? '' : ` (página ${page})`
  const lead = action === 'explain' ? explainInstruction(level) : INSTRUCTION[action]
  return `${lead}${where}: "${text}"`
}

function explainInstruction(level: number): string {
  const { label, audience } = EXPLAIN_LEVELS[Math.min(Math.max(level, 0), EXPLAIN_LEVELS.length - 1)]!
  return `Explicá a nivel «${label}», para ${audience}, este pasaje del documento`
}

/** Questions that ask for a simplification (Explicar at any level, Simplificar): their answers show readability. */
export const isExplainQuestion = (question: string) => /^Explicá (?:a nivel «|con palabras simples)/.test(question)
