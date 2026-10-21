import type { PageRect, TextSurface } from './highlight/types'
import { layerRects, readLayer } from './textLayer'

const READY_TIMEOUT = 6000

/**
 * `TextSurface` over react-pdf pages. Pages are virtualized, so a page's text layer may not
 * exist yet: `pageText` waits for it to register (with a timeout -> page-only fallback).
 */
export class PdfSurface implements TextSurface {
  private boxes = new Map<number, HTMLElement>()
  private waiters = new Map<number, (() => void)[]>()
  private sizes = new Map<number, { width: number; height: number }>()

  register(page: number, box: HTMLElement) {
    this.boxes.set(page, box)
    this.waiters.get(page)?.forEach((fn) => fn())
    this.waiters.delete(page)
  }
  unregister(page: number, box: HTMLElement) {
    if (this.boxes.get(page) === box) this.boxes.delete(page)
  }
  setSize(page: number, width: number, height: number) { this.sizes.set(page, { width, height }) }
  pageSize(page: number) { return this.sizes.get(page) ?? null }

  private layer(page: number) {
    return this.boxes.get(page)?.querySelector('.react-pdf__Page__textContent') ?? null
  }

  private ready(page: number): Promise<void> {
    if (this.boxes.has(page)) return Promise.resolve()
    return new Promise((resolve) => {
      const t = setTimeout(resolve, READY_TIMEOUT)
      this.waiters.set(page, [...(this.waiters.get(page) ?? []), () => { clearTimeout(t); resolve() }])
    })
  }

  async pageText(page: number | null) {
    if (page == null) return null
    await this.ready(page)
    // The box registers when react-pdf says the layer rendered; it can still be re-rendering.
    for (let i = 0; i < 40; i++) {
      const layer = this.layer(page)
      const text = layer ? readLayer(layer).text : ''
      if (text) return text
      await new Promise((r) => setTimeout(r, 50))
    }
    return null
  }

  rects(page: number | null, start: number, end: number): PageRect[] {
    const layer = page == null ? null : this.layer(page)
    const box = page == null ? null : this.boxes.get(page)
    return layer && box ? layerRects(readLayer(layer), start, end, box) : []
  }
}
