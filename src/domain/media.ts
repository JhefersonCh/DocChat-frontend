// Pure helpers for image segments: labels, regions, thumbnails, descriptions-stage state.
import type { BBox, ChunkInfo, Citation, Document, EnrichStatus, SegmentOrigin } from './types'

type Boxed = { bbox?: BBox | null }

/** A usable bbox: 4 finite numbers, clamped to 0..1, non-empty. Anything else -> null (page-only). */
export function cleanBBox(b: readonly number[] | null | undefined): BBox | null {
  if (!b || b.length !== 4 || !b.every(Number.isFinite)) return null
  const [x0, y0, x1, y1] = b.map((v) => Math.min(1, Math.max(0, v))) as BBox
  return x1 - x0 > 0.001 && y1 - y0 > 0.001 ? [x0, y0, x1, y1] : null
}

/** Human region of a normalized bbox: "zona superior izquierda"; null when it covers (almost) all of it. */
export function bboxRegion(bbox: BBox | null | undefined): string | null {
  const b = cleanBBox(bbox)
  if (!b) return null
  const [x0, y0, x1, y1] = b
  if ((x1 - x0) * (y1 - y0) >= 0.8) return null
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  const v = cy < 1 / 3 ? 'superior' : cy > 2 / 3 ? 'inferior' : 'central'
  const h = cx < 1 / 3 ? 'izquierda' : cx > 2 / 3 ? 'derecha' : ''
  if (!h) return `zona ${v}`
  return v === 'central' ? `zona ${h}` : `zona ${v} ${h}`
}

export const isImageCitation = (c: { kind?: string }) => c.kind === 'image'

/** Chunk id whose thumbnail exists (`has_thumb`), else null: never request an image that 404s. */
export const thumbId = (c: { chunk_id?: string | null; has_thumb?: boolean }) => (c.has_thumb && c.chunk_id ? c.chunk_id : null)

const pageOf = (c: { page?: number | null; page_end?: number | null }) =>
  c.page == null ? null : c.page_end != null && c.page_end !== c.page ? `pág. ${c.page}–${c.page_end}` : `pág. ${c.page}`

/** "Imagen · pág. 3 · zona superior" (standalone images have no page); a region segment shows
 * what it is instead of the zone: "Imagen · pág. 3 · colibrí". */
export function imageLabel(
  c: Boxed & { page?: number | null; page_end?: number | null; region_label?: string | null },
): string {
  return ['Imagen', pageOf(c), c.region_label || bboxRegion(c.bbox)].filter(Boolean).join(' · ')
}

export const ORIGIN_LABEL: Record<SegmentOrigin, string> = {
  embedded_image: 'imagen', figure: 'figura', page: 'página escaneada', tile: 'zona', region: 'región', whole_image: 'imagen',
  window: 'ventana', frame: 'fotograma',
}

/** Inspector row tag: "figura", "zona"... null for plain text chunks. */
export function segmentTag(c: Pick<ChunkInfo, 'modality' | 'origin'>): string | null {
  if (!c.modality || c.modality === 'text') return null
  return (c.origin && ORIGIN_LABEL[c.origin]) || (c.modality === 'audio' ? 'audio' : c.modality === 'frame' ? 'fotograma' : 'imagen')
}

/** Image-like segments (pictures and video frames) are shown as thumbnails; audio has its own player. */
export const isImageSegment = (c: Pick<ChunkInfo, 'modality'>) => c.modality === 'image' || c.modality === 'frame'

/** Normalized bbox as a page fraction rect (what the overlays position with). */
export function bboxToRect(bbox: BBox): { x: number; y: number; w: number; h: number } | null {
  const b = cleanBBox(bbox)
  return b ? { x: b[0], y: b[1], w: b[2] - b[0], h: b[3] - b[1] } : null
}

/**
 * Scroll offset that frames a box on its page: the top lands at 30 % of the viewport (like the text trace),
 * unless the box is too tall for that: then its centre goes to the middle.
 */
export function boxScrollTop(pageTop: number, pageH: number, r: { y: number; h: number }, viewH: number): number {
  const boxH = r.h * pageH
  if (boxH > viewH * 0.6) return pageTop + (r.y + r.h / 2) * pageH - viewH / 2
  return pageTop + r.y * pageH - viewH * 0.3
}

/** Citation made from a media chunk row (inspector / x-ray). */
export const chunkMedia = (c: ChunkInfo, doc: Pick<Document, 'kind'>): Partial<Citation> =>
  c.modality === 'frame'
    ? { kind: 'video', t_start: c.t_start ?? null, t_end: c.t_end ?? null, has_thumb: c.has_thumb, source_kind: doc.kind ?? null }
    : isImageSegment(c)
    ? { kind: 'image', bbox: c.bbox ?? null, has_thumb: c.has_thumb, source_kind: doc.kind ?? null }
    : c.modality === 'audio'
      ? { kind: 'audio', t_start: c.t_start ?? null, t_end: c.t_end ?? null, source_kind: doc.kind ?? null }
      : {}

/**
 * Where the trace thread should land for an image box, in viewport px: the right edge of the box (the thread
 * arrives from the chat column) at the height the page jump will leave it (see `boxScrollTop`).
 */
export function boxLanding(page: { left: number; width: number }, pageH: number, bbox: BBox, view: { top: number; height: number }): { x: number; y: number } | null {
  const r = bboxToRect(bbox)
  if (!r) return null
  const boxH = r.h * pageH
  const y = boxH > view.height * 0.6 ? view.top + view.height / 2 : view.top + view.height * 0.3 + boxH / 2
  return { x: page.left + (r.x + r.w) * page.width, y }
}

// ---- descriptions stage (enrich) -------------------------------------------------------------

export type EnrichTone = 'busy' | 'ok' | 'warn' | 'bad' | 'muted'

export interface EnrichInfo {
  tone: EnrichTone
  /** Short badge text. */
  label: string
  /** Extra line (progress / error). */
  detail: string | null
  /** 0..1 while running with a known total. */
  fraction: number | null
  canRetry: boolean
  /** Offer the link to the providers screen (no vision / speech-to-text profile). */
  needsProfile: boolean
  /** What the stage is about: names the strip and the retry button. */
  area: 'images' | 'audio' | 'video'
}

export const isEnriching = (s: EnrichStatus | undefined) => s === 'pending' || s === 'running'

/**
 * State of the descriptions stage for the IngestPanel / viewer strip; null when there is nothing to say
 * (documents without images: `skipped` on a pdf/text is the normal case).
 */
export function enrichInfo(doc: Pick<Document, 'kind' | 'enrich_status' | 'enrich_error' | 'stage' | 'progress'>): EnrichInfo | null {
  const s = doc.enrich_status
  if (!s) return null
  const audio = doc.kind === 'audio'
  const video = doc.kind === 'video'
  const media = doc.kind != null && doc.kind !== 'pdf' && doc.kind !== 'text'
  const err = doc.enrich_error?.trim() || null
  const area = audio ? 'audio' : video ? 'video' : 'images'
  const base = { area, canRetry: false, needsProfile: false, detail: null, fraction: null } as const
  if (isEnriching(s)) {
    const p = doc.progress
    const known = s === 'running' && (doc.stage === 'describing' || doc.stage === 'transcribing') && p != null && p.total > 0
    // A video runs two stages back to back: frame captions, then its audio track.
    const noun = audio || (video && doc.stage === 'transcribing') ? 'Transcribiendo audio' : video ? 'Describiendo fotogramas' : 'Describiendo imágenes'
    const queued = audio ? 'Transcripción en cola' : video ? 'Descripción en cola' : 'Descripciones en cola'
    return {
      ...base,
      tone: 'busy',
      label: known ? `${noun} ${p.done}/${p.total}` : s === 'pending' ? queued : noun,
      fraction: known ? Math.min(1, p.done / p.total) : null,
    }
  }
  // The backend opens a video's error with the state of each part ("Audio listo · fotogramas fallidos. 1 de 1 ...").
  const parts = video && (s === 'partial' || s === 'failed') ? err?.match(/^((?:Audio|Fotogramas)[^.]*)(?:\.\s*(.*))?$/s) : null
  if (parts) return { ...base, tone: s === 'failed' ? 'bad' : 'warn', label: parts[1], detail: parts[2]?.trim() || null, canRetry: true }
  const what = audio ? 'Transcripción' : video ? 'Fotogramas y audio' : 'Descripciones'
  const ready = audio ? 'lista' : video ? 'listos' : 'listas'
  if (s === 'ready') return { ...base, tone: 'ok', label: `${what} ${ready}` }
  if (s === 'partial') return { ...base, tone: 'warn', label: `${what} ${audio ? 'parcial' : 'parciales'}`, detail: err, canRetry: true }
  if (s === 'failed') return { ...base, tone: 'bad', label: `${what} ${audio ? 'fallida' : video ? 'fallidos' : 'fallidas'}`, detail: err, canRetry: true }
  // skipped
  if (!media) return null
  return audio
    ? { ...base, tone: 'muted', label: 'Sin perfil de voz a texto', detail: 'Se indexó solo por similitud de audio: no hay transcripción de texto.', needsProfile: true }
    : { ...base, tone: 'muted', label: 'Sin perfil de visión', detail: video ? 'Se indexó solo por similitud visual: no hay descripciones de los fotogramas.' : 'Se indexó solo por similitud visual: no hay descripciones de texto.', needsProfile: true }
}
