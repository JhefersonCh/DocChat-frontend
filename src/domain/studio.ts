import type { Cell, QuizQuestion } from './artifacts'

export const MAX_COLUMNS = 12

/** "Nombre, Fecha\nTotal" -> ['Nombre','Fecha','Total'] (trimmed, distinct, capped). */
export function parseColumns(text: string): string[] {
  const parts = text.split(/[,\n;]/).map((c) => c.trim().replace(/\s+/g, ' ')).filter(Boolean)
  return [...new Set(parts)].slice(0, MAX_COLUMNS)
}

export function scoreQuiz(questions: QuizQuestion[], answers: Record<number, number>) {
  const correct = questions.filter((q, i) => answers[i] === q.answer_index).length
  return { correct, total: questions.length, answered: Object.keys(answers).length }
}

/** Spreadsheet-safe CSV (UTF-8 BOM so Excel reads accents; formula-looking cells are neutralized). */
export function toCsv(columns: string[], rows: Record<string, Cell>[]): string {
  const esc = (v: string | null) => {
    let s = v ?? ''
    if (/^[=+@]|^-\D/.test(s)) s = `'${s}`
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [columns.map(esc).join(','), ...rows.map((r) => columns.map((c) => esc(r[c]?.value ?? null)).join(','))]
  return '﻿' + lines.join('\r\n')
}

/** Upper bound of a value axis: 1, 2, 2.5, 5 or 10 times a power of ten. */
export function niceMax(max: number): number {
  if (!(max > 0)) return 1
  const pow = 10 ** Math.floor(Math.log10(max))
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= max) ?? 10
  return step * pow
}

/** Pie angles in radians from 12 o'clock; negative values count as 0. */
export function pieAngles(values: number[]): { start: number; end: number }[] {
  const clean = values.map((v) => Math.max(v, 0))
  const total = clean.reduce((a, b) => a + b, 0) || 1
  let at = 0
  return clean.map((v) => {
    const start = at
    at += (v / total) * Math.PI * 2
    return { start, end: at }
  })
}

export const formatNumber = (n: number) => new Intl.NumberFormat('es', { maximumFractionDigits: 2 }).format(n)
