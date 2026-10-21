// Pure video logic: citation routing, frames (keyframes + storyboard), filmstrip geometry, merged timeline.
import type { TimedSegment } from './audio'
import { audioRange } from './audio'
import { formatRange } from './time'
import type { ChunkInfo, SourceKind } from './types'

type Timed = { kind?: string; source_kind?: SourceKind | null; t_start?: number | null; t_end?: number | null }

export const isVideoCitation = (c: { kind?: string }) => c.kind === 'video'

/** A moment of a video: one of its frames (`video`) or what is said there (`audio` of a video source). */
export const isVideoTimed = (c: Pick<Timed, 'kind' | 'source_kind'>) => c.kind === 'video' || (c.kind === 'audio' && c.source_kind === 'video')

/** "video · 01:20" / "video · 01:20–01:40" (TraceBar / notes / hits). */
export const videoLabel = (c: Pick<Timed, 't_start' | 't_end'>) => ['video', formatRange(c.t_start, c.t_end)].filter(Boolean).join(' · ')

/** The playable `[start, end]` of a frame / audio / video-audio citation; null when it has no usable range. */
export function playableRange(c: Timed): { start: number; end: number } | null {
  if (c.kind === 'video') return c.t_start != null && c.t_end != null && c.t_end > c.t_start ? { start: c.t_start, end: c.t_end } : null
  return audioRange(c)
}

// ---- frames ----------------------------------------------------------------------------------

export interface StoryboardEntry { segment_id: string; t: number; t_end?: number | null; thumb_url: string }

export interface Frame {
  /** Segment id: thumb / asset endpoints and the cited chunk. */
  id: string
  t: number
  end: number
  caption: string
  thumb: boolean
}

/**
 * Frames in time order. The chunk list carries the captions; when it has none (still loading / failed) the
 * storyboard alone is enough to draw the filmstrip. The last frame ends where the video does.
 */
export function toFrames(chunks: readonly ChunkInfo[] | undefined, board?: readonly StoryboardEntry[] | null, duration?: number | null): Frame[] {
  const fromChunks = (chunks ?? []).filter((c) => c.modality === 'frame' && c.chunk_id && c.t_start != null && Number.isFinite(c.t_start))
  const raw = fromChunks.length > 0
    ? fromChunks.map((c) => ({ id: c.chunk_id!, t: c.t_start!, end: c.t_end ?? null, caption: c.content.replace(/\s+/g, ' ').trim(), thumb: c.has_thumb !== false }))
    : (board ?? []).filter((b) => Number.isFinite(b.t)).map((b) => ({ id: b.segment_id, t: b.t, end: b.t_end ?? null, caption: '', thumb: true }))
  raw.sort((a, b) => a.t - b.t)
  return raw.map((f, i) => ({ ...f, end: f.end != null && f.end > f.t ? f.end : (raw[i + 1]?.t ?? (duration && duration > f.t ? duration : f.t + 1)) }))
}

/** Index of the frame on screen at `t`: the latest one that has started; -1 before the first. */
export function frameAt(frames: readonly Pick<Frame, 't'>[], t: number): number {
  let lo = 0, hi = frames.length - 1, at = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (frames[mid].t <= t) { at = mid; lo = mid + 1 } else hi = mid - 1
  }
  return at
}

/** Frame a citation points at: by chunk id, else the one starting at its `t_start` (frame citations only). */
export function citedFrame(frames: readonly Frame[], c: { kind?: string; chunk_id?: string | null; t_start?: number | null } | null): number {
  if (!c || c.kind !== 'video') return -1
  const byId = c.chunk_id ? frames.findIndex((f) => f.id === c.chunk_id) : -1
  if (byId >= 0 || c.t_start == null) return byId
  return frames.findIndex((f) => Math.abs(f.t - c.t_start!) < 0.5)
}

// ---- filmstrip geometry ----------------------------------------------------------------------

/** Tiles that fit `width` (each >= `minTile` px wide); the strip splits the width evenly in that many. */
export const tileCount = (width: number, minTile = 72) => Math.max(1, Math.floor(width / Math.max(1, minTile)))

/** Time at the centre of tile `i` of `n` over `duration`. */
export const tileTime = (i: number, n: number, duration: number) => ((i + 0.5) / n) * duration

/** Frame index shown by every tile: the one on screen at the tile's centre (before the first frame: the first). */
export function tileFrames(frames: readonly Pick<Frame, 't'>[], n: number, duration: number | null | undefined): number[] {
  if (frames.length === 0 || !duration || duration <= 0 || n <= 0) return []
  return Array.from({ length: n }, (_, i) => Math.max(0, frameAt(frames, tileTime(i, n, duration))))
}

/** 0..1 x of every frame over the time axis (the ticks under the filmstrip). Capped: beyond that they are noise. */
export function framePositions(frames: readonly Pick<Frame, 'id' | 't'>[], duration: number | null | undefined, cap = 600): { id: string; x: number }[] {
  if (!duration || duration <= 0) return []
  const step = Math.max(1, Math.ceil(frames.length / cap))
  return frames.filter((_, i) => i % step === 0).map((f) => ({ id: f.id, x: Math.min(1, Math.max(0, f.t / duration)) }))
}

// ---- merged timeline (transcript + frame captions) -------------------------------------------

export interface TimelineItem extends TimedSegment { frame: boolean; thumb: string | null }

/** Audio windows and (optionally) frame captions in one list by time; a frame sorts before the window starting with it. */
export function mergeTimeline(audio: readonly TimedSegment[], frames: readonly Frame[], showFrames: boolean): { items: TimelineItem[]; audioAt: number[]; frameAt: number[] } {
  const rows: (TimelineItem & { src: 'a' | 'f'; n: number })[] = [
    ...audio.map((s, n) => ({ ...s, frame: false, thumb: null, src: 'a' as const, n })),
    ...(showFrames ? frames.map((f, n) => ({
      key: `f${f.id}`, chunkId: f.id, ordinal: n, start: f.t, end: f.end, text: f.caption, frame: true, thumb: f.thumb ? f.id : null, src: 'f' as const, n,
    })) : []),
  ].sort((a, b) => a.start - b.start || (a.src === b.src ? a.n - b.n : a.src === 'f' ? -1 : 1))
  const audioAt: number[] = [], frameIdx: number[] = []
  rows.forEach((r, i) => { (r.src === 'a' ? audioAt : frameIdx)[r.n] = i })
  return { items: rows, audioAt, frameAt: frameIdx }
}
