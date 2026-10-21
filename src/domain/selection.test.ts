import { describe, expect, it } from 'vitest'
import { buildSelectionQuestion, EXPLAIN_LEVELS, isExplainQuestion, SELECTION_ACTIONS } from './selection'

describe('buildSelectionQuestion', () => {
  it('quotes the passage and names the page', () => {
    const q = buildSelectionQuestion('explain', 'El plazo es de 30 días', 4)
    expect(q).toContain('"El plazo es de 30 días"')
    expect(q).toContain('página 4')
    expect(q.toLowerCase()).toContain('explic')
  })

  it('has one template per action, each with the passage', () => {
    for (const { id } of SELECTION_ACTIONS) expect(buildSelectionQuestion(id, 'x y', null)).toContain('"x y"')
    expect(buildSelectionQuestion('translate', 'hola', null).toLowerCase()).toContain('inglés')
  })

  it('collapses whitespace, cuts long passages and omits the page when unknown', () => {
    const q = buildSelectionQuestion('define', `a\n\n  b ${'palabra '.repeat(200)}`, null)
    expect(q).not.toContain('\n')
    expect(q).toContain('"a b ')
    expect(q).toContain('…"')
    expect(q).not.toContain('página')
    expect(q.length).toBeLessThan(800)
  })
})

describe('explain level', () => {
  it('has four steps and shapes the Explicar question by audience (clamped)', () => {
    expect(EXPLAIN_LEVELS.map((l) => l.label)).toEqual(['Niño de 10 años', 'Secundaria', 'Universitario', 'Experto'])
    expect(buildSelectionQuestion('explain', 'x', 2, 0)).toContain('«Niño de 10 años»')
    expect(buildSelectionQuestion('explain', 'x', 2, 3)).toContain('«Experto»')
    expect(buildSelectionQuestion('explain', 'x', 2, 99)).toContain('«Experto»')
  })

  it('recognizes the questions whose answers should show readability', () => {
    expect(isExplainQuestion(buildSelectionQuestion('explain', 'x', null, 1))).toBe(true)
    expect(isExplainQuestion(buildSelectionQuestion('simplify', 'x', null))).toBe(true)
    expect(isExplainQuestion(buildSelectionQuestion('define', 'x', null))).toBe(false)
    expect(isExplainQuestion('¿Qué dice el contrato?')).toBe(false)
  })
})
