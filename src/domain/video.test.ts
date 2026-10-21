import { describe, expect, it } from 'vitest'
import type { ChunkInfo } from './types'
import { citedFrame, frameAt, framePositions, isVideoTimed, mergeTimeline, playableRange, tileCount, tileFrames, tileTime, toFrames, videoLabel } from './video'

const frame = (i: number, t: number, over: Partial<ChunkInfo> = {}): ChunkInfo => ({
  chunk_id: `f${i}`, ordinal: i, page_start: null, page_end: null, section: null, chars: 5, content: `escena ${i}`,
  modality: 'frame', origin: 'frame', t_start: t, t_end: null, has_thumb: true, ...over,
})
const win = (i: number, t0: number, t1: number): ChunkInfo => ({
  chunk_id: `a${i}`, ordinal: 10 + i, page_start: null, page_end: null, section: null, chars: 5, content: `voz ${i}`,
  modality: 'audio', origin: 'window', t_start: t0, t_end: t1,
})

describe('video citation routing', () => {
  it('a frame (video) and the speech of a video source (audio + source_kind video) both seek the video', () => {
    expect(isVideoTimed({ kind: 'video' })).toBe(true)
    expect(isVideoTimed({ kind: 'audio', source_kind: 'video' })).toBe(true)
    expect(isVideoTimed({ kind: 'audio', source_kind: 'audio' })).toBe(false)
    expect(isVideoTimed({ kind: 'audio' })).toBe(false)
    expect(isVideoTimed({ kind: 'image', source_kind: 'video' })).toBe(false)
  })
  it('labels "video · 01:20" and "video · 01:20–01:40"', () => {
    expect(videoLabel({ t_start: 80, t_end: null })).toBe('video · 01:20')
    expect(videoLabel({ t_start: 80, t_end: 100 })).toBe('video · 01:20–01:40')
  })
  it('playableRange needs an increasing range, for both kinds', () => {
    expect(playableRange({ kind: 'video', t_start: 80, t_end: 100 })).toEqual({ start: 80, end: 100 })
    expect(playableRange({ kind: 'audio', source_kind: 'video', t_start: 5, t_end: 25 })).toEqual({ start: 5, end: 25 })
    expect(playableRange({ kind: 'video', t_start: 80, t_end: 80 })).toBeNull()
    expect(playableRange({ kind: 'image', t_start: 1, t_end: 2 })).toBeNull()
  })
})

describe('frames / storyboard', () => {
  const chunks = [frame(1, 30), frame(0, 0), win(0, 0, 20), frame(2, 61, { has_thumb: false })]
  it('toFrames: only frames, in time order; each ends at the next one, the last at the duration', () => {
    const f = toFrames(chunks, null, 90)
    expect(f.map((x) => [x.id, x.t, x.end])).toEqual([['f0', 0, 30], ['f1', 30, 61], ['f2', 61, 90]])
    expect(f[0].caption).toBe('escena 0')
    expect(f[2].thumb).toBe(false)
  })
  it('without chunk frames the storyboard alone still draws the strip', () => {
    const f = toFrames([], [{ segment_id: 's2', t: 20, thumb_url: '' }, { segment_id: 's1', t: 0, t_end: 20, thumb_url: '' }], 40)
    expect(f.map((x) => [x.id, x.t, x.end, x.caption])).toEqual([['s1', 0, 20, ''], ['s2', 20, 40, '']])
  })
  it('frameAt: the latest frame that started; -1 before the first', () => {
    const f = toFrames(chunks, null, 90)
    expect([frameAt(f, -1), frameAt(f, 0), frameAt(f, 29.9), frameAt(f, 30), frameAt(f, 500)]).toEqual([-1, 0, 0, 1, 2])
  })
  it('citedFrame: by chunk id, else by the frame starting at t_start; speech citations point at no frame', () => {
    const f = toFrames(chunks, null, 90)
    expect(citedFrame(f, { kind: 'video', chunk_id: 'f1', t_start: 99 })).toBe(1)
    expect(citedFrame(f, { kind: 'video', chunk_id: null, t_start: 30.2 })).toBe(1)
    expect(citedFrame(f, { kind: 'audio', chunk_id: 'f1', t_start: 30 })).toBe(-1)
    expect(citedFrame(f, null)).toBe(-1)
  })
})

describe('filmstrip time mapping', () => {
  it('tileCount fits whole tiles; tileTime is the centre of the slot', () => {
    expect(tileCount(720, 72)).toBe(10)
    expect(tileCount(30, 72)).toBe(1)
    expect(tileTime(0, 4, 100)).toBe(12.5)
    expect(tileTime(3, 4, 100)).toBe(87.5)
  })
  it('tileFrames: every tile shows the frame on screen at its centre (the first one before it starts)', () => {
    const f = toFrames([frame(0, 10), frame(1, 50), frame(2, 80)], null, 100)
    // centres: 12.5, 37.5, 62.5, 87.5
    expect(tileFrames(f, 4, 100)).toEqual([0, 0, 1, 2])
    expect(tileFrames(f, 4, null)).toEqual([])
    expect(tileFrames([], 4, 100)).toEqual([])
  })
  it('framePositions: x = t / duration (the storyboard ticks), clamped; capped for huge videos', () => {
    const f = toFrames([frame(0, 0), frame(1, 25), frame(2, 100)], null, 100)
    expect(framePositions(f, 100).map((p) => p.x)).toEqual([0, 0.25, 1])
    expect(framePositions(f, null)).toEqual([])
    const many = Array.from({ length: 1000 }, (_, i) => ({ id: `${i}`, t: i }))
    expect(framePositions(many, 1000, 100).length).toBeLessThanOrEqual(100)
  })
})

describe('merged timeline', () => {
  const audio = [{ key: 'a0', chunkId: 'a0', ordinal: 0, start: 0, end: 20, text: 'voz 0' }, { key: 'a1', chunkId: 'a1', ordinal: 1, start: 30, end: 50, text: 'voz 1' }]
  const frames = toFrames([frame(0, 0), frame(1, 25)], null, 60)
  it('interleaves by time (a frame before the window that starts with it) and maps both cursors', () => {
    const { items, audioAt, frameAt: fa } = mergeTimeline(audio, frames, true)
    expect(items.map((i) => i.text)).toEqual(['escena 0', 'voz 0', 'escena 1', 'voz 1'])
    expect(audioAt).toEqual([1, 3])
    expect(fa).toEqual([0, 2])
    expect(items[0]).toMatchObject({ frame: true, thumb: 'f0' })
  })
  it('collapsed: only the speech', () => {
    const { items, frameAt: fa } = mergeTimeline(audio, frames, false)
    expect(items.map((i) => i.text)).toEqual(['voz 0', 'voz 1'])
    expect(fa).toEqual([])
  })
})
