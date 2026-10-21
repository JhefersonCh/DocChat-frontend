import { describe, expect, it } from 'vitest'
import { audioLabel, audioRange, citedSegment, cleanWaveform, currentSegment, downsamplePeaks, nextRate, slicePeaks, toSegments } from './audio'
import type { ChunkInfo } from './types'

const chunk = (ordinal: number, t_start: number | null, t_end: number | null, over: Partial<ChunkInfo> = {}): ChunkInfo => ({
  chunk_id: `c${ordinal}`, ordinal, page_start: null, page_end: null, section: null, chars: 5, content: ` hola ${ordinal} `,
  modality: 'audio', t_start, t_end, ...over,
})
// 20 s windows with 4 s of overlap (plan D9).
const segs = toSegments([chunk(2, 32, 52), chunk(0, 0, 20), chunk(1, 16, 36), chunk(9, null, null), chunk(5, 0, 5, { modality: 'text' })])

describe('toSegments', () => {
  it('keeps timed audio windows in time order, trims the text, drops the rest', () => {
    expect(segs.map((s) => s.chunkId)).toEqual(['c0', 'c1', 'c2'])
    expect(segs[0]).toMatchObject({ start: 0, end: 20, text: 'hola 0' })
  })
  it('falls back to the next start (or +1 s) when the end is missing', () => {
    const s = toSegments([chunk(0, 0, null), chunk(1, 18, null)])
    expect(s.map((x) => x.end)).toEqual([18, 19])
  })
})

describe('currentSegment', () => {
  it('picks the latest window that has started: the new one wins inside an overlap', () => {
    expect(currentSegment(segs, 0)).toBe(0)
    expect(currentSegment(segs, 15.9)).toBe(0)
    expect(currentSegment(segs, 16)).toBe(1)
    expect(currentSegment(segs, 19)).toBe(1)
    expect(currentSegment(segs, 40)).toBe(2)
  })
  it('is -1 before the first window, past the coverage, or with no segments', () => {
    expect(currentSegment(segs.map((s) => ({ ...s, start: s.start + 5, end: s.end + 5 })), 2)).toBe(-1)
    expect(currentSegment(segs, 60)).toBe(-1)
    expect(currentSegment([], 3)).toBe(-1)
  })
})

describe('citedSegment', () => {
  it('matches by chunk id, then by t_start, else -1', () => {
    expect(citedSegment(segs, { chunk_id: 'c1', t_start: 999 })).toBe(1)
    expect(citedSegment(segs, { chunk_id: null, t_start: 32.1 })).toBe(2)
    expect(citedSegment(segs, { chunk_id: null, t_start: 50 })).toBe(-1)
    expect(citedSegment(segs, null)).toBe(-1)
  })
})

describe('waveform', () => {
  it('cleanWaveform clamps peaks and rejects unusable bodies (the viewer then draws a flat line)', () => {
    expect(cleanWaveform({ peaks: [0, 0.5, 2, -1, 'x'], duration_s: 12 })).toEqual({ peaks: [0, 0.5, 1, 0, 0], duration_s: 12 })
    expect(cleanWaveform({ peaks: [] })).toBeNull()
    expect(cleanWaveform({ nope: 1 })).toBeNull()
    expect(cleanWaveform(null)).toBeNull()
    expect(cleanWaveform({ peaks: [0.1], duration_s: 0 })?.duration_s).toBeNull()
  })
  it('downsamplePeaks keeps spikes (max per bucket) and always returns `bars` values', () => {
    expect(downsamplePeaks([0, 1, 0, 0, 0, 0, 0, 0], 4)).toEqual([1, 0, 0, 0])
    expect(downsamplePeaks([0.5], 3)).toEqual([0.5, 0.5, 0.5])
    expect(downsamplePeaks([], 3)).toEqual([0, 0, 0])
  })
  it('slicePeaks cuts the cited range out of the full peaks', () => {
    const peaks = Array.from({ length: 100 }, (_, i) => (i >= 50 && i < 60 ? 1 : 0))
    expect(slicePeaks(peaks, 100, 50, 60, 2)).toEqual([1, 1])
    expect(slicePeaks(peaks, 100, 0, 10, 2)).toEqual([0, 0])
    expect(slicePeaks(peaks, 0, 0, 10, 2)).toEqual([0, 0])
  })
})

describe('labels, ranges, rates', () => {
  it('audioLabel / audioRange', () => {
    expect(audioLabel({ t_start: 80, t_end: 100 })).toBe('audio · 01:20–01:40')
    expect(audioLabel({})).toBe('audio')
    expect(audioRange({ kind: 'audio', t_start: 80, t_end: 100 })).toEqual({ start: 80, end: 100 })
    expect(audioRange({ kind: 'audio', t_start: 80, t_end: null })).toBeNull()
    expect(audioRange({ kind: 'text', t_start: 80, t_end: 100 })).toBeNull()
  })
  it('nextRate cycles 0.75 → 2 and wraps; an unknown rate restarts at 1', () => {
    expect(nextRate(1)).toBe(1.25)
    expect(nextRate(2)).toBe(0.75)
    expect(nextRate(0.75)).toBe(1)
    expect(nextRate(3)).toBe(1)
  })
})
