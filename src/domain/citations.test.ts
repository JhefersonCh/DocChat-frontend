import { describe, expect, it } from 'vitest'
import { displaySnippet, parseCitedRefs, relevanceLabel, resolveRefs, shortSection } from './citations'

describe('parseCitedRefs', () => {
  it('collects [n] and [n, m] refs as sorted unique numbers', () => {
    expect(parseCitedRefs('A [3]. B [1, 2] y de nuevo [3 ,1].', 5)).toEqual([1, 2, 3])
  })

  it('drops numbers outside 1..citationCount', () => {
    expect(parseCitedRefs('X [0] [2] [9, 1]', 3)).toEqual([1, 2])
  })
})

describe('resolveRefs', () => {
  it('flags refs without a citation behind them, keeping order', () => {
    expect(resolveRefs('1,5', [1, 2])).toEqual([{ n: 1, known: true }, { n: 5, known: false }])
  })
})

describe('shortSection', () => {
  it('collapses whitespace and returns null for empty/absent sections', () => {
    expect(shortSection('9.  ÁREA\nGEOGRÁFICA', 60)).toBe('9. ÁREA GEOGRÁFICA')
    expect(shortSection('   ', 60)).toBeNull()
    expect(shortSection(null, 60)).toBeNull()
    expect(shortSection(undefined, 60)).toBeNull()
  })
  it('cuts at a word boundary with an ellipsis, never exceeding max', () => {
    const out = shortSection('9. ÁREA GEOGRÁFICA DE MERCADO Y COMPETENCIA', 28)!
    expect(out).toBe('9. ÁREA GEOGRÁFICA DE…')
    expect(out.length).toBeLessThanOrEqual(28)
  })
  it('hard-cuts a single long word', () => {
    expect(shortSection('X'.repeat(50), 10)).toBe('XXXXXXXXX…')
  })
})

describe('displaySnippet', () => {
  it('collapses letter-spaced capitals/digits, mirroring the backend', () => {
    expect(displaySnippet('S E C C I Ó N 0 1 Mercado')).toBe('SECCIÓN 01 Mercado')
    expect(displaySnippet('E S T R A T E G I A Entorno competitivo')).toBe('ESTRATEGIA Entorno competitivo')
  })
  it('leaves normal text alone, single-letter words and short runs included', () => {
    for (const s of ['Ventas y a o u en Mocoa', 'plan A B en Mocoa', 'Café, té y 2 de 3']) expect(displaySnippet(s)).toBe(s)
  })
})

describe('relevanceLabel', () => {
  it('shows a rounded percentage, or nothing without a score', () => {
    expect(relevanceLabel(0.874)).toBe('87%')
    expect(relevanceLabel(1)).toBe('100%')
    expect(relevanceLabel(null)).toBeNull()
    expect(relevanceLabel(undefined)).toBeNull()
  })
})
