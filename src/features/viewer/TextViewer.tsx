import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDocumentText } from '@/api/documents'
import { keys } from '@/api/queryKeys'
import type { Citation, Document as Doc } from '@/domain/types'
import { chooseLocator } from './highlight/chooseLocator'
import { toTarget, type HighlightResult, type TextSurface } from './highlight/types'
import { useSmoothScroll } from './useSmoothScroll'
import styles from './TextViewer.module.css'

interface Props {
  doc: Doc
  citation: Citation | null
  seq: number
  onTrace: (seq: number, result: HighlightResult) => void
  /** The scrolling element, for the X-ray minimap. */
  onScroller?: (el: HTMLDivElement | null) => void
}

/** TXT/MD as raw text: the DOM text IS the surface text, so offsets map 1:1 (markdown is shown unrendered on purpose). */
export function TextViewer({ doc, citation, seq, onTrace, onScroller }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const setScroller = useCallback((el: HTMLDivElement | null) => { scroller.current = el; onScroller?.(el) }, [onScroller])
  const mark = useRef<HTMLElement>(null)
  const scrollTo = useSmoothScroll(scroller)
  const file = useQuery({ queryKey: keys.documentFile(doc.id), queryFn: () => getDocumentText(doc.id), staleTime: Infinity, retry: false })
  const text = file.data
  const [stored, setHl] = useState<{ seq: number; start: number; end: number } | null>(null)
  const surface = useMemo<TextSurface | null>(() => (text == null ? null : {
    pageText: async (p) => (p == null ? text : null),
    rects: () => [],
    pageSize: () => null,
  }), [text])
  const run = useRef(0)
  const hl = stored?.seq === seq && stored.end > stored.start ? stored : null

  useEffect(() => {
    if (!citation || citation.document_id !== doc.id || !surface) return
    const mine = ++run.current
    const target = { ...toTarget(citation), page: null, pageEnd: null }
    void chooseLocator(target).locate(target, surface).then((res) => {
      if (mine !== run.current) return
      onTrace(seq, res)
      const r = res.ranges[0]
      setHl({ seq, start: r?.start ?? 0, end: r?.end ?? 0 })
    })
    // eslint-disable-next-line -- only a new click (seq) or the loaded text re-runs the trace
  }, [seq, surface])

  useEffect(() => {
    const sc = scroller.current
    const m = mark.current
    if (!hl || !sc || !m) return
    const y = m.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop
    scrollTo(y - sc.clientHeight * 0.3)
  }, [hl, scrollTo])

  if (file.error) {
    const gone = (file.error as { code?: string }).code === 'file_not_found'
    return <p className={styles.state} role="alert">{gone ? 'Original no disponible. Las citas siguen mostrando su fragmento.' : 'No se pudo abrir el documento.'}</p>
  }
  if (text == null) return <p className={styles.state} role="status">Abriendo documento…</p>
  return (
    <div ref={setScroller} className={styles.scroller} tabIndex={0} aria-label={`Documento ${doc.filename}`}>
      <article className={`paper ${styles.sheet}`}>
        {hl ? (
          <>
            {text.slice(0, hl.start)}
            <mark key={hl.seq} ref={mark} className={styles.mark} data-highlight>{text.slice(hl.start, hl.end)}</mark>
            {text.slice(hl.end)}
          </>
        ) : text}
      </article>
    </div>
  )
}
