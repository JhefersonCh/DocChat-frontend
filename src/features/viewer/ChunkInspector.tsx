import { useQuery } from '@tanstack/react-query'
import { listChunks } from '@/api/documents'
import { keys } from '@/api/queryKeys'
import { shortSection } from '@/domain/citations'
import { boundary, chunkToCitation, groupByPage } from '@/domain/inspector'
import { isImageSegment, segmentTag, thumbId } from '@/domain/media'
import { formatRange } from '@/domain/time'
import { PlayRange } from '@/features/audio/PlayRange'
import { FrameThumb } from '@/features/video/FrameThumb'
import type { ChunkInfo, Document as Doc } from '@/domain/types'
import { Thumb } from '@/ui/Thumb'
import { useTrace } from '@/features/conversation/TraceContext'
import styles from './ChunkInspector.module.css'

const span = (c: ChunkInfo) =>
  c.t_start != null ? formatRange(c.t_start, c.t_end) : c.page_start == null ? 'sin página' : c.page_end != null && c.page_end !== c.page_start ? `p. ${c.page_start}–${c.page_end}` : `p. ${c.page_start}`

/** Video: two timelines in one list, the keyframes and the windows of its audio track. */
interface Group { page: number | null; title?: string; chunks: ChunkInfo[] }

function byModality(items: ChunkInfo[]): Group[] {
  const frames = items.filter((c) => c.modality === 'frame')
  const rest = items.filter((c) => c.modality !== 'frame')
  return [
    { page: null, title: `Fotogramas (${frames.length})`, chunks: frames },
    { page: null, title: `Ventanas de audio (${rest.length})`, chunks: rest },
  ].filter((g) => g.chunks.length > 0)
}

const nf = { format: (n: number) => String(n) }

/** Debug view: how the document was chunked, per page. A row jumps to the chunk and highlights it in the viewer. */
export function ChunkInspector({ doc }: { doc: Doc }) {
  const { activeCitation, onCiteSelect } = useTrace()
  const chunks = useQuery({ queryKey: keys.documentChunks(doc.id), queryFn: () => listChunks(doc.id), staleTime: 60_000, retry: false })
  const items = chunks.data ?? []
  return (
    <aside className={styles.root} aria-label="Inspector de fragmentos">
      <p className={styles.head}>
        {chunks.isPending ? 'Leyendo fragmentos…' : chunks.isError ? 'No se pudieron leer los fragmentos.' : `${items.length} chunks · ${nf.format(items.reduce((s, c) => s + c.chars, 0))} car.`}
      </p>
      <div className={styles.scroll}>
        {((doc.kind === 'audio' ? [{ page: null, chunks: items }] : doc.kind === 'video' ? byModality(items) : groupByPage(items)) as Group[]).map((g) => (
          <section key={g.title ?? g.page ?? 'none'} className={styles.group}>
            <h3 className={styles.page}>{doc.kind === 'audio' ? 'Ventanas de audio' : g.title ?? (g.page == null ? 'Sin página' : `Página ${g.page}`)}</h3>
            <ul className={styles.list}>
              {g.chunks.map((c) => {
                const section = shortSection(c.section, 36)
                const { head, tail } = boundary(c.content)
                const tag = segmentTag(c)
                const thumb = isImageSegment(c) ? thumbId(c) : null
                const active = !!c.chunk_id && activeCitation?.chunk_id === c.chunk_id
                const play = c.t_start != null && c.t_end != null && c.t_end > c.t_start ? { start: c.t_start, end: c.t_end } : null
                return (
                  <li key={c.ordinal} className={styles.item}>
                    <button
                      type="button" className={`${styles.row} ${active ? styles.active : ''}`} aria-pressed={active}
                      onClick={(e) => onCiteSelect(chunkToCitation(c, doc), { origin: e.currentTarget })}
                    >
                      {thumb && (c.modality === 'frame' && c.t_start != null
                        ? <FrameThumb chunkId={thumb} docId={doc.id} start={c.t_start} end={c.t_end} alt={`Fotograma ${formatRange(c.t_start)}`} className={`${styles.thumb} ${styles.frame}`} />
                        : <Thumb chunkId={thumb} alt={`Segmento ${c.ordinal}`} width={56} className={styles.thumb} />)}
                      <span className={styles.meta}>
                        {tag && <b className={styles.tag} data-modality={c.modality}>{tag}</b>}
                        #{c.ordinal} · {span(c)}{section && ` · §${section}`} · {nf.format(c.chars)} car.
                        {tag && c.text_status && c.text_status !== 'ready' && <i className={styles.nodesc}> · {c.modality === 'audio' ? 'sin transcripción' : 'sin descripción'}</i>}
                      </span>
                      <span className={styles.text}>{head || (tag ? (c.modality === 'audio' ? 'Sin transcripción.' : 'Sin descripción de texto.') : '')}</span>
                      {tail && <span className={styles.text}>{tail}</span>}
                    </button>
                    {play && (c.modality === 'audio' || c.modality === 'frame') && <PlayRange docId={doc.id} start={play.start} end={play.end} className={styles.play} />}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  )
}
