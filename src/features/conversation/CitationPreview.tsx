import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { displaySnippet, relevanceLabel, shortSection } from '@/domain/citations'
import { audioLabel, audioRange, isAudioCitation } from '@/domain/audio'
import { imageLabel, isImageCitation, thumbId } from '@/domain/media'
import { citationAlias, withAlias } from '@/domain/sources'
import type { Citation } from '@/domain/types'
import { useSources } from '@/features/sources/SourcesContext'
import { MiniWave } from '@/features/audio/MiniWave'
import { FrameThumb } from '@/features/video/FrameThumb'
import { isVideoCitation, isVideoTimed, videoLabel } from '@/domain/video'
import { Thumb } from '@/ui/Thumb'
import styles from './CitationPreview.module.css'

const W = 320
const GAP = 8

const pages = (c: Citation) =>
  c.page == null ? null : c.page_end != null && c.page_end !== c.page ? `p. ${c.page}–${c.page_end}` : `p. ${c.page}`

interface Props { id: string; citation: Citation; anchor: HTMLElement }

/** Popover of a `[n]` chip. Portaled and fixed: it never moves the text around it. */
export function CitationPreview({ id, citation, anchor }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const alias = citationAlias(useSources(), citation)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const a = anchor.getBoundingClientRect()
    const h = box.current?.offsetHeight ?? 0
    const above = a.top - GAP - h >= 8
    setPos({
      left: Math.max(8, Math.min(a.left + a.width / 2 - W / 2, window.innerWidth - W - 8)),
      top: above ? a.top - GAP - h : a.bottom + GAP,
    })
  }, [anchor])

  const image = isImageCitation(citation)
  const thumb = thumbId(citation)
  const audio = isAudioCitation(citation)
  const range = audioRange(citation)
  const video = isVideoCitation(citation)
  const meta = [withAlias(alias, image ? imageLabel(citation) : isVideoTimed(citation) ? videoLabel(citation) : audio ? audioLabel(citation) : pages(citation)), relevanceLabel(citation.score)].filter(Boolean).join(' · ')
  const section = shortSection(citation.section, 80)
  return createPortal(
    <div
      ref={box} id={id} role="tooltip" className={styles.tip}
      style={{ width: W, left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}
    >
      <div className={thumb || range ? styles.withThumb : undefined}>
        {thumb && (video && citation.t_start != null
          ? <FrameThumb chunkId={thumb} docId={citation.document_id} start={citation.t_start} end={citation.t_end} alt={videoLabel(citation)} className={styles.frame} />
          : <Thumb chunkId={thumb} alt={imageLabel(citation)} width={112} />)}
        {range && <MiniWave docId={citation.document_id} start={range.start} end={range.end} bars={32} />}
        <div className={styles.text}>
          {(section || meta) && (
            <p className={styles.meta}>{section && <span className={styles.section}>{section}</span>}{meta && <span>{meta}</span>}</p>
          )}
          <p className={styles.snippet}>{displaySnippet(citation.snippet) || (image || video ? 'Sin descripción de texto.' : '')}</p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
