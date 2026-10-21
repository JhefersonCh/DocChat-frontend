import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchDocument } from '@/api/documents'
import { keys } from '@/api/queryKeys'
import { displaySnippet, relevanceLabel, shortSection } from '@/domain/citations'
import { hitToCitation } from '@/domain/search'
import { audioLabel } from '@/domain/audio'
import { imageLabel, thumbId } from '@/domain/media'
import type { Document as Doc, SearchHit } from '@/domain/types'
import { FrameThumb } from '@/features/video/FrameThumb'
import { videoLabel } from '@/domain/video'
import { Thumb } from '@/ui/Thumb'
import { useTrace } from '@/features/conversation/TraceContext'
import styles from './DocumentSearch.module.css'

const where = (h: SearchHit) =>
  h.kind === 'video' ? videoLabel(h) :
  h.kind === 'audio' ? audioLabel(h) :
  h.kind === 'image' ? imageLabel({ page: h.page_start, page_end: h.page_end, bbox: h.bbox }) :
  h.page_start == null ? null : h.page_end != null && h.page_end !== h.page_start ? `p. ${h.page_start}–${h.page_end}` : `p. ${h.page_start}`

/** Search box of the viewer header: hybrid search without the LLM; a hit jumps to its page and highlights it. */
export function DocumentSearch({ doc }: { doc: Doc }) {
  const { onCiteSelect } = useTrace()
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const listId = useId()
  const search = useQuery({
    queryKey: keys.documentSearch(doc.id, query),
    queryFn: ({ signal }) => searchDocument(doc.id, query, 10, signal),
    enabled: query !== '',
    staleTime: 60_000,
    retry: false,
  })

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = draft.trim()
    if (q) { setQuery(q); setOpen(true) }
  }
  const hits = search.data?.hits ?? []
  const status = search.isFetching ? 'Buscando…' : search.isError ? 'No se pudo buscar.' : hits.length === 0 ? 'Sin resultados.' : null

  return (
    <div ref={root} className={styles.root} onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false) } }}>
      <form role="search" className={styles.form} onSubmit={submit}>
        <input
          type="search" className={styles.input} value={draft} placeholder="Buscar en el documento"
          aria-label="Buscar en el documento" aria-controls={listId} aria-expanded={open}
          onChange={(e) => setDraft(e.target.value)} onFocus={() => { if (query) setOpen(true) }}
        />
      </form>
      {open && query && (
        <div id={listId} className={styles.panel} role="region" aria-label="Resultados de la búsqueda">
          {status && <p className={styles.status} role="status">{status}</p>}
          {!search.isFetching && hits.length > 0 && (
            <ul className={styles.list}>
              {hits.map((h, i) => {
                const meta = [where(h), shortSection(h.section, 40) && `§${shortSection(h.section, 40)}`, relevanceLabel(h.score)].filter(Boolean).join(' · ')
                const thumb = h.kind === 'image' || h.kind === 'video' ? thumbId(h) : null
                return (
                  <li key={h.chunk_id ?? i}>
                    <button
                      type="button" className={styles.hit} data-thumb={thumb ? 'true' : undefined}
                      onClick={(e) => { onCiteSelect(hitToCitation(h, doc), { origin: e.currentTarget }); setOpen(false) }}
                    >
                      {thumb && (h.kind === 'video' && h.t_start != null
                        ? <FrameThumb chunkId={thumb} docId={doc.id} start={h.t_start} end={h.t_end} alt={videoLabel(h)} className={`${styles.thumb} ${styles.frame}`} />
                        : <Thumb chunkId={thumb} alt={imageLabel({ page: h.page_start, bbox: h.bbox })} width={64} className={styles.thumb} />)}
                      <span className={styles.snippet}>{displaySnippet(h.snippet) || (h.kind === 'image' || h.kind === 'video' ? 'Sin descripción de texto.' : '')}</span>
                      {meta && <span className={styles.meta}>{meta}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
