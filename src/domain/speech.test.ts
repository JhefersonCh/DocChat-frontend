import { describe, expect, it } from 'vitest'
import { SentenceSplitter, splitSentences, stripForSpeech } from './speech'

// Same vectors as backend/tests/test_voice.py (STRIP_CASES).
const STRIP_CASES: [string, string][] = [
  ['Plazo de **90 días** [1].', 'Plazo de 90 días.'],
  ['Ver [1, 2] y [3-4] también', 'Ver y también'],
  ['# Título\n\n- uno\n- dos\n1. tres', 'Título uno dos tres'],
  ['Mirá [la web](https://x.com/a) ahora', 'Mirá la web ahora'],
  ['Código `x = 1` y ```py\nprint(1)\n``` fin', 'Código x = 1 y fin'],
  ['Ver pág. 3 y págs. 4-5', 'Ver página 3 y páginas 4-5'],
  ['Monto: 44.000.000 pesos [2]', 'Monto: 44.000.000 pesos'],
  ['_cursiva_ y __negrita__', 'cursiva y negrita'],
  ['| a | b |\n|---|---|\n| 1 | 2 |', 'a b 1 2'],
  ['> cita textual', 'cita textual'],
  ['snake_case_word se mantiene', 'snake_case_word se mantiene'],
  ['ex\u00adtra\u200b ordi\u00adnario \u{1F600} fin', 'extra ordinario fin'],
]

describe('stripForSpeech', () => {
  it.each(STRIP_CASES)('%j -> %j', (raw, expected) => {
    expect(stripForSpeech(raw)).toBe(expected)
  })
})

describe('splitSentences', () => {
  it('splits plain sentences and keeps terminators', () => {
    expect(splitSentences('El plazo es de noventa días. La penalidad es del dos por ciento.')).toEqual([
      'El plazo es de noventa días.',
      'La penalidad es del dos por ciento.',
    ])
  })

  it('does not split decimals or thousands separators', () => {
    expect(splitSentences('El monto total asciende a 44.000.000 de pesos colombianos y el IVA es 19.5 por ciento.')).toEqual([
      'El monto total asciende a 44.000.000 de pesos colombianos y el IVA es 19.5 por ciento.',
    ])
  })

  it('does not split on abbreviations like pág. or Dr.', () => {
    expect(splitSentences('Según el Dr. Pérez, el resultado figura en la pág. 3 del documento original.')).toEqual([
      'Según el Dr. Pérez, el resultado figura en la pág. 3 del documento original.',
    ])
  })

  it('does not split on initials', () => {
    expect(splitSentences('El contrato lo firmó J. Pérez en representación de la empresa constructora.')).toHaveLength(1)
  })

  it('keeps citation markers and closing quotes with their sentence', () => {
    expect(splitSentences('El plazo es de noventa días corridos [1]. Luego se renueva por un año adicional [2].')).toEqual([
      'El plazo es de noventa días corridos [1].',
      'Luego se renueva por un año adicional [2].',
    ])
    expect(splitSentences('Dijo "no habrá prórroga alguna." Después se retiró de la reunión sin más comentarios.')).toHaveLength(2)
  })

  it('handles Spanish question and exclamation marks', () => {
    expect(splitSentences('¿Cuál es el plazo de entrega pactado en el contrato? Son noventa días corridos desde la firma.')).toEqual([
      '¿Cuál es el plazo de entrega pactado en el contrato?',
      'Son noventa días corridos desde la firma.',
    ])
  })

  it('treats a lowercase continuation after etc. as the same sentence', () => {
    expect(splitSentences('Incluye mesas, sillas, etc. y además los equipos de oficina mencionados arriba.')).toHaveLength(1)
  })

  it('breaks on line breaks (list items, headings) and merges tiny ones into the next', () => {
    expect(splitSentences('## Resumen\n- Plazo de entrega de noventa días corridos\n- Penalidad del dos por ciento semanal')).toEqual([
      '## Resumen - Plazo de entrega de noventa días corridos',
      '- Penalidad del dos por ciento semanal',
    ])
  })

  it('glues very short sentences to the next one', () => {
    expect(splitSentences('Sí. El plazo de entrega es de noventa días corridos desde la firma.')).toEqual([
      'Sí. El plazo de entrega es de noventa días corridos desde la firma.',
    ])
  })

  it('cuts a very long run at a clause break so audio can start', () => {
    const long = `${'palabra '.repeat(14)}uno, ${'otra '.repeat(30)}fin.`
    const parts = splitSentences(long)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts[0]!.endsWith(',')).toBe(true)
  })
})

describe('SentenceSplitter (streaming)', () => {
  it('emits a sentence only once the next one starts (a "." at the end is not yet a boundary)', () => {
    const s = new SentenceSplitter()
    expect(s.push('El plazo de entrega es de noventa días corridos.')).toEqual([])
    expect(s.push(' La')).toEqual(['El plazo de entrega es de noventa días corridos.'])
    expect(s.flush()).toEqual(['La'])
  })

  it('gives the same result whatever the token boundaries', () => {
    const text = 'Según la pág. 3, el monto es 44.000.000 de pesos [1]. ¿Algo más para revisar hoy? Sí, el anexo técnico completo.'
    const whole = splitSentences(text)
    const tokens = new SentenceSplitter()
    const out: string[] = []
    for (const ch of text) out.push(...tokens.push(ch))
    out.push(...tokens.flush())
    expect(out).toEqual(whole)
    expect(whole.length).toBe(3)
  })

  it('flush emits the unterminated tail', () => {
    const s = new SentenceSplitter()
    s.push('Respuesta sin punto final pero lo bastante larga')
    expect(s.flush()).toEqual(['Respuesta sin punto final pero lo bastante larga'])
  })
})
