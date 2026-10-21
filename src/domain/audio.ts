// Pure audio-viewer logic: transcript segments, current-segment lookup, waveform peaks, playback rates.
import { formatRange } from './time'
import type { ChunkInfo, Citation } from './types'

export const isAudioCitation = (c: { kind?: string }) => c.kind === 'audio'

/** "audio · 01:20–01:40" (TraceBar / notes / hits). */
export const audioLabel = (c: { t_start?: number | null; t_end?: number | null }) =>
  ['audio', formatRange(c.t_start, c.t_end)].filter(Boolean).join(' · ')

export interface TimedSegment {
  key: string
  chunkId: string | null
  ordinal: number
  start: number
  end: number
  text: string
  /** Frame caption rows (video timeline): `thumb` = segment id of its thumbnail. */
  frame?: boolean
  thumb?: string | null
}

/** Transcript windows in time order: audio segments with a start; the end falls back to the next start. */
export function toSegments(chunks: readonly ChunkInfo[]): TimedSegment[] {
  const timed = chunks
    .filter((c) => (c.modality === 'audio' || c.modality == null) && c.t_start != null && Number.isFinite(c.t_start))
    .sort((a, b) => a.t_start! - b.t_start! || a.ordinal - b.ordinal)
  return timed.map((c, i) => ({
    key: c.chunk_id ?? `o${c.ordinal}`,
    chunkId: c.chunk_id,
    ordinal: c.ordinal,
    start: c.t_start!,
    end: c.t_end != null && c.t_end > c.t_start! ? c.t_end : (timed[i + 1]?.t_start ?? c.t_start! + 1),
    text: c.content.replace(/\s+/g, ' ').trim(),
  }))
}

/**
 * Index of the segment being heard at `t`: the latest window that has started (windows overlap, the new one
 * wins), or -1 before the first / after the coverage ends. Binary search: runs on every frame.
 */
export function currentSegment(segments: readonly Pick<TimedSegment, 'start' | 'end'>[], t: number): number {
  let lo = 0, hi = segments.length - 1, at = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (segments[mid].start <= t) { at = mid; lo = mid + 1 } else hi = mid - 1
  }
  return at >= 0 && t < segments[at].end + 0.5 ? at : -1
}

/** Segment a citation points at: by chunk id, else by the window that starts at its `t_start`. */
export function citedSegment(segments: readonly TimedSegment[], c: Pick<Citation, 'chunk_id' | 't_start'> | null): number {
  if (!c) return -1
  const byId = c.chunk_id ? segments.findIndex((s) => s.chunkId === c.chunk_id) : -1
  if (byId >= 0 || c.t_start == null) return byId
  return segments.findIndex((s) => Math.abs(s.start - c.t_start!) < 0.25)
}

// ---- waveform ------------------------------------------------------------------------------

export interface Waveform { peaks: number[]; duration_s: number | null }

/** Peaks as 0..1 finite numbers; anything unusable (not an array, empty) -> null (the viewer draws a flat line). */
export function cleanWaveform(raw: unknown): Waveform | null {
  const w = raw as { peaks?: unknown; duration_s?: unknown } | null
  if (!w || !Array.isArray(w.peaks)) return null
  const peaks = w.peaks.map((p) => (typeof p === 'number' && Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0))
  if (peaks.length === 0) return null
  return { peaks, duration_s: typeof w.duration_s === 'number' && w.duration_s > 0 ? w.duration_s : null }
}

/** `bars` buckets, each the max of its peaks (a quiet bucket must not hide a spike). */
export function downsamplePeaks(peaks: readonly number[], bars: number): number[] {
  if (bars <= 0) return []
  if (peaks.length === 0) return Array.from({ length: bars }, () => 0)
  return Array.from({ length: bars }, (_, i) => {
    const a = Math.floor((i * peaks.length) / bars)
    const b = Math.max(a + 1, Math.floor(((i + 1) * peaks.length) / bars))
    let m = 0
    for (let j = a; j < b && j < peaks.length; j++) m = Math.max(m, peaks[j])
    return m
  })
}

/** Peaks of the `[start, end]` slice of a recording (mini waveform of a citation). */
export function slicePeaks(peaks: readonly number[], duration: number, start: number, end: number, bars: number): number[] {
  if (peaks.length === 0 || duration <= 0 || !(end > start)) return downsamplePeaks([], bars)
  const a = Math.floor((Math.max(0, start) / duration) * peaks.length)
  const b = Math.max(a + 1, Math.ceil((Math.min(duration, end) / duration) * peaks.length))
  return downsamplePeaks(peaks.slice(a, b), bars)
}

// ---- playback rate ---------------------------------------------------------------------------

export const RATES = [0.75, 1, 1.25, 1.5, 2] as const
export const nextRate = (r: number) => RATES[(Math.max(0, RATES.indexOf(r as (typeof RATES)[number])) + 1) % RATES.length]
export const rateLabel = (r: number) => `${r}×`

/** SVG path of mirrored bars on a `0 0 values.length 100` viewBox (shared by the player and the mini slices). */
export function barsPath(values: readonly number[], flat = false): string {
  return values.map((p, i) => {
    const h = Math.max(flat ? 2 : 5, Math.pow(p, 0.8) * 92)
    return `M${i + 0.18} ${50 - h / 2}h0.64v${h}h-0.64z`
  }).join('')
}

/** The playable `[start, end]` of an audio citation / hit; null for anything else or an unusable range. */
export function audioRange(c: { kind?: string; t_start?: number | null; t_end?: number | null }): { start: number; end: number } | null {
  if (c.kind !== 'audio' || c.t_start == null || c.t_end == null || !(c.t_end > c.t_start)) return null
  return { start: c.t_start, end: c.t_end }
}
