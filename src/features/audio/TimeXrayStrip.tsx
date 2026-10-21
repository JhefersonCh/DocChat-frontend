import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listChunks } from '@/api/documents'
import { keys } from '@/api/queryKeys'
import { chunkToCitation } from '@/domain/inspector'
import type { Citation, Document as Doc, Found } from '@/domain/types'
import { laneCount, layoutTicks, tickLabel, type Span, type Tick } from '@/domain/xray'
import { useTrace } from '@/features/conversation/TraceContext'
import { useXray } from '@/features/viewer/xray/XrayContext'
import { useWaveform } from './useWaveform'
import styles from './TimeXrayStrip.module.css'

const SWEEP_MS = 700
const SEARCH_GAP_MS = 900

/**
 * Retrieval X-ray for audio and video: the same ticks as the page strip, on a time axis (left = 00:00, right = end), so it
 * lines up with the waveform above it. One lane per search, heat = relevance, outline = cited, dashed = panorama;
 * while streaming a sweep crosses the strip and ticks light as each search lands.
 */
export function TimeXrayStrip({ doc }: { doc: Doc }) {
  const { source, replay } = useXray()
  const { onCiteSelect } = useTrace()
  const wave = useWaveform(doc.id)
  const [tip, setTip] = useState<Tick | null>(null)
  const searches = source?.searches
  const wanted = !!searches?.some((s) => s.found?.length)
  const chunks = useQuery({ queryKey: keys.documentChunks(doc.id), queryFn: () => listChunks(doc.id), staleTime: 60_000, retry: false, enabled: wanted })
  const byId = useMemo(() => new Map((chunks.data ?? []).map((c) => [c.chunk_id, c])), [chunks.data])
  const lastEnd = Math.max(0, ...(chunks.data ?? []).map((c) => c.t_end ?? c.t_start ?? 0))
  const duration = doc.duration_s ?? wave.duration ?? (lastEnd > 0 ? lastEnd : null)

  const cited = source?.cited
  const ticks = useMemo(() => {
    if (!searches || !duration) return []
    const place = (f: Found): Span | null => {
      if (f.document_id && f.document_id !== doc.id) return null // a hit of another source
      const c = byId.get(f.chunk_id)
      const a = f.t_start ?? c?.t_start
      if (a == null) return null
      const b = f.t_end ?? c?.t_end ?? a
      return { y: Math.min(1, a / duration), h: Math.max(0, Math.min(1, b / duration) - Math.min(1, a / duration)) }
    }
    // Speech ticks are solid; a frame of a video (`hit.kind === 'video'`) is drawn hatched, so the two read apart.
    return layoutTicks(searches, place, new Set(cited)).map((t) => ({ ...t, media: t.hit.kind === 'video' }))
  }, [searches, cited, duration, byId, doc.id])

  const lanes = laneCount(searches ?? [])
  const staged = !!source && !source.live
  const lockDelay = staged && searches ? searches.length * SEARCH_GAP_MS + 200 : 0

  const open = (t: Tick) => {
    const { hit } = t
    const chunk = byId.get(hit.chunk_id)
    const known = source?.citations.find((c) => c.n === hit.n)
    const base: Citation = known ?? (chunk ? chunkToCitation(chunk, doc) : {
      n: hit.n, document_id: doc.id, filename: doc.filename, page: null, page_end: null, snippet: '', chunk_id: hit.chunk_id,
      content: null, section: hit.section, score: hit.score,
    })
    onCiteSelect({ ...base, n: hit.n, origin: 'xray', kind: hit.kind === 'video' ? 'video' : 'audio', source_kind: doc.kind ?? null, t_start: base.t_start ?? hit.t_start ?? chunk?.t_start ?? null, t_end: base.t_end ?? hit.t_end ?? chunk?.t_end ?? null }, {})
  }

  if (!wanted && !source) return null
  return (
    <div className={styles.wrap} style={{ ['--lanes' as string]: lanes }}>
      <div className={styles.strip} role="group" aria-label="Rayos X: en qué momentos buscó el modelo">
        <div key={replay} className={styles.ticks}>
          {searches?.map((s, i) => s.found?.length ? (
            <span key={`sweep-${i}`} className={styles.sweep} aria-hidden="true" style={{ ['--base' as string]: `${staged ? i * SEARCH_GAP_MS : 0}ms`, ['--sweep' as string]: `${SWEEP_MS}ms` }} />
          ) : null)}
          {ticks.map((t) => (
            <button
              key={t.key} type="button" className={styles.tick}
              data-cited={t.cited} data-locked={source?.locked} data-panorama={t.panorama} data-media={t.media}
              style={{
                left: `${t.y * 100}%`, width: `max(${t.h * 100}%, 4px)`, ['--lane' as string]: t.lane, ['--heat' as string]: t.heat,
                ['--delay' as string]: `${(staged ? t.search * SEARCH_GAP_MS : 0) + t.y * SWEEP_MS}ms`, ['--lock' as string]: `${lockDelay}ms`,
              }}
              aria-label={tickLabel(t, searches?.[t.search]?.query ?? '').join(', ')}
              onClick={() => open(t)}
              onPointerEnter={() => setTip(t)} onPointerLeave={() => setTip(null)}
              onFocus={() => setTip(t)} onBlur={() => setTip(null)}
            />
          ))}
        </div>
        {tip && (
          <div className={styles.tip} role="tooltip" data-flip={tip.y > 0.6} style={{ left: `${(tip.y + tip.h / 2) * 100}%` }}>
            {tickLabel(tip, searches?.[tip.search]?.query ?? '').map((l, i) => <span key={i}>{l}</span>)}
          </div>
        )}
      </div>
      <p className={styles.caption}>Rayos X{doc.kind === 'video' && ' · fotogramas rayados, voz sólida'}{!wanted && ' · hacé una pregunta y mirá en qué momentos busca'}</p>
    </div>
  )
}
