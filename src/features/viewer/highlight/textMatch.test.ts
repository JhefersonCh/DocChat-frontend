import { describe, expect, it } from 'vitest'
import { matchText, type PageText } from './textMatch'

const one = (text: string): PageText[] => [{ page: 1, text }]
const slice = (text: string, m: ReturnType<typeof matchText>) => m!.spans.map((s) => text.slice(s.start, s.end))

describe('matchText', () => {
  it('exact match ignoring whitespace, line breaks and case', () => {
    const text = 'Intro.\nEl gato   come\npescado fresco\ntodos los días. Fin.'
    const m = matchText(one(text), 'el gato come pescado fresco todos los días.', '')
    expect(m?.quality).toBe('exact')
    expect(slice(text, m)).toEqual(['El gato   come\npescado fresco\ntodos los días.'])
  })

  it('folds ligatures and soft hyphens coming from the text layer', () => {
    const text = 'Un proceso e­fi­ciente.\nﬁnalmente el ﬂujo.'
    const m = matchText(one(text), 'proceso eficiente. finalmente el flujo.', '')
    expect(m?.quality).toBe('exact')
    expect(slice(text, m)[0]).toBe('proceso e­fi­ciente.\nﬁnalmente el ﬂujo.')
  })

  it('joins words hyphenated at end of line, whichever side kept the hyphen', () => {
    const layer = 'la estrategia es muy eficien-\nte para todos'
    expect(matchText(one(layer), 'la estrategia es muy eficiente para todos', '')?.quality).toBe('exact')
    const chunk = 'la estrategia es muy eficien-\nte para todos'
    expect(matchText(one('la estrategia es muy eficiente para todos'), chunk, '')?.quality).toBe('exact')
  })

  it('keeps a real hyphen inside a line', () => {
    const text = 'un plan costo-efectivo y simple'
    expect(matchText(one(text), 'costo efectivo', '')).toBeNull()
    expect(slice(text, matchText(one(text), 'costo-efectivo', ''))).toEqual(['costo-efectivo'])
  })

  it('normalizes curly quotes and dashes', () => {
    const text = 'Dijo “hola” — y se fue.'
    expect(matchText(one(text), 'Dijo "hola" - y se fue.', '')?.quality).toBe('exact')
  })

  it('matches a chunk that starts and ends mid-sentence', () => {
    const text = 'Primera oración completa. segunda parte del texto que sigue hasta la mitad de una ora'
    const m = matchText(one(text), 'parte del texto que sigue hasta la mitad', '')
    expect(slice(text, m)).toEqual(['parte del texto que sigue hasta la mitad'])
  })

  it('spans two pages when the chunk crosses the boundary', () => {
    const pages: PageText[] = [
      { page: 2, text: 'Fin de la página dos: el sistema procesa los datos' },
      { page: 3, text: 'y luego los publica.\nOtra cosa.' },
    ]
    const m = matchText(pages, 'el sistema procesa los datos y luego los publica.', '')
    expect(m?.quality).toBe('exact')
    expect(m!.spans).toEqual([
      { page: 2, start: 'Fin de la página dos: '.length, end: pages[0].text.length },
      { page: 3, start: 0, end: 'y luego los publica.'.length },
    ])
  })

  it('anchors by both ends when the middle differs', () => {
    const head = 'El comienzo del fragmento es bastante particular y único en esta página.'
    const tail = 'Y el final del fragmento también es bastante particular y claramente distinto del resto.'
    const text = `Antes. ${head} Algo que el extractor leyó en otro orden. ${tail} Después.`
    const m = matchText(one(text), `${head} Texto distinto en el medio. ${tail}`, '')
    expect(m?.quality).toBe('anchored')
    const [hit] = slice(text, m)
    expect(hit.startsWith('El comienzo')).toBe(true)
    expect(hit.endsWith('del resto.')).toBe(true)
  })

  it('falls back to the snippet when the content does not match', () => {
    const text = 'Aquí está el texto original que dice cosas.'
    const m = matchText(one(text), 'un contenido que el visor no tiene para nada, de ninguna manera', 'texto original que dice…')
    expect(m?.quality).toBe('snippet')
    expect(slice(text, m)).toEqual(['texto original que dice'])
  })

  it('returns null without a reliable match or without content (old messages)', () => {
    expect(matchText(one('nada que ver con esto'), 'otra cosa totalmente distinta y larga', 'zzz')).toBeNull()
    expect(matchText(one('el gato come pescado'), null, 'el gato come pescado')).toBeNull()
  })

  describe('chunk crossing pages whose running header/footer was removed from `content`', () => {
    const footer = 'Plan de Negocios Raíces del Putumayo — Documento confidencial — Agricapital S.A.S. — Página 7'
    const header = 'RAÍCES DEL PUTUMAYO · Plan de Negocios · Capítulo de análisis de mercado y operación · v3'
    const first = 'El mercado objetivo se concentra en Mocoa y Villagarzón, donde la demanda de cacao fino es estable'
    const second = 'y los precios pactados con las cooperativas se revisan cada semestre según el índice nacional.'
    const pages: PageText[] = [
      { page: 7, text: `Antes del fragmento.\n${first}\n${footer}` },
      { page: 8, text: `${header}\n${second}\nDespués del fragmento.` },
    ]
    const content = `${first}\n${second}`

    it('locates each part on its own page and skips the header/footer', () => {
      const m = matchText(pages, content, '')
      expect(m?.quality).toBe('exact')
      expect(m!.spans.map((s, k) => pages[k].text.slice(s.start, s.end))).toEqual([first, second])
      expect(m!.spans.map((s) => s.page)).toEqual([7, 8])
    })

    it('reports anchored and still paints the located parts when a segment is not in the layer', () => {
      const garbled = `${first}\nun párrafo que el visor leyó distinto y no coincide con nada\n${second}`
      const m = matchText(pages, garbled, '')
      expect(m?.quality).toBe('anchored')
      expect(m!.spans.map((s) => s.page)).toEqual([7, 8])
    })

    it('does not paint when too little of the content is found', () => {
      const m = matchText(pages, `${first}\n${'texto que no existe en el documento '.repeat(6)}`, '')
      expect(m?.quality).not.toBe('exact')
    })
  })
})
