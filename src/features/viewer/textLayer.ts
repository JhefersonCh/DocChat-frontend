import { mergeRects } from './highlight/mergeRects'
import type { PageRect } from './highlight/types'

/** Text of a pdf.js text layer plus where each DOM text node sits inside it. */
export interface LayerText {
  text: string
  nodes: { node: Text; start: number; end: number }[]
}

/**
 * Reads the layer in DOM order: one text node per pdf.js item, `\n` where pdf.js put a `<br>`
 * (end of line). The offsets handed to locators index THIS text, so DOM mapping is exact.
 */
export function readLayer(layer: Element): LayerText {
  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  const nodes: LayerText['nodes'] = []
  let text = ''
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      const data = (n as Text).data
      nodes.push({ node: n as Text, start: text.length, end: text.length + data.length })
      text += data
    } else if ((n as Element).tagName === 'BR') text += '\n'
  }
  return { text, nodes }
}

/** Client rects of `[start,end)`, as fractions of `box` (the page wrapper). */
export function layerRects(info: LayerText, start: number, end: number, box: Element): PageRect[] {
  const b = box.getBoundingClientRect()
  if (!b.width || !b.height) return []
  const out: PageRect[] = []
  for (const { node, start: ns, end: ne } of info.nodes) {
    const lo = Math.max(start, ns)
    const hi = Math.min(end, ne)
    if (hi <= lo) continue
    const range = document.createRange()
    range.setStart(node, lo - ns)
    range.setEnd(node, hi - ns)
    for (const r of range.getClientRects()) {
      if (r.width < 1 || r.height < 1) continue
      out.push({ x: (r.left - b.left) / b.width, y: (r.top - b.top) / b.height, w: r.width / b.width, h: r.height / b.height })
    }
  }
  return mergeRects(out)
}
