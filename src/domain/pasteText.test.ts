import { describe, expect, it } from 'vitest'
import { buildPastedFile, looksLikeMarkdown, resolveTitle, slugify } from './pasteText'

const NOW = new Date(2026, 9, 21, 9, 5)

describe('pasteText', () => {
  it('detects markdown', () => {
    expect(looksLikeMarkdown('# Hola\ntexto')).toBe(true)
    expect(looksLikeMarkdown('a | b\n--- | ---\n1 | 2')).toBe(true)
    expect(looksLikeMarkdown('- uno\n- dos')).toBe(true)
    expect(looksLikeMarkdown('Solo un párrafo normal.')).toBe(false)
  })
  it('resolves title: given, first line (60 chars) or timestamp', () => {
    expect(resolveTitle('x', '  Mi nota ', NOW)).toBe('Mi nota')
    expect(resolveTitle('\n\n## Primera línea\nresto', '', NOW)).toBe('Primera línea')
    expect(resolveTitle('a'.repeat(100), '', NOW)).toHaveLength(61)
    expect(resolveTitle('  \n ', '', NOW)).toBe('Texto pegado 21-10 09:05')
  })
  it('slugifies accents and symbols', () => {
    expect(slugify('¡Canción: ñandú & más!')).toBe('cancion-nandu-mas')
    expect(slugify('???')).toBe('texto-pegado')
  })
  it('builds .txt / .md files and rejects empty text', async () => {
    const txt = buildPastedFile('hola mundo', 'Nota rápida', NOW)
    expect(txt.ok && txt.file.name).toBe('nota-rapida.txt')
    const md = buildPastedFile('# Título\n- a', '', NOW)
    expect(md.ok && md.file.name).toBe('titulo.md')
    expect(md.ok && (await md.file.text())).toBe('# Título\n- a')
    expect(buildPastedFile('   \n', '', NOW)).toEqual({ ok: false, code: 'empty_text' })
  })
})
