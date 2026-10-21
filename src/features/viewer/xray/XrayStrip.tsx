import { useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listChunks } from '@/api/documents'
import { keys } from '@/api/queryKeys'
import { chunkToCitation } from '@/domain/inspector'
import type { Citation, Document as Doc, Found } from '@/domain/types'
import { isImageSegment } from '@/domain/media'
import { bboxSpan, laneCount, layoutTicks, ordinalSpan, pageSpan, tickLabel, type Tick } from '@/domain/xray'
import { useTrace } from '@/features/conversation/TraceContext'
import { useXray, useXrayActions } from './XrayContext'
import { useScrollMap } from './useScrollMap'
import styles from './xray.module.css'

const SWEEP_MS = 700 // one pass of the scan over the whole strip
const SEARCH_GAP_MS = 900 // replay: start of each search after the previous one

interface Props { doc: Doc; scroller: HTMLElement | null }

/**
 * Retrieval X-ray: a minimap of the whole document with the viewport on it and, for the active answer,
 * one tick per retrieved chunk (lane = search, intensity = relevance, outline = cited, dashed = panorama).
 * Live ticks light as each `search` event arrives and the cited ones lock in; a persisted answer replays.
 */
export function XrayStrip({ doc, scroller }: Props) {
  const { source, replay } = useXray()
  const { show } = useXrayActions()
  const { onCiteSelect } = useTrace()
  const map = useScrollMap(scroller)
  const [tip, setTip] = useState<Tick | null>(null)
  const [legend, setLegend] = useState(false)
  const legendId = useId()
  const wanted = !!source?.searches.some((s) => s.found?.length)
  const chunks = useQuery({ queryKey: keys.documentChunks(doc.id), queryFn: () => listChunks(doc.id), staleTime: 60_000, retry: false, enabled: wanted })

  const index = useMemo(() => new Map((chunks.data ?? []).map((c, i) => [c.chunk_id, i])), [chunks.data])
  const byId = useMemo(() => new Map((chunks.data ?? []).map((c) => [c.chunk_id, c])), [chunks.data])
  const total = chunks.data?.length ?? 0
  const searches = source?.searches
  const cited = source?.cited
  const ticks = useMemo(() => {
    if (!searches) return []
    const place = (f: Found) => {
      if (f.document_id && f.document_id !== doc.id) return null // a hit of another source
      const byPage = f.page_start != null && map.bands.length ? pageSpan(map.bands, f.page_start, f.page_end) : null
      const ordinal = index.get(f.chunk_id)
      const chunk = byId.get(f.chunk_id)
      const image = f.kind === 'image' || (chunk != null && isImageSegment(chunk))
      const single = f.page_end == null || f.page_end === f.page_start
      if (byPage && image && single) return bboxSpan(byPage, f.bbox ?? chunk?.bbox)
      return byPage ?? (ordinal == null ? null : ordinalSpan(ordinal, total))
    }
    // `found` may not say the kind (older backend): the chunk list does.
    return layoutTicks(searches, place, new Set(cited)).map((t) => (t.media || !isImageSegment(byId.get(t.hit.chunk_id) ?? {}) ? t : { ...t, media: true }))
  }, [searches, cited, map.bands, index, byId, total, doc.id])

  const lanes = laneCount(searches ?? [])
  const staged = !!source && !source.live
  const lockDelay = staged && searches ? searches.length * SEARCH_GAP_MS + 200 : 0

  const open = (t: Tick) => {
    const { hit } = t
    const known = source?.citations.find((c) => c.n === hit.n)
    const chunk = chunks.data?.find((c) => c.chunk_id === hit.chunk_id)
    const base: Citation = known ?? (chunk ? chunkToCitation(chunk, doc) : {
      n: hit.n, document_id: doc.id, filename: doc.filename, page: hit.page_start, page_end: hit.page_end, snippet: '',
      chunk_id: hit.chunk_id, content: null, section: hit.section, score: hit.score,
      ...(hit.kind && hit.kind !== 'text' ? { kind: hit.kind, bbox: hit.bbox ?? null, has_thumb: hit.has_thumb } : {}),
    })
    onCiteSelect({ ...base, n: hit.n, origin: 'xray' }, {})
  }

  const seek = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scroller || (e.type === 'pointermove' && e.buttons !== 1)) return
    const box = e.currentTarget.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (e.clientY - box.top) / box.height))
    scroller.scrollTo({ top: frac * scroller.scrollHeight - scroller.clientHeight / 2 })
  }

  return (
    <div className={styles.wrap} style={{ ['--lanes' as string]: lanes }}>
      <div
        className={styles.strip} role="group" aria-label="Rayos X: dónde buscó el modelo"
        onPointerDown={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.track) { e.currentTarget.setPointerCapture(e.pointerId); seek(e) } }}
        onPointerMove={seek}
      >
        <div className={styles.track} data-track="1" aria-hidden="true">
          {map.bands.length > 0 && map.bands.length <= 400 && map.bands.map((b, i) => (
            <span key={i} className={styles.page} data-track="1" style={{ top: `${b.top * 100}%`, height: `${b.height * 100}%` }} />
          ))}
        </div>
        <div key={replay} className={styles.ticks}>
          {searches?.map((s, i) => s.found?.length ? (
            <span key={`sweep-${i}`} className={styles.sweep} aria-hidden="true" style={{ ['--base' as string]: `${staged ? i * SEARCH_GAP_MS : 0}ms`, ['--sweep' as string]: `${SWEEP_MS}ms` }} />
          ) : null)}
          {ticks.map((t) => (
            <button
              key={t.key} type="button" className={styles.tick}
              data-cited={t.cited} data-media={t.media} data-locked={source?.locked} data-panorama={t.panorama}
              style={{
                top: `${t.y * 100}%`, height: `max(${t.h * 100}%, ${t.media ? 6 : 3}px)`, ['--lane' as string]: t.lane, ['--heat' as string]: t.heat,
                ['--delay' as string]: `${(staged ? t.search * SEARCH_GAP_MS : 0) + t.y * SWEEP_MS}ms`, ['--lock' as string]: `${lockDelay}ms`,
              }}
              aria-label={tickLabel(t, searches?.[t.search]?.query ?? '').join(', ')}
              onClick={() => open(t)}
              onPointerEnter={() => setTip(t)} onPointerLeave={() => setTip(null)}
              onFocus={() => setTip(t)} onBlur={() => setTip(null)}
            />
          ))}
        </div>
        <div className={styles.view} style={{ top: `${map.view.y * 100}%`, height: `${map.view.h * 100}%` }} aria-hidden="true" />
        {tip && (
          <div className={styles.tip} role="tooltip" style={{ top: `${(tip.y + tip.h / 2) * 100}%` }}>
            {tickLabel(tip, searches?.[tip.search]?.query ?? '').map((l, i) => <span key={i}>{l}</span>)}
          </div>
        )}
      </div>
      <button type="button" className={styles.help} aria-expanded={legend} aria-controls={legendId} aria-label="Leyenda de los rayos X" onClick={() => setLegend((v) => !v)}>?</button>
      {legend && (
        <div id={legendId} className={styles.legend}>
          <p className={styles.legendTitle}>Rayos X</p>
          <ul>
            <li><i className={styles.swHeat} /> intensidad = relevancia</li>
            <li><i className={styles.swCited} /> citada en la respuesta</li>
            <li><i className={styles.swPano} /> panorama (cobertura)</li>
            <li><i className={styles.swImage} /> imagen (rayado)</li>
            <li><i className={styles.swView} /> lo que estás viendo</li>
          </ul>
          {searches && searches.length > 0 && (
            <ol className={styles.queries}>
              {searches.map((s, i) => <li key={i}><b>#{i + 1}</b> {s.panorama ? 'panorama' : s.query}</li>)}
            </ol>
          )}
          {!wanted && <p className={styles.legendNote}>Hacé una pregunta o repetí una respuesta con «Rayos X».</p>}
          {source && wanted && <button type="button" className={styles.again} onClick={() => show(source)}>Repetir barrido</button>}
        </div>
      )}
    </div>
  )
}
