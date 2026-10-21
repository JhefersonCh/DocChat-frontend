// Pure helpers for the "Pegar texto" source: the pasted text becomes a .md/.txt file that ingests like any upload.

/** Soft limit: above this the modal warns (it still lets you add it). */
export const SOFT_LIMIT_BYTES = 2 * 1024 * 1024
const TITLE_MAX = 60

const pad = (n: number) => String(n).padStart(2, '0')
export const byteLength = (text: string) => new TextEncoder().encode(text).length
export const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0)
export const isOverLimit = (text: string) => byteLength(text) > SOFT_LIMIT_BYTES

/** Headings, tables, lists, fences or blockquotes: enough signal to keep the structure as `.md`. */
export function looksLikeMarkdown(text: string): boolean {
  return /^ {0,3}#{1,6}\s+\S/m.test(text)
    || /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/m.test(text)
    || /^\s*(?:[-*+]|\d+[.)])\s+\S/m.test(text)
    || /^```/m.test(text)
    || /^>\s+\S/m.test(text)
}

/** Given title, else the first non-empty line (markdown marks stripped, ~60 chars), else "Texto pegado DD-MM HH:mm". */
export function resolveTitle(text: string, title: string, now: Date = new Date()): string {
  const given = title.trim()
  const first = text.split(/\r?\n/).map((l) => l.replace(/^[\s#>*+-]+/, '').trim()).find(Boolean)
  const raw = given || first
  if (raw) return raw.length > TITLE_MAX ? `${raw.slice(0, TITLE_MAX).trimEnd()}…` : raw
  return `Texto pegado ${pad(now.getDate())}-${pad(now.getMonth() + 1)} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export function slugify(title: string): string {
  const slug = title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '')
  return slug || 'texto-pegado'
}

export type PastedFile = { ok: true; file: File; title: string } | { ok: false; code: 'empty_text' }

export function buildPastedFile(text: string, title: string, now: Date = new Date()): PastedFile {
  if (!text.trim()) return { ok: false, code: 'empty_text' }
  const resolved = resolveTitle(text, title, now)
  const md = looksLikeMarkdown(text)
  const body = md && !/^\s*#\s/.test(text) && title.trim() ? `# ${resolved}\n\n${text}` : text
  const file = new File([body], `${slugify(resolved)}.${md ? 'md' : 'txt'}`, { type: md ? 'text/markdown' : 'text/plain' })
  return { ok: true, file, title: resolved }
}

/** True when a paste/keystroke targets something the user is typing into. */
export function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}
