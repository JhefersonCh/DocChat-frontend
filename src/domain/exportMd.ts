import { parseCitedRefs, displaySnippet } from './citations'
import { citationAlias, withAlias } from './sources'
import type { Citation, Document, Message, Note, Source } from './types'

const pages = (n: number | null) => (n == null ? null : `${n} ${n === 1 ? 'pág.' : 'págs.'}`)

const where = (c: Citation) =>
  c.page == null ? null : c.page_end != null && c.page_end !== c.page ? `pág. ${c.page}–${c.page_end}` : `pág. ${c.page}`

/** `[n] pág. X — sección — snippet`; parts that are missing are left out. */
export function footnote(c: Citation, alias: string | null = null): string {
  const section = c.section?.replace(/\s+/g, ' ').trim()
  const snippet = displaySnippet(c.snippet).replace(/\s+/g, ' ').trim()
  return [`[${c.n}]`, [withAlias(alias, where(c)), section, snippet].filter(Boolean).join(' — ')].filter(Boolean).join(' ')
}

/** Sources the text actually cites, as a bullet list ("" when none). */
function sources(content: string, citations: Citation[], all: readonly Source[] = []): string {
  const cited = parseCitedRefs(content, Math.max(0, ...citations.map((c) => c.n)))
  const used = citations.filter((c) => cited.includes(c.n))
  return used.length ? `\n\n**Fuentes**\n\n${used.map((c) => `- ${footnote(c, citationAlias(all, c))}`).join('\n')}` : ''
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

/** Blockquote with the document the export refers to. */
function reference(doc: Document | null, date: Date, all: readonly Source[] = []): string {
  if (all.length > 1) { // several sources: one line each, with the alias the citations use
    const list = all.map((s) => `${s.alias} · ${s.filename}${s.page_count != null ? ` · ${pages(s.page_count)}` : ''}`).join('; ')
    return `> **Fuentes:** ${list} · **Exportado:** ${isoDay(date)}`
  }
  const parts = [doc && `**Documento:** ${doc.filename}`, doc && pages(doc.page_count), `**Exportado:** ${isoDay(date)}`]
  return `> ${parts.filter(Boolean).join(' · ')}`
}

interface ChatExport { title: string; doc: Document | null; messages: Message[]; date: Date; sources?: readonly Source[] }

export function chatToMarkdown({ title, doc, messages, date, sources: all = [] }: ChatExport): string {
  const body = messages.map((m) => m.role === 'user'
    ? `**Pregunta**\n\n${m.content}`
    : `**Respuesta**\n\n${m.content}${sources(m.content, m.citations ?? [], all)}`)
  return [`# ${title.trim() || 'Conversación'}`, reference(doc, date, all), ...body].join('\n\n') + '\n'
}

const stripMd = (s: string) => s.replace(/^#+\s*/, '').replace(/[*_`>]/g, '').replace(/\s+/g, ' ').trim()

/** Title of a note, or the first line of its content (markdown stripped, clipped to 60). */
export function noteLabel(note: Pick<Note, 'title' | 'content'>): string {
  const title = note.title.trim()
  if (title) return title
  const line = stripMd(note.content.split('\n').find((l) => stripMd(l)) ?? '')
  return line.length > 60 ? `${line.slice(0, 60).trimEnd()}…` : line
}

interface NotesExport { title: string; doc: Document | null; notes: Note[]; date: Date; sources?: readonly Source[] }

export function notesToMarkdown({ title, doc, notes, date, sources: all = [] }: NotesExport): string {
  const body = notes.map((n) => `## ${n.title.trim() || n.content.split('\n').find((l) => l.trim())?.trim() || 'Nota'}\n\n${n.content}${sources(n.content, n.citations, all)}`)
  return [`# Notas — ${title.trim() || 'Conversación'}`, reference(doc, date, all), ...body].join('\n\n') + '\n'
}

/** `mi-contrato.md` from a document / chat name. */
export function exportFilename(name: string, ext: string): string {
  const slug = name.replace(/\.[a-z0-9]{1,5}$/i, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `${slug || 'chat'}.${ext}`
}
