import { memo, useCallback, useEffect, useRef } from 'react'
import { Page } from 'react-pdf'
import { BBoxOverlay } from './BBoxOverlay'
import { HighlightOverlay } from './HighlightOverlay'
import type { PageRect } from './highlight/types'
import type { PdfSurface } from './PdfSurface'
import styles from './PdfViewer.module.css'

interface Props {
  n: number
  width: number
  height: number
  /** Inside the virtualization window: mount the real pdf.js page, else an empty sheet. */
  live: boolean
  surface: PdfSurface
  rects: PageRect[]
  /** Image regions (outline frames), drawn apart from the text marker. */
  boxes: PageRect[]
  pulse: number
  onSize: (n: number, w: number, h: number) => void
}

/** One sheet. The wrapper is the page box that highlight fractions are relative to. */
export const PdfPage = memo(function PdfPage({ n, width, height, live, surface, rects, boxes, pulse, onSize }: Props) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = box.current
    return () => { if (el) surface.unregister(n, el) }
  }, [n, surface, live])

  // Stable callbacks: react-pdf re-renders the text layer when they change.
  const loaded = useCallback((p: { originalWidth: number; originalHeight: number }) => onSize(n, p.originalWidth, p.originalHeight), [n, onSize])
  const rendered = useCallback(() => { if (box.current) surface.register(n, box.current) }, [n, surface])
  return (
    <div ref={box} className={`paper ${styles.sheet}`} data-page={n} style={{ width, height }}>
      {live && (
        <Page
          pageNumber={n}
          width={width}
          renderAnnotationLayer={false}
          loading={null}
          suspense={false}
          onLoadSuccess={loaded}
          onRenderTextLayerSuccess={rendered}
        />
      )}
      {boxes.map((b, i) => <BBoxOverlay key={`${pulse}:${i}`} rect={b} />)}
      {rects.length > 0 && <HighlightOverlay key={pulse} rects={rects} />}
      <span className={styles.folio} aria-hidden="true">{n}</span>
    </div>
  )
})
