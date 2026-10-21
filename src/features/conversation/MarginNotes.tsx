import { memo, useId, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { displaySnippet, relevanceLabel, shortSection } from '@/domain/citations'
import { audioLabel, audioRange, isAudioCitation } from '@/domain/audio'
import { imageLabel, isImageCitation, thumbId } from '@/domain/media'
import { citationAlias, withAlias } from '@/domain/sources'
import type { Citation } from '@/domain/types'
import { useSources } from '@/features/sources/SourcesContext'
import { MiniWave } from '@/features/audio/MiniWave'
import { FrameThumb } from '@/features/video/FrameThumb'
import { isVideoCitation, isVideoTimed, playableRange, videoLabel } from '@/domain/video'
import { PlayRange } from '@/features/audio/PlayRange'
import { Lightbox } from '@/ui/Lightbox'
import { Thumb } from '@/ui/Thumb'
import { ease, spring } from '@/ui/motion'
import { sameCitation, useTrace } from './TraceContext'
import { usePulse } from './usePulse'
import styles from './MarginNotes.module.css'

const pages = (c: Citation) =>
  c.page == null ? null : c.page_end != null && c.page_end !== c.page ? `p. ${c.page}–${c.page_end}` : `p. ${c.page}`

interface NoteProps { citation: Citation; group: Citation[]; lit: boolean; index: number; live: boolean; settled: boolean }

// memo: during streaming nothing here changes, and `layout` would re-measure on every token otherwise.
const Note = memo(function Note({ citation, group, lit, index, live, settled }: NoteProps) {
  const { activeCitation, seq, onCiteSelect } = useTrace()
  const calm = useReducedMotion()
  const active = sameCitation(activeCitation, citation)
  const pulse = usePulse<HTMLButtonElement>(active, seq)
  const section = shortSection(citation.section, 44)
  const alias = citationAlias(useSources(), citation)
  const image = isImageCitation(citation)
  const thumb = thumbId(citation)
  const range = playableRange(citation)
  const wave = audioRange(citation)
  const video = isVideoCitation(citation)
  const thumbLabel = video ? videoLabel(citation) : imageLabel(citation)
  const [zoomed, setZoomed] = useState(false)
  const meta = [withAlias(alias, image ? imageLabel(citation) : isVideoTimed(citation) ? videoLabel(citation) : isAudioCitation(citation) ? audioLabel(citation) : pages(citation)), section && `§${section}`, citation.chunk_id && `chunk ${citation.chunk_id.slice(0, 4)}`, relevanceLabel(citation.score) && `rel. ${relevanceLabel(citation.score)}`].filter(Boolean).join(' · ')
  // Arrival over SSE slides in from the right (#3). Unfolding afterwards grows from 0 height instead (#4).
  const arriving = live && !settled
  const hidden = calm ? { opacity: 0 } : arriving ? { opacity: 0, x: 12 } : { opacity: 0, height: 0, paddingBottom: 0 }
  return (
    <motion.li
      className={styles.item}
      layout="position"
      initial={hidden}
      animate={{ opacity: 1, x: 0, height: 'auto', paddingBottom: 12 }}
      exit={calm ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, height: 0, paddingBottom: 0, transition: { duration: 0.24, ease } }}
      transition={calm ? { duration: 0.12 } : arriving ? { ...spring, delay: index * 0.04 } : { duration: 0.24, ease }}
    >
      <button
        ref={pulse}
        type="button"
        data-note-n={citation.n}
        data-thumb={thumb || range ? 'true' : undefined}
        className={`${styles.note} ${lit ? styles.lit : ''} ${active ? styles.active : ''}`}
        aria-pressed={active}
        onClick={(e) => onCiteSelect(citation, { origin: e.currentTarget, group })}
      >
        <span className={styles.n}>{citation.n}</span>
        <span className={styles.snippet}>{displaySnippet(citation.snippet) || (image || video ? 'Sin descripción de texto.' : '')}</span>
        {meta && <span className={styles.meta} title={citation.section ?? undefined}>{meta}</span>}
        {thumb && (video && citation.t_start != null
          ? <FrameThumb chunkId={thumb} docId={citation.document_id} start={citation.t_start} end={citation.t_end} alt={thumbLabel} className={`${styles.thumb} ${styles.frame}`} />
          : <Thumb chunkId={thumb} alt={thumbLabel} width={84} className={styles.thumb} />)}
        {wave && <MiniWave docId={citation.document_id} start={wave.start} end={wave.end} className={styles.thumb} />}
      </button>
      {range && <PlayRange docId={citation.document_id} start={range.start} end={range.end} className={styles.play} />}
      {thumb && (
        <>
          <button type="button" className={styles.expand} aria-label={`Ampliar ${thumbLabel}`} onClick={() => setZoomed(true)}>⤢</button>
          <Lightbox chunkId={zoomed ? thumb : null} label={thumbLabel} onClose={() => setZoomed(false)} />
        </>
      )}
    </motion.li>
  )
})

interface Props {
  citations: Citation[]
  cited: number[]
  /** Turn over: consulted-but-not-cited notes fold into "Fuentes consultadas". */
  settled: boolean
  /** Citations just arrived over SSE: play the stagger. */
  live: boolean
}

const sameNums = (a: number[], b: number[]) => a.length === b.length && a.every((n, i) => n === b[i])

/** "3" when every consulted source is cited, otherwise "3 citadas · 12 consultadas". */
const countLabel = (cited: number, total: number) =>
  cited === 0 ? `${total} consultadas` : cited === total ? `${cited}` : `${cited} citadas · ${total} consultadas`

export const MarginNotes = memo(function MarginNotes({ citations, cited, settled, live }: Props) {
  const [shown, setShown] = useState(false) // sources start collapsed; the inline [n] chips stay the primary path
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const calm = useReducedMotion()
  if (citations.length === 0) return null
  const isLit = (c: Citation) => cited.includes(c.n)
  const folded = settled ? citations.filter((c) => !isLit(c)) : []
  const visible = settled && !open ? citations.filter(isLit) : citations
  const panel = calm
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.12 } }
    : {
        initial: { opacity: 0, height: 0 },
        animate: { opacity: 1, height: 'auto' },
        exit: { opacity: 0, height: 0 },
        transition: { duration: 0.22, ease },
      }
  return (
    <div className={styles.wrap} role="group" aria-label="Fuentes">
      <button type="button" className={styles.reveal} aria-expanded={shown} aria-controls={panelId} onClick={() => setShown((s) => !s)}>
        <span className={styles.chev} aria-hidden="true" />
        {shown ? 'Ocultar fuentes' : `Mostrar fuentes (${countLabel(cited.length, citations.length)})`}
      </button>
      <div id={panelId}>
        <AnimatePresence initial={false}>
          {shown && (
            <motion.div key="panel" className={styles.panel} {...panel}>
              <ul className={styles.list}>
                <AnimatePresence initial={false}>
                  {visible.map((c, i) => (
                    <Note key={c.n} citation={c} group={citations} lit={isLit(c)} index={i} live={live} settled={settled} />
                  ))}
                </AnimatePresence>
              </ul>
              {folded.length > 0 && (
                <button type="button" className={styles.toggle} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                  {open ? '− Ocultar' : `+ Fuentes consultadas (${folded.length})`}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}, (a, b) => a.citations === b.citations && a.settled === b.settled && a.live === b.live && sameNums(a.cited, b.cited))
