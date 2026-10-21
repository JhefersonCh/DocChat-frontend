// Pure time helpers for audio: labels and time <-> x geometry. No React, no DOM.

const pad = (n: number) => String(n).padStart(2, '0')

/** "01:20" (mm:ss); "1:02:03" from one hour up. Negative / NaN -> "00:00". */
export function formatTime(seconds: number | null | undefined): string {
  const s = Math.floor(Number.isFinite(seconds) && seconds! > 0 ? seconds! : 0)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`
}

/** "01:20–01:40"; a missing / non-increasing end collapses to the start. */
export function formatRange(start: number | null | undefined, end?: number | null): string {
  if (start == null) return ''
  return end != null && end > start ? `${formatTime(start)}–${formatTime(end)}` : formatTime(start)
}

/** 0..1 position of `t` in `duration` (clamped); 0 when the duration is unknown. */
export const timeFrac = (t: number, duration: number | null | undefined) =>
  duration && duration > 0 && Number.isFinite(t) ? Math.min(1, Math.max(0, t / duration)) : 0

export const timeToX = (t: number, duration: number | null | undefined, width: number) => timeFrac(t, duration) * width

/** Inverse of `timeToX`: pointer x (px from the left edge of the track) -> seconds. */
export const xToTime = (x: number, width: number, duration: number | null | undefined) =>
  width > 0 && duration && duration > 0 ? Math.min(duration, Math.max(0, (x / width) * duration)) : 0

export interface TimeBand { x: number; w: number }

/**
 * Fraction rect of a time range over the track. `minW` (a fraction) keeps a 20 s window of a 2 h recording
 * visible as a box. null when the range or the duration is unusable.
 */
export function rangeBand(start: number | null | undefined, end: number | null | undefined, duration: number | null | undefined, minW = 0): TimeBand | null {
  if (start == null || end == null || !duration || duration <= 0 || !(end > start)) return null
  const x0 = timeFrac(start, duration)
  const span = Math.min(end, duration) - Math.max(start, 0)
  if (span <= 0) return null
  const w = Math.max(span / duration, minW)
  return { x: Math.min(x0, 1 - w), w }
}

/**
 * Where the trace thread lands for an audio range, in viewport px: the left edge of the band (the thread
 * arrives from the chat column) at the vertical middle of the waveform.
 */
export function timeLanding(track: { left: number; width: number; top: number; height: number }, duration: number | null | undefined, start: number | null | undefined): { x: number; y: number } | null {
  if (start == null || !duration || duration <= 0 || track.width <= 0) return null
  return { x: track.left + timeToX(start, duration, track.width), y: track.top + track.height / 2 }
}

/** Seek target of ±delta seconds, kept inside the recording. */
export const nudge = (t: number, delta: number, duration: number | null | undefined) =>
  Math.min(duration && duration > 0 ? duration : Infinity, Math.max(0, t + delta))
