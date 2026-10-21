import { describe, expect, it } from 'vitest'
import { readability, readabilityLabel, syllables } from './readability'

describe('syllables', () => {
  it.each([['gato', 2], ['pescado', 3], ['juega', 2], ['río', 2], ['país', 2], ['queso', 2], ['muy', 1], ['y', 1], ['institucionales', 6]])(
    '%s has %i', (word, n) => expect(syllables(word)).toBe(n),
  )
})

describe('readability (Szigriszt-Pazos)', () => {
  const simple = 'El gato come pescado. La niña juega en el patio.'
  const hard = 'La implementación de mecanismos institucionales descentralizados presupone consideraciones epistemológicas multidimensionales.'

  it('scores plain text high and dense text low', () => {
    const easy = readability(simple)!
    const dense = readability(hard)!
    expect(easy.score).toBeGreaterThan(85)
    expect(easy.label).toBe('muy fácil')
    expect(dense.score).toBeLessThan(25)
    expect(dense.label).toBe('muy difícil')
  })

  it('ignores [n] citation markers, stays within 0-100 and is null without words', () => {
    expect(readability('El gato come [1][2]. La niña juega.')).toEqual(readability('El gato come. La niña juega.'))
    expect(readability('12 [1] ...')).toBeNull()
    expect(readabilityLabel({ score: 78, label: 'bastante fácil' })).toBe('Legibilidad 78 · bastante fácil')
  })
})
