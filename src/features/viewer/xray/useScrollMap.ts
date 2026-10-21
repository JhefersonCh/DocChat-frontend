import { useEffect, useState } from 'react'
import { bandsFromRects, type Band } from '@/domain/xray'

export interface ScrollMap {
  /** The viewport as fractions of the scrollable height. */
  view: { y: number; h: number }
  /** Page boxes (PDF) as fractions of the scrollable height; empty for text documents. */
  bands: Band[]
}

const EMPTY: ScrollMap = { view: { y: 0, h: 1 }, bands: [] }

function measure(el: HTMLElement, prev: ScrollMap, lastTotal: number) {
  const total = el.scrollHeight
  if (total <= 0) return { map: prev, total }
  let bands = prev.bands
  if (total !== lastTotal || bands.length === 0) {
    const top = el.getBoundingClientRect().top - el.scrollTop
    const rects = [...el.querySelectorAll<HTMLElement>('[data-page]')].map((p) => {
      const r = p.getBoundingClientRect()
      return { top: r.top - top, height: r.height }
    })
    bands = bandsFromRects(rects, total)
  }
  const view = { y: el.scrollTop / total, h: Math.min(1, el.clientHeight / total) }
  const same = prev.bands === bands && Math.abs(prev.view.y - view.y) < 0.0005 && Math.abs(prev.view.h - view.h) < 0.0005
  return { map: same ? prev : { view, bands }, total }
}

/** Viewport + page bands of a scroller, re-read on scroll, resize and content changes (one rAF each). */
export function useScrollMap(el: HTMLElement | null): ScrollMap {
  const [map, setMap] = useState<ScrollMap>(EMPTY)
  useEffect(() => {
    if (!el) return
    let raf = 0, total = -1, current = EMPTY
    const read = () => {
      raf = 0
      const out = measure(el, current, total)
      total = out.total
      if (out.map !== current) { current = out.map; setMap(out.map) }
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(read) }
    const ro = new ResizeObserver(schedule)
    const watch = () => { ro.observe(el); for (const c of el.children) ro.observe(c) }
    watch()
    const mo = new MutationObserver(() => { watch(); schedule() }) // the pages container appears after load
    mo.observe(el, { childList: true })
    el.addEventListener('scroll', schedule, { passive: true })
    schedule()
    return () => { cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect(); el.removeEventListener('scroll', schedule) }
  }, [el])
  return el ? map : EMPTY
}
