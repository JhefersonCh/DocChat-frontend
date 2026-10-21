import './pdfjs'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Document } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import type { Citation, Document as Doc } from '@/domain/types'
import { documentFileUrl } from '@/api/documents'
import { isTyping } from '@/ui/typing'
import { chooseLocator } from './highlight/chooseLocator'
import { toTarget, type HighlightResult, type PageRect } from './highlight/types'
import { boxScrollTop } from '@/domain/media'
import { PdfPage } from './PdfPage'
import { loadPageSizes, type SizedDocument } from './pageSizes'
import { PdfSurface } from './PdfSurface'
import { useReadingStore } from './reading'
import { useSmoothScroll } from './useSmoothScroll'
import styles from './PdfViewer.module.css'

const AHEAD = 2 // pages kept mounted beyond the visible ones (plan §11)
const MAX_W = 820
const PAD = 24
const NO_RECTS: PageRect[] = []
const NO_BOXES: PageRect[] = []

interface Props {
  doc: Doc
  citation: Citation | null
  seq: number
  onTrace: (seq: number, result: HighlightResult) => void
  /** The scrolling element, for the X-ray minimap. */
  onScroller?: (el: HTMLDivElement | null) => void
}

export function PdfViewer({ doc, citation, seq, onTrace, onScroller }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const setScroller = useCallback((el: HTMLDivElement | null) => { scroller.current = el; onScroller?.(el) }, [onScroller])
  const surface = useMemo(() => new PdfSurface(), [])
  const scrollTo = useSmoothScroll(scroller)
  const [pages, setPages] = useState(0)
  const [sizes, setSizes] = useState<{ width: number; height: number }[]>([])
  const [failed, setFailed] = useState<string | null>(null)
  const [width, setWidth] = useState(0)
    const [win, setWin] = useState({ first: 1, last: 1, current: 1 })
  const [hl, setHl] = useState<{ seq: number; res: HighlightResult } | null>(null)
  const run = useRef(0)
  const sizing = useRef(0)
  const anchor = useRef<{ n: number; frac: number } | null>(null) // page at the top edge of the viewport + how far into it

  const ratio = (n: number) => (sizes[n - 1] ? sizes[n - 1].height / sizes[n - 1].width : 1.414)
  const pageW = Math.max(240, Math.min(MAX_W, width - PAD * 2))

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pageTop = useCallback((n: number) => {
    const sc = scroller.current
    const el = sc?.querySelector(`[data-page="${n}"]`)
    return sc && el ? el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop : 0
  }, [])

  const measure = useCallback(() => {
    const sc = scroller.current
    if (!sc || !pages) return
    const vh = sc.clientHeight
    const top = sc.getBoundingClientRect().top
    let first = 0, last = 0, current = 1, best = -1
    anchor.current = null
    for (const el of sc.querySelectorAll<HTMLElement>('[data-page]')) {
      const n = Number(el.dataset.page)
      const y = el.getBoundingClientRect().top - top
      if (!anchor.current && y + el.offsetHeight > 0) anchor.current = { n, frac: Math.max(0, -y) / (el.offsetHeight || 1) }
      const seen = Math.min(vh, y + el.offsetHeight) - Math.max(0, y)
      if (seen > 0) { first ||= n; last = n }
      if (seen > best) { best = seen; current = n } // the page with most of the viewport
    }
    first ||= current
    last ||= current
    setWin((w) => (w.first === first && w.last === last && w.current === current ? w : { first, last, current }))
  }, [pages])

  useEffect(() => {
    const sc = scroller.current
    if (!sc) return
    let raf = 0
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure) }
    sc.addEventListener('scroll', onScroll, { passive: true })
    return () => { sc.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [measure])
  // A width change (e.g. the chunk inspector opening) rescales every page: keep the reader on the same spot.
  useLayoutEffect(() => {
    const sc = scroller.current, a = anchor.current
    const el = a && sc?.querySelector<HTMLElement>(`[data-page="${a.n}"]`)
    if (sc && a && el) sc.scrollTop = pageTop(a.n) + a.frac * el.offsetHeight
  }, [pageW, pageTop])
  useLayoutEffect(measure, [measure, pageW, sizes])

  const onSize = useCallback((n: number, w: number, h: number) => {
    surface.setSize(n, w, h)
  }, [surface])

  // Every page's real size up front (no rendering): placeholders === rendered sheets, so the
  // scroll height is final from the first paint and scrolling never shifts under the reader.
  const onLoad = useCallback((pdf: SizedDocument) => {
    const mine = ++sizing.current
    void loadPageSizes(pdf, () => mine !== sizing.current).then((out) => {
      if (!out) return
      out.forEach((s, i) => onSize(i + 1, s.width, s.height))
      setSizes(out)
      setPages(pdf.numPages)
    }).catch(() => setFailed('No se pudo abrir el documento.'))
  }, [onSize])

  // The trace: jump to the page, wait for its text layer, locate the chunk, settle on it.
  useEffect(() => {
    if (!citation || citation.document_id !== doc.id || !pages) return
    const mine = ++run.current
    const target = toTarget(citation)
    scrollTo(pageTop(Math.min(Math.max(citation.page ?? 1, 1), pages)))
    void chooseLocator(target).locate(target, surface).then((res) => {
      if (mine !== run.current) return
      setHl({ seq, res })
      onTrace(seq, res)
      const first = res.ranges.find((r) => r.rects.length)
      if (!first || first.page == null) return
      const sc = scroller.current
      const h = Number(sc?.querySelector<HTMLElement>(`[data-page="${first.page}"]`)?.offsetHeight ?? 0)
      if (!sc) return
      scrollTo(first.box
        ? boxScrollTop(pageTop(first.page), h, first.rects[0], sc.clientHeight)
        : pageTop(first.page) + first.rects[0].y * h - sc.clientHeight * 0.3)
    })
    // eslint-disable-next-line -- only a new click (seq) or a freshly loaded file re-runs the trace
  }, [seq, pages])

  const reading = useReadingStore() // "solo lo que leí" follows the page in view
  const page = win.current
  useEffect(() => { if (pages) reading.setPage(page) }, [reading, pages, page])

  const go = (n: number) => scrollTo(pageTop(Math.min(Math.max(n, 1), pages)) - 8)
  const latest = useRef({ go, current: win.current })
  useEffect(() => { latest.current = { go, current: win.current } })
  // Alt+← / Alt+→: previous / next page (plan §9). Ignored while typing.
  useEffect(() => {
    if (!pages) return
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || isTyping(e.target)) return
      e.preventDefault()
      latest.current.go(latest.current.current + (e.key === 'ArrowRight' ? 1 : -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pages])
  const live = hl?.seq === seq ? hl : null
  const { rectsByPage, boxesByPage } = useMemo(() => {
    const text = new Map<number, PageRect[]>(), boxes = new Map<number, PageRect[]>()
    for (const r of live?.res.ranges ?? []) {
      const by = r.box ? boxes : text
      if (r.page != null) by.set(r.page, [...(by.get(r.page) ?? []), ...r.rects])
    }
    return { rectsByPage: text, boxesByPage: boxes }
  }, [live])

  return (
    <div className={styles.root}>
      <div ref={setScroller} className={styles.scroller} tabIndex={0} aria-label={`Documento ${doc.filename}`}>
        {failed ? (
          <p className={styles.state} role="alert">{failed}</p>
        ) : (
          <Document
            file={documentFileUrl(doc.id)}
            loading={<p className={styles.state} role="status">Abriendo documento…</p>}
            error={null}
            onLoadSuccess={onLoad}
            suspense={false}
            onLoadError={(e) => setFailed('status' in e && e.status === 404 ? 'Original no disponible. Las citas siguen mostrando su fragmento.' : 'No se pudo abrir el documento.')}
            className={styles.pages}
          >
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <PdfPage
                key={n} n={n} width={pageW} height={pageW * ratio(n)}
                live={n >= win.first - AHEAD && n <= win.last + AHEAD}
                surface={surface} rects={rectsByPage.get(n) ?? NO_RECTS} boxes={boxesByPage.get(n) ?? NO_BOXES} pulse={live?.seq ?? 0} onSize={onSize}
              />
            ))}
          </Document>
        )}
      </div>
      {pages > 0 && (
        <nav className={styles.nav} aria-label="Páginas">
          <button type="button" onClick={() => go(win.current - 1)} disabled={win.current <= 1} aria-label="Página anterior">◂</button>
          <span aria-live="off">pág. {win.current} / {pages}</span>
          <button type="button" onClick={() => go(win.current + 1)} disabled={win.current >= pages} aria-label="Página siguiente">▸</button>
        </nav>
      )}
    </div>
  )
}
