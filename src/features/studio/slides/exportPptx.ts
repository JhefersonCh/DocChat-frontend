// PPTX in the browser. pptxgenjs is loaded on demand (the library is ~400 kB): never part of the main bundle.
import { segmentAssetUrl } from '@/api/media'
import type { Slide, SlidesData } from '@/domain/artifacts'
import { deckFileName, refLabel, splitColumns } from '@/domain/slides'

const C = { bg: '0B0C0E', text: 'D9DCE1', muted: '8A8F98', amber: 'FFB000', white: 'FFFFFF' }
const H = 5.625
const SERIF = 'Georgia'
const SANS = 'Calibri'

interface Img { data: string; w: number; h: number }

/** Fetches a segment asset and re-encodes it as PNG (PowerPoint does not read WebP everywhere). */
export async function fetchPng(url: string): Promise<Img | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const bitmap = await createImageBitmap(await res.blob())
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
    return { data: canvas.toDataURL('image/png'), w: bitmap.width, h: bitmap.height }
  } catch {
    return null
  }
}

/** Largest box of the image's aspect ratio inside (x, y, w, h), centered. */
export function fit(img: { w: number; h: number }, x: number, y: number, w: number, h: number) {
  const k = Math.min(w / img.w, h / img.h)
  const iw = img.w * k
  const ih = img.h * k
  return { x: x + (w - iw) / 2, y: y + (h - ih) / 2, w: iw, h: ih }
}

export async function buildPptx(deck: SlidesData, aliasOf: (id: string | null) => string | null): Promise<Blob> {
  const { default: Pptx } = await import('pptxgenjs')
  const pptx = new Pptx()
  pptx.layout = 'LAYOUT_16x9'
  pptx.title = deck.title
  const images = new Map<string, Img | null>()
  await Promise.all(deck.slides.flatMap((s) => (s.visual?.kind === 'image' ? [s.visual.segment_id] : [])).map(async (id) => {
    images.set(id, await fetchPng(segmentAssetUrl(id)))
  }))

  const bullets = (items: string[]) => items.map((t) => ({ text: t, options: { bullet: { code: '25A0', color: C.amber }, breakLine: true } }))
  deck.slides.forEach((s: Slide, i) => {
    const slide = pptx.addSlide()
    slide.background = { color: C.bg }
    slide.addShape('rect', { x: 0, y: 0, w: 0.08, h: H, fill: { color: C.amber }, line: { color: C.amber, width: 0 } })
    if (s.notes) slide.addNotes(s.notes)
    if (s.layout === 'title' || s.layout === 'closing') {
      slide.addShape('rect', { x: 0.8, y: 1.7, w: 1.2, h: 0.06, fill: { color: C.amber }, line: { color: C.amber, width: 0 } })
      slide.addText(s.title, { x: 0.8, y: 1.9, w: 8.4, h: 1.5, fontFace: SERIF, fontSize: 38, color: C.white, valign: 'top' })
      if (s.bullets.length) slide.addText(s.bullets.join(' · '), { x: 0.8, y: 3.5, w: 8, h: 0.8, fontFace: SANS, fontSize: 18, color: C.muted, valign: 'top' })
    } else if (s.layout === 'quote') {
      slide.addText('“', { x: 0.6, y: 0.7, w: 1, h: 1, fontFace: SERIF, fontSize: 80, color: C.amber })
      slide.addText(s.bullets[0] ?? '', { x: 1, y: 1.4, w: 8, h: 2.6, fontFace: SERIF, fontSize: 26, italic: true, color: C.white, valign: 'top' })
      slide.addText(s.title.toUpperCase(), { x: 1, y: 4.1, w: 8, h: 0.4, fontFace: SANS, fontSize: 12, color: C.amber, charSpacing: 2 })
    } else {
      slide.addText(s.title, { x: 0.6, y: 0.4, w: 8.8, h: 0.9, fontFace: SERIF, fontSize: 28, color: C.white, valign: 'top' })
      const hasVisual = !!s.visual && s.layout !== 'two_column'
      const textW = hasVisual ? 4.6 : 8.8
      if (s.layout === 'two_column') {
        const [a, b] = splitColumns(s.bullets)
        slide.addText(bullets(a), { x: 0.6, y: 1.5, w: 4.3, h: 3, fontFace: SANS, fontSize: 16, color: C.text, valign: 'top', paraSpaceAfter: 8 })
        slide.addText(bullets(b), { x: 5.1, y: 1.5, w: 4.3, h: 3, fontFace: SANS, fontSize: 16, color: C.text, valign: 'top', paraSpaceAfter: 8 })
      } else if (s.bullets.length) {
        slide.addText(bullets(s.bullets), { x: 0.6, y: 1.5, w: textW, h: 3, fontFace: SANS, fontSize: 16, color: C.text, valign: 'top', paraSpaceAfter: 8 })
      }
      const v = s.visual
      if (hasVisual && v?.kind === 'image') {
        const img = images.get(v.segment_id)
        if (img) slide.addImage({ data: img.data, altText: v.caption, ...fit(img, 5.4, 1.5, 4, 3) })
      } else if (hasVisual && v?.kind === 'chart') {
        const c = v.spec
        const common = { x: 5.2, y: 1.4, w: 4.4, h: 3.1, showLegend: true, legendPos: 'b' as const, legendColor: C.text, catAxisLabelColor: C.text, valAxisLabelColor: C.text, showTitle: false }
        const data = c.series.map((x) => ({ name: x.name || c.title, labels: c.labels, values: x.values }))
        if (c.type === 'pie') slide.addChart(pptx.ChartType.pie, data.slice(0, 1), { ...common, dataLabelColor: C.white })
        else slide.addChart(c.type === 'line' ? pptx.ChartType.line : pptx.ChartType.bar, data, { ...common, chartColors: [C.amber, '7FB7BE', 'C9A0DC', '9BC53D'], valGridLine: { color: '2E333B', size: 0.5 } })
      }
    }
    const sources = [...new Set(s.refs.map((r) => refLabel(r, aliasOf(r.document_id))))]
    slide.addText(sources.length ? `Fuentes: ${sources.join(' · ')}` : '', { x: 0.6, y: 5.05, w: 7.6, h: 0.4, fontFace: SANS, fontSize: 10, color: C.muted })
    slide.addText(`${i + 1} / ${deck.slides.length}`, { x: 8.4, y: 5.05, w: 1, h: 0.4, fontFace: SANS, fontSize: 10, color: C.amber, align: 'right' })
  })
  return (await pptx.write({ outputType: 'blob' })) as Blob
}

export async function exportPptx(deck: SlidesData, aliasOf: (id: string | null) => string | null): Promise<void> {
  const blob = await buildPptx(deck, aliasOf)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = deckFileName(deck, 'pptx')
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
