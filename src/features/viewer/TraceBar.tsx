import { shortSection } from '@/domain/citations'
import { audioLabel, isAudioCitation } from '@/domain/audio'
import { isVideoTimed, videoLabel } from '@/domain/video'
import { bboxRegion, isImageCitation } from '@/domain/media'
import { citationAlias } from '@/domain/sources'
import type { Citation } from '@/domain/types'
import { useSources } from '@/features/sources/SourcesContext'
import type { MatchQuality } from './highlight/types'
import styles from './TraceBar.module.css'

const LABEL: Record<MatchQuality, string> = {
  exact: 'exacto', anchored: 'anclado', snippet: 'fragmento', rects: 'coordenadas', bbox: 'región', time: 'tiempo', 'page-only': 'solo página',
}

const where = (c: Citation) =>
  c.page == null ? null : c.page_end != null && c.page_end !== c.page ? `pág. ${c.page}–${c.page_end}` : `pág. ${c.page}`

const head = (c: Citation) => c.origin === 'studio' ? 'estudio' : c.origin === 'inspector' ? 'inspector' : c.origin === 'xray' ? (c.n > 0 ? `rayos x · [${c.n}]` : 'rayos x') : c.origin === 'search' || c.n <= 0 ? 'búsqueda' : `[${c.n}]`

const pageOnlyNote = (c: Citation) =>
  isVideoTimed(c) || isAudioCitation(c) ? 'cita sin tiempo: no hay a dónde saltar' : isImageCitation(c) ? 'imagen sin región: mostrando página' : c.content == null && !c.origin ? 'cita antigua: sin texto del fragmento' : (c.origin === 'studio' || c.origin === 'xray') && c.content == null ? 'salto a la página' : 'fragmento no localizado, mostrando página'

/** Lab-style readout of the trace: `[1] · pág. 3 · chunk 3ef4` + how well the chunk was located. */
export function TraceBar({ citation, quality }: { citation: Citation; quality: MatchQuality | null }) {
  const section = shortSection(citation.section, 56)
  const alias = citationAlias(useSources(), citation)
  const label = [head(citation), alias, isImageCitation(citation) ? ['imagen', where(citation), bboxRegion(citation.bbox)].filter(Boolean).join(' · ') : isVideoTimed(citation) ? videoLabel(citation) : isAudioCitation(citation) ? audioLabel(citation) : where(citation), section && `§${section}`, citation.chunk_id && `chunk ${citation.chunk_id.slice(0, 4)}`].filter(Boolean).join(' · ')
  const note = quality === 'page-only' ? pageOnlyNote(citation) : null
  return (
    <p className={styles.bar} role="status" title={[label, note].filter(Boolean).join(' — ')}>
      <span className={styles.label}>{label}</span>
      <span className={styles.q} data-quality={quality ?? 'pending'}>{quality ? LABEL[quality] : 'localizando…'}</span>
      {note && <span className={styles.note}>{note}</span>}
    </p>
  )
}
