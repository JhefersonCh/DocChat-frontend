// Slide decks (Estudio): pure helpers for labels, columns and the Markdown export. No React, no DOM.
import { formatTime } from './time'
import { withAlias } from './sources'
import type { Slide, SlideRef, SlidesData } from './artifacts'

/** `S2 · pág. 3` / `S1 · 01:20`; the alias only when there are several sources. */
export function refLabel(ref: Pick<SlideRef, 'page' | 't_start'>, alias: string | null): string {
  const where = ref.page != null ? `pág. ${ref.page}` : ref.t_start != null ? formatTime(ref.t_start) : 'fuente'
  return withAlias(alias, where)
}

/** Two-column layout: even bullets go left, odd ones right. */
export function splitColumns(bullets: string[]): [string[], string[]] {
  return [bullets.filter((_, i) => i % 2 === 0), bullets.filter((_, i) => i % 2 === 1)]
}

export const slideRefLabels = (slide: Slide, aliasOf: (id: string | null) => string | null) =>
  [...new Set(slide.refs.map((r) => refLabel(r, aliasOf(r.document_id))))]

export const deckFileName = (deck: Pick<SlidesData, 'title'>, ext: string) =>
  `${(deck.title || 'presentacion').normalize('NFD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 60) || 'presentacion'}.${ext}`

/** The deck as Markdown: one `##` per slide, bullets, speaker notes and its verified quotes. */
export function deckToMarkdown(deck: SlidesData, aliasOf: (id: string | null) => string | null): string {
  const out = [`# ${deck.title}`]
  if (deck.subtitle) out.push('', `_${deck.subtitle}_`)
  deck.slides.forEach((s, i) => {
    out.push('', '---', '', `## ${i + 1}. ${s.title}`)
    if (s.layout === 'quote' && s.bullets[0]) out.push('', `> ${s.bullets[0]}`)
    else if (s.bullets.length) out.push('', ...s.bullets.map((b) => `- ${b}`))
    if (s.visual?.kind === 'image') out.push('', `_Imagen: ${s.visual.caption || s.visual.segment_id}_`)
    if (s.visual?.kind === 'chart') {
      const c = s.visual.spec
      out.push('', `**${c.title || 'Gráfico'}**`, '', `| | ${c.series.map((x) => x.name).join(' | ')} |`, `|---|${c.series.map(() => '---').join('|')}|`,
        ...c.labels.map((l, j) => `| ${l} | ${c.series.map((x) => x.values[j]).join(' | ')} |`))
    }
    if (s.notes) out.push('', `**Notas:** ${s.notes}`)
    if (s.refs.length) out.push('', ...s.refs.map((r) => `- Fuente ${refLabel(r, aliasOf(r.document_id))}: «${r.quote}»`))
  })
  return out.join('\n') + '\n'
}
