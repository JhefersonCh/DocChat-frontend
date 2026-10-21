import { describe, expect, it } from 'vitest'
import type { Cell, QuizQuestion } from './artifacts'
import { niceMax, parseColumns, pieAngles, scoreQuiz, toCsv } from './studio'

const cell = (value: string | null): Cell => ({ value, quote: null, page: null, chunk_id: null })
const q = (answer_index: number): QuizQuestion => ({ question: '?', options: ['a', 'b', 'c', 'd'], answer_index, explanation: '', page: null, chunk_id: null })

describe('studio helpers', () => {
  it('parseColumns trims, dedupes and caps', () => {
    expect(parseColumns(' Nombre , Fecha;\nNombre,, Total ')).toEqual(['Nombre', 'Fecha', 'Total'])
    expect(parseColumns(Array.from({ length: 20 }, (_, i) => `c${i}`).join(','))).toHaveLength(12)
  })

  it('scoreQuiz counts correct answers among the answered', () => {
    expect(scoreQuiz([q(0), q(1), q(2)], { 0: 0, 1: 3 })).toEqual({ correct: 1, total: 3, answered: 2 })
  })

  it('toCsv quotes, escapes and neutralizes formulas', () => {
    const csv = toCsv(['A', 'B,C'], [{ A: cell('di "hola"'), 'B,C': cell('=SUM(1)') }, { A: cell('x\ny'), 'B,C': cell(null) }, { A: cell('-5'), 'B,C': cell('-ab') }])
    expect(csv).toBe('﻿A,"B,C"\r\n"di ""hola""",\'=SUM(1)\r\n"x\ny",\r\n-5,\'-ab')
  })

  it('niceMax and pieAngles', () => {
    expect([niceMax(0), niceMax(7), niceMax(120), niceMax(0.3)]).toEqual([1, 10, 200, 0.5])
    const a = pieAngles([1, 1, 2])
    expect(a[2].end).toBeCloseTo(Math.PI * 2)
    expect(a[0].end - a[0].start).toBeCloseTo(Math.PI / 2)
  })
})
