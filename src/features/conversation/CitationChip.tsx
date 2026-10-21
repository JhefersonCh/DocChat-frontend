import { useEffect, useId, useRef, useState } from 'react'
import { audioLabel, isAudioCitation } from '@/domain/audio'
import { isVideoTimed, videoLabel } from '@/domain/video'
import { citationAlias } from '@/domain/sources'
import type { Citation } from '@/domain/types'
import { useSources } from '@/features/sources/SourcesContext'
import { CitationPreview } from './CitationPreview'
import { sameCitation, useTrace } from './TraceContext'
import { usePulse } from './usePulse'
import styles from './CitationChip.module.css'

const HOVER_DELAY = 120

/** Inline `[n]` ref. Reads/writes the trace seam; the viewer and the thread react to it. Hover/focus previews it. */
export function CitationChip({ citation, group }: { citation: Citation; group: Citation[] }) {
  const { activeCitation, seq, onCiteSelect } = useTrace()
  const alias = citationAlias(useSources(), citation)
  const active = sameCitation(activeCitation, citation)
  const pulse = usePulse<HTMLButtonElement>(active, seq)
  const [preview, setPreview] = useState<HTMLElement | null>(null) // the chip itself while the popover shows
  const timer = useRef<number>(0)
  const tipId = useId()
  const where = isVideoTimed(citation) ? `, ${videoLabel(citation)}` : isAudioCitation(citation) ? `, ${audioLabel(citation)}` : `${citation.kind === 'image' ? ', imagen' : ''}${citation.page != null ? `, página ${citation.page}` : ''}`
  const show = () => setPreview(pulse.current)
  const stop = () => { window.clearTimeout(timer.current); setPreview(null) }
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return (
    <>
      <button
        ref={pulse}
        type="button"
        className={`${styles.chip} ${active ? styles.active : ''}`}
        data-chip-n={citation.n}
        aria-pressed={active}
        aria-label={`Cita ${citation.n}${alias ? `, fuente ${alias}` : ''}${where}`}
        aria-describedby={preview ? tipId : undefined}
        onClick={(e) => { stop(); onCiteSelect(citation, { origin: e.currentTarget, group }) }}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') timer.current = window.setTimeout(show, HOVER_DELAY) }}
        onPointerLeave={stop}
        onFocus={show}
        onBlur={stop}
        onKeyDown={(e) => { if (e.key === 'Escape' && preview) { e.stopPropagation(); stop() } }}
      >
        {citation.n}
        {alias && <span className={styles.alias} aria-hidden="true">{alias}</span>}
      </button>
      {preview && <CitationPreview id={tipId} citation={citation} anchor={preview} />}
    </>
  )
}
