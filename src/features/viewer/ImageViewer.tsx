import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { documentFileUrl } from '@/api/documents'
import { clampView, FIT, fitSize, frameBBox, zoomAt, type Size, type View } from '@/domain/imageView'
import { bboxToRect } from '@/domain/media'
import type { Citation, Document as Doc } from '@/domain/types'
import { BBoxOverlay } from './BBoxOverlay'
import type { HighlightResult } from './highlight/types'
import styles from './ImageViewer.module.css'

interface Props {
  doc: Doc
  citation: Citation | null
  seq: number
  onTrace: (seq: number, result: HighlightResult) => void
}

const STEP = 1.25
const ZERO: Size = { w: 0, h: 0 }

/**
 * Center column for a standalone image: fit-to-view, wheel / button / double-click zoom around the pointer,
 * drag to pan, and an amber frame for the region of the active citation (tiles). Reports the trace result so
 * the TraceBar reads "región" like it does for a PDF.
 */
export function ImageViewer({ doc, citation, seq, onTrace }: Props) {
  const stage = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<Size>(ZERO)
  const [natural, setNatural] = useState<Size>({ w: doc.width ?? 4, h: doc.height ?? 3 })
  const [view, setView] = useState<View>(FIT)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const fit = fitSize(box, natural)

  useLayoutEffect(() => {
    const el = stage.current
    if (!el) return
    const read = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => { setView((v) => clampView(v, box, fit)) }, [box.w, box.h, fit.w, fit.h]) // eslint-disable-line -- fit derives from box/natural

  const at = useCallback((clientX: number, clientY: number) => {
    const r = stage.current!.getBoundingClientRect()
    return { x: clientX - r.left - r.width / 2, y: clientY - r.top - r.height / 2 }
  }, [])
  const zoomBy = (factor: number, point = { x: 0, y: 0 }) => setView((v) => zoomAt(v, factor, point, box, fit))

  // Non-passive wheel: the page behind must not scroll while zooming.
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setView((v) => zoomAt(v, Math.exp(-e.deltaY * 0.0015), at(e.clientX, e.clientY), box, fit))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [at, box, fit.w, fit.h]) // eslint-disable-line -- fit derives from box/natural

  const region = citation && citation.document_id === doc.id && citation.kind === 'image' && citation.bbox ? bboxToRect(citation.bbox) : null
  const partial = region && region.w * region.h < 0.8 ? region : null
  const bbox = citation?.bbox
  const mine = !!citation && citation.document_id === doc.id
  // A new click frames its region (derived during render, once the image box is measured).
  const [framed, setFramed] = useState(0)
  if (mine && framed !== seq && fit.w > 0) {
    setFramed(seq)
    setView(bbox ? frameBBox(bbox, box, fit) : FIT)
  }
  useEffect(() => {
    if (mine && fit.w > 0) onTrace(seq, { quality: region ? 'bbox' : 'page-only', ranges: [] })
    // eslint-disable-next-line -- only a new click (seq) or the first measurement re-runs the trace
  }, [seq, fit.w > 0])

  const onDown = (e: ReactPointerEvent) => {
    if (view.zoom <= 1) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }
    setDragging(true)
  }
  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current
    if (d) setView((v) => clampView({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y }, box, fit))
  }
  const onUp = () => { drag.current = null; setDragging(false) }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === '+' || e.key === '=') zoomBy(STEP)
    else if (e.key === '-') zoomBy(1 / STEP)
    else if (e.key === '0') setView(FIT)
    else return
    e.preventDefault()
  }

  const pct = Math.round(view.zoom * 100)
  return (
    <div className={styles.root}>
      <div
        ref={stage} className={styles.stage} tabIndex={0} aria-label={`Documento ${doc.filename}`} data-dragging={dragging}
        data-pan={view.zoom > 1} onKeyDown={onKey} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onDoubleClick={(e) => (view.zoom > 1 ? setView(FIT) : zoomBy(2.5, at(e.clientX, e.clientY)))}
      >
        {state === 'error' ? (
          <p className={styles.state} role="alert">Original no disponible. Las citas siguen mostrando su fragmento.</p>
        ) : (
          <div
            className={styles.canvas} data-state={state}
            style={{ width: fit.w, height: fit.h, transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
          >
            <img
              className={styles.img} src={documentFileUrl(doc.id)} alt={doc.filename} draggable={false}
              onLoad={(e) => { setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight }); setState('ok') }}
              onError={() => setState('error')}
            />
            {partial && state === 'ok' && <BBoxOverlay key={seq} rect={partial} />}
          </div>
        )}
        {state === 'loading' && <p className={styles.loading} role="status">Abriendo imagen…</p>}
      </div>
      <div className={styles.bar} role="group" aria-label="Zoom">
        <button type="button" onClick={() => zoomBy(1 / STEP)} disabled={view.zoom <= 1} aria-label="Alejar">−</button>
        <span aria-live="off">{pct}%</span>
        <button type="button" onClick={() => zoomBy(STEP)} disabled={view.zoom >= 8} aria-label="Acercar">+</button>
        <button type="button" onClick={() => setView(FIT)} disabled={view.zoom === 1 && view.x === 0 && view.y === 0}>Ajustar</button>
      </div>
    </div>
  )
}
