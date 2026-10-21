import { describe, expect, it } from 'vitest'
import { doc, msg } from '@/test/fixtures'
import type { Citation, Note } from './types'
import { chatToMarkdown, exportFilename, noteLabel, notesToMarkdown } from './exportMd'

const cite = (over: Partial<Citation> = {}): Citation => ({
  n: 1, document_id: 'd1', filename: 'a.pdf', page: 3, snippet: 'El plazo es de 30 días', chunk_id: 'c1', page_end: null, content: 'x', section: 'Entrega', ...over,
})
const DATE = new Date('2026-10-14T12:00:00Z')

describe('chatToMarkdown', () => {
  const messages = [
    msg({ id: 'u', role: 'user', content: '¿Plazo?' }),
    msg({ id: 'a', content: 'Son 30 días [1].', citations: [cite(), cite({ n: 2, page: 5, page_end: 6, section: null, snippet: 'otro' })] }),
  ]

  it('has a reference block, Q/A and footnotes only for cited sources', () => {
    const md = chatToMarkdown({ title: 'Contrato', doc: doc(), messages, date: DATE })
    expect(md).toContain('# Contrato')
    expect(md).toContain('a.pdf')
    expect(md).toContain('3 págs.')
    expect(md).toContain('2026-10-14')
    expect(md).toContain('**Pregunta**')
    expect(md).toContain('¿Plazo?')
    expect(md).toContain('Son 30 días [1].')
    expect(md).toContain('[1] pág. 3 — Entrega — El plazo es de 30 días')
    expect(md).not.toContain('[2] pág.')
  })

  it('formats page ranges, omits missing parts, and works without a document', () => {
    const all = [msg({ content: 'a [2]', citations: [cite({ n: 2, page: 5, page_end: 6, section: null, snippet: 'otro' })] })]
    const md = chatToMarkdown({ title: '', doc: null, messages: all, date: DATE })
    expect(md).toContain('[2] pág. 5–6 — otro')
    expect(md).toContain('# Conversación')
  })
})

describe('notesToMarkdown', () => {
  const note: Note = { id: 'n1', message_id: 'a', title: 'Plazo', content: 'Son 30 días [1].', citations: [cite()], created_at: '2026-10-14T00:00:00Z' }

  it('lists notes with title, content and footnotes', () => {
    const md = notesToMarkdown({ title: 'Contrato', doc: doc(), notes: [note, { ...note, id: 'n2', title: '' }], date: DATE })
    expect(md).toContain('# Notas — Contrato')
    expect(md).toContain('## Plazo')
    expect(md).toContain('[1] pág. 3 — Entrega — El plazo es de 30 días')
    expect(md).toContain('## Son 30 días [1].') // untitled note falls back to its first line
  })
})

describe('noteLabel / exportFilename', () => {
  it('prefers the title, else the first line stripped of markdown, clipped', () => {
    expect(noteLabel({ title: ' X ', content: 'y' })).toBe('X')
    expect(noteLabel({ title: '', content: '## **Hola** mundo\nmás' })).toBe('Hola mundo')
    expect(noteLabel({ title: '', content: 'a'.repeat(100) }).length).toBeLessThanOrEqual(61)
  })

  it('slugifies', () => {
    expect(exportFilename('Mi Contrato (v2).pdf', 'md')).toBe('mi-contrato-v2.md')
    expect(exportFilename('', 'md')).toBe('chat.md')
  })
})
