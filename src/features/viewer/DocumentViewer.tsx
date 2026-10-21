import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { Document as Doc } from '@/domain/types'
import { useTrace } from '@/features/conversation/TraceContext'
import { Sheet } from '@/ui/Sheet'
import { useIsPhone } from '@/ui/useMediaQuery'
import type { HighlightResult } from './highlight/types'
import { ChunkInspector } from './ChunkInspector'
import { DocumentSearch } from './DocumentSearch'
import { SelectionMenu } from './SelectionMenu'
import { AudioViewer } from '@/features/audio/AudioViewer'
import { TimeXrayStrip } from '@/features/audio/TimeXrayStrip'
import { VideoViewer } from '@/features/video/VideoViewer'
import { formatTime } from '@/domain/time'
import { EnrichStrip } from '@/features/ingest/EnrichStrip'
import { ImageViewer } from './ImageViewer'
import { TextViewer } from './TextViewer'
import { TraceBar } from './TraceBar'
import { TraceThread } from './TraceThread'
import { useXray } from './xray/XrayContext'
import { XrayStrip } from './xray/XrayStrip'
import { useCursorGlow } from './useCursorGlow'
import { useTextSelection } from './useTextSelection'
import styles from './DocumentViewer.module.css'

// pdf.js is heavy: only PDF chats pay for it.
const loadPdfViewer = () => import('./PdfViewer').then((m) => ({ default: m.PdfViewer }))
const PdfViewer = lazy(loadPdfViewer)

/**
 * Center column once the document is ready: picks the slot by file type, reads the trace seam
 * (`useTrace`) and shows the traza readout. On phones (<768 px) the same content lives in a bottom
 * sheet (85 dvh) that opens on a citation click or the "Documento" button.
 */
export function DocumentViewer({ doc, autoOpen = false }: { doc: Doc; autoOpen?: boolean }) {
  const { activeCitation, seq } = useTrace()
  const phone = useIsPhone()
  const stage = useRef<HTMLDivElement>(null)
  useCursorGlow(stage, !phone)
  const [open, setOpen] = useState(autoOpen) // a citation of another source switched the tab: the sheet opens on it
  const [inspecting, setInspecting] = useState(false)
  const [bodyEl, setBodyEl] = useState<HTMLDivElement | null>(null)
  const [scrollerEl, setScrollerEl] = useState<HTMLElement | null>(null)
  const [xrayOn, setXrayOn] = useState(true)
  const [selection, clearSelection] = useTextSelection(bodyEl)
  const [result, setResult] = useState<{ seq: number; res: HighlightResult | null }>({ seq: 0, res: null })
  const isPdf = /\.pdf$/i.test(doc.filename)
  const isImage = doc.kind === 'image'
  const isAudio = doc.kind === 'audio'
  const isVideo = doc.kind === 'video'
  useEffect(() => { if (isPdf) void loadPdfViewer() }, [isPdf]) // warm the chunk so the phone sheet doesn't open on a spinner
  const mine = activeCitation && activeCitation.document_id === doc.id ? activeCitation : null

  // Open during render (not in an effect): children's effects must already see it visible.
  const [seen, setSeen] = useState(seq)
  if (seen !== seq) { setSeen(seq); setOpen(true) }
  // A replay from an answer brings the strip (and, on phones, the sheet) up.
  const { replay } = useXray()
  const [replayed, setReplayed] = useState(replay)
  if (replayed !== replay) { setReplayed(replay); setOpen(true); setXrayOn(true) }

  const props = { doc, citation: mine, seq, onTrace: (s: number, res: HighlightResult) => setResult({ seq: s, res }), onScroller: setScrollerEl }
  const quality = result.seq === seq ? (result.res?.quality ?? null) : null
  const pages = doc.page_count != null ? ` · ${doc.page_count} ${doc.page_count === 1 ? 'pág.' : 'págs.'}` : isImage && doc.width && doc.height ? ` · ${doc.width}×${doc.height}` : (isAudio || isVideo) && doc.duration_s ? ` · ${formatTime(doc.duration_s)}${isVideo && doc.width && doc.height ? ` · ${doc.width}×${doc.height}` : ''}` : ''
  const top = mine
    ? <TraceBar citation={mine} quality={quality} />
    : <p className={styles.idle}>{doc.filename}{pages}<span> · tocá una cita para ver su fragmento</span></p>
  const search = <DocumentSearch doc={doc} />
  const inspect = (
    <button type="button" className={styles.tool} aria-pressed={inspecting} onClick={() => setInspecting((v) => !v)}>Fragmentos</button>
  )
  const xrayToggle = isImage ? null : (
    <button type="button" className={styles.tool} aria-pressed={xrayOn} onClick={() => setXrayOn((v) => !v)}>Rayos X</button>
  )
  const menu = <SelectionMenu selection={selection} onDone={() => { clearSelection(); if (phone) setOpen(false) }} />
  const viewer = isImage
    ? <ImageViewer {...props} />
    : isAudio
      ? <AudioViewer {...props} footer={xrayOn ? <TimeXrayStrip doc={doc} /> : null} />
      : isVideo
        ? <VideoViewer {...props} footer={xrayOn ? <TimeXrayStrip doc={doc} /> : null} />
        : isPdf
          ? <Suspense fallback={<p className={styles.idle} role="status">Abriendo documento…</p>}><PdfViewer {...props} /></Suspense>
          : <TextViewer {...props} />
  const body = (
    <div className={styles.split} data-inspecting={inspecting}>
      <div className={styles.read}>
        <div ref={setBodyEl} className={styles.body}>{viewer}</div>
        {xrayOn && !isImage && !isAudio && !isVideo && <XrayStrip doc={doc} scroller={scrollerEl} />}
      </div>
      {inspecting && <ChunkInspector doc={doc} />}
    </div>
  )

  if (!phone) {
    return (
      <div ref={stage} className={styles.doc}>
        <TraceThread />
        <div className={styles.head}>
          <div className={styles.top}>{top}{search}{inspect}{xrayToggle}</div>
          <EnrichStrip doc={doc} />
        </div>
        {body}
        {menu}
      </div>
    )
  }
  return (
    <>
      <button type="button" className={styles.openBtn} onClick={() => setOpen(true)}>
        <span>Documento</span><span className={styles.file}>{doc.filename}</span>
      </button>
      <Sheet
        open={open} onClose={() => setOpen(false)} label={`Documento ${doc.filename}`}
        header={(
          <>
            <div className={`${styles.top} ${styles.inSheet}`}>
              {top}
              {search}
              {inspect}
              {xrayToggle}
              <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Cerrar documento" data-autofocus>Cerrar ✕</button>
            </div>
            <EnrichStrip doc={doc} />
          </>
        )}
      >
        {body}
        {menu}
      </Sheet>
    </>
  )
}
