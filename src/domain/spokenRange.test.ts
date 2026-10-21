import { describe, expect, it } from 'vitest'
import { findSpoken } from './spokenRange'

describe('findSpoken', () => {
  const dom = 'Resumen El plazo de entrega es de noventa días 1 corridos. Luego se renueva por un año 2 adicional. Fin.'

  it('finds a sentence even with citation chips in the middle of the DOM text', () => {
    const range = findSpoken(dom, 'El plazo de entrega es de noventa días corridos.')!
    expect(dom.slice(...range)).toBe('El plazo de entrega es de noventa días 1 corridos')
  })

  it('searches forward from a cursor so repeated sentences map in order', () => {
    const text = 'Sí claro que sí. Sí claro que sí.'
    const first = findSpoken(text, 'Sí claro que sí.')!
    const second = findSpoken(text, 'Sí claro que sí.', first[1])!
    expect(second[0]).toBeGreaterThan(first[1] - 1)
  })

  it('ignores accents and case', () => {
    const range = findSpoken('LUEGO SE RENUEVA POR UN AÑO', 'Luego se renueva por un ano')
    expect(range).not.toBeNull()
  })

  it('returns null when the sentence is not rendered', () => {
    expect(findSpoken(dom, 'Esto no aparece en ningún lado del texto.')).toBeNull()
  })
})
