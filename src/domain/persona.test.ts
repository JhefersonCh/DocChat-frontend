import { describe, expect, it } from 'vitest'
import { personaSuggestions } from './persona'

describe('personaSuggestions', () => {
  it('offers the author and the proper names of the overview, not sentence starters', () => {
    const summary = 'Una novela sobre la familia Buendía en Macondo. Allí Úrsula Iguarán sostiene la casa y el coronel Aureliano la defiende.'
    expect(personaSuggestions(summary)).toEqual(['el autor', 'Buendía', 'Macondo', 'Úrsula Iguarán', 'Aureliano'])
  })

  it('still offers the author without an overview', () => {
    expect(personaSuggestions(null)).toEqual(['el autor'])
  })
})
