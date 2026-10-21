// Pure helpers for upload + ingest polling (plan §7.1).
import type { Document, DocumentStatus, IngestProgress, IngestStage } from './types'

export const POLL_MS = 1500
export const SLOW_AFTER_MS = 5 * 60 * 1000
const SLOW_POLL_MS = 5000

export function isInFlight(status: DocumentStatus | undefined): boolean {
  return status === 'pending' || status === 'processing'
}

/** Needs polling: ingesting, or a ready document whose summary / image descriptions are still being generated. */
export function isDocBusy(d: Pick<Document, 'status' | 'summary_status' | 'enrich_status'> | null | undefined): boolean {
  return !!d && (isInFlight(d.status) || (d.status === 'ready' && (d.summary_status === 'pending' || d.enrich_status === 'pending' || d.enrich_status === 'running')))
}

/** In-flight -> terminal: the moment the chat and the chat list must be refreshed (once). */
export function finishedIngest(prev: DocumentStatus | undefined, next: DocumentStatus | undefined): boolean {
  return isInFlight(prev) && next !== undefined && !isInFlight(next)
}

/** Query `refetchInterval` value: stops on ready/failed, backs off after the 5 min cap. */
export function pollInterval(status: DocumentStatus | undefined, elapsedMs: number): number | false {
  if (!isInFlight(status)) return false
  return elapsedMs >= SLOW_AFTER_MS ? SLOW_POLL_MS : POLL_MS
}

const MD_TYPES = new Set(['text/markdown', 'text/x-markdown', 'text/plain'])
export const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
export const AUDIO_EXT = ['.mp3', '.wav', '.m4a', '.ogg', '.oga', '.opus', '.webm', '.flac']
export const VIDEO_EXT = ['.mp4', '.m4v', '.mov', '.mkv', '.webm']
const ALLOWED_EXT = ['.pdf', '.txt', '.md', ...IMAGE_EXT, ...AUDIO_EXT, ...VIDEO_EXT]
/** `accept` of the file input and the dropzone legend. */
export const ACCEPT_ATTR = `.pdf,.txt,.md,${[...IMAGE_EXT, ...AUDIO_EXT, ...VIDEO_EXT.filter((e) => e !== '.webm')].join(',')},application/pdf,text/plain,text/markdown,image/jpeg,image/png,image/webp,image/gif,audio/*,video/*`
export const ACCEPT_LEGEND = '.pdf · .txt · .md · .jpg · .png · .webp · .gif · .mp3 · .wav · .m4a · .ogg · .opus · .webm · .flac · .mp4 · .mov · .mkv'

const IMAGE_TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' }

const AUDIO_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.oga': 'audio/ogg',
  '.opus': 'audio/ogg', '.webm': 'audio/webm', '.flac': 'audio/flac',
}

const VIDEO_TYPES: Record<string, string> = { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska', '.webm': 'video/webm' }

export type PreparedUpload = { ok: true; file: File } | { ok: false; code: 'unsupported_file_type' }

/** Validates the extension and fixes `.md` files the browser sent with an empty/odd MIME. */
export function prepareUpload(file: File): PreparedUpload {
  const name = file.name.toLowerCase()
  const ext = ALLOWED_EXT.find((e) => name.endsWith(e))
  if (!ext) return { ok: false, code: 'unsupported_file_type' }
  if (ext === '.md' && !MD_TYPES.has(file.type)) {
    return { ok: true, file: new File([file], file.name, { type: 'text/markdown' }) }
  }
  if (IMAGE_EXT.includes(ext) && !file.type.startsWith('image/')) {
    return { ok: true, file: new File([file], file.name, { type: IMAGE_TYPES[ext] }) }
  }
  // .webm is both: the MIME the browser reports decides (the dropzone probes the picked file for a video track).
  if (ext === '.webm') return { ok: true, file: file.type === 'audio/webm' || file.type === 'video/webm' ? file : retyped(file, VIDEO_TYPES[ext]) }
  if (VIDEO_EXT.includes(ext) && !file.type.startsWith('video/')) return { ok: true, file: retyped(file, VIDEO_TYPES[ext]) }
  // Browsers report .m4a / .opus audio as video/*, application/octet-stream or nothing: the backend sniffs by MIME.
  if (AUDIO_EXT.includes(ext) && !file.type.startsWith('audio/')) {
    return { ok: true, file: new File([file], file.name, { type: AUDIO_TYPES[ext] }) }
  }
  return { ok: true, file }
}

const retyped = (file: File, type: string) => new File([file], file.name, { type })

/** A `.webm` without a video track is an audio recording: the backend tells them apart by this MIME type. */
export const asAudioWebm = (file: File) => retyped(file, 'audio/webm')
export const isWebm = (file: File) => file.name.toLowerCase().endsWith('.webm')

export const isImageFile = (file: File) => IMAGE_EXT.some((e) => file.name.toLowerCase().endsWith(e))
export const isVideoFile = (file: File) => file.type.startsWith('video/') || VIDEO_EXT.some((e) => e !== '.webm' && file.name.toLowerCase().endsWith(e))
export const isAudioFile = (file: File) => file.type.startsWith('audio/') || (!isVideoFile(file) && AUDIO_EXT.some((e) => file.name.toLowerCase().endsWith(e)))

const STAGE_VERB: Record<IngestStage, string> = {
  extracting: 'Extrayendo', embedding: 'Indexando', describing: 'Describiendo imágenes', transcribing: 'Transcribiendo audio',
}

/** "Indexando 120/680" / "Describiendo imágenes 3/12" + bar fraction; null until the backend knows the total. */
export function progressInfo(p: IngestProgress | null | undefined, stage?: IngestStage | null, kind?: Document['kind']): { label: string; fraction: number } | null {
  if (!p || p.total <= 0) return null
  const verb = stage === 'describing' && kind === 'video' ? 'Describiendo fotogramas' : STAGE_VERB[stage ?? 'embedding']
  return { label: `${verb} ${p.done}/${p.total}`, fraction: Math.min(1, p.done / p.total) }
}
