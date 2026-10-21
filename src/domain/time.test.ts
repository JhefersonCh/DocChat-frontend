import { describe, expect, it } from 'vitest'
import { formatRange, formatTime, nudge, rangeBand, timeFrac, timeLanding, timeToX, xToTime } from './time'

describe('formatTime / formatRange', () => {
  it('mm:ss, h:mm:ss from an hour, never negative or NaN', () => {
    expect(formatTime(0)).toBe('00:00')
    expect(formatTime(80)).toBe('01:20')
    expect(formatTime(599.9)).toBe('09:59')
    expect(formatTime(3723)).toBe('1:02:03')
    expect(formatTime(-5)).toBe('00:00')
    expect(formatTime(Number.NaN)).toBe('00:00')
    expect(formatTime(null)).toBe('00:00')
  })
  it('range: "01:20–01:40"; a missing or non-increasing end collapses to the start', () => {
    expect(formatRange(80, 100)).toBe('01:20–01:40')
    expect(formatRange(80, null)).toBe('01:20')
    expect(formatRange(80, 80)).toBe('01:20')
    expect(formatRange(null, 10)).toBe('')
  })
})

describe('time <-> x geometry', () => {
  it('maps time to x and back, clamped', () => {
    expect(timeToX(30, 120, 800)).toBe(200)
    expect(timeToX(500, 120, 800)).toBe(800)
    expect(xToTime(200, 800, 120)).toBe(30)
    expect(xToTime(-40, 800, 120)).toBe(0)
    expect(xToTime(900, 800, 120)).toBe(120)
    expect(timeFrac(10, 0)).toBe(0)
    expect(xToTime(10, 0, 120)).toBe(0)
  })
  it('rangeBand gives fractions of the duration and keeps tiny windows visible', () => {
    expect(rangeBand(30, 60, 120)).toEqual({ x: 0.25, w: 0.25 })
    const tiny = rangeBand(100, 120, 7200, 0.01)!
    expect(tiny.w).toBe(0.01)
    const edge = rangeBand(7190, 7200, 7200, 0.01)!
    expect(edge.x + edge.w).toBeCloseTo(1)
  })
  it('rangeBand is null for an unusable range or duration', () => {
    expect(rangeBand(60, 30, 120)).toBeNull()
    expect(rangeBand(30, null, 120)).toBeNull()
    expect(rangeBand(30, 60, null)).toBeNull()
    expect(rangeBand(30, 60, 0)).toBeNull()
  })
  it('timeLanding: left edge of the band, middle of the track', () => {
    expect(timeLanding({ left: 100, width: 800, top: 50, height: 96 }, 120, 30)).toEqual({ x: 300, y: 98 })
    expect(timeLanding({ left: 100, width: 800, top: 50, height: 96 }, null, 30)).toBeNull()
    expect(timeLanding({ left: 100, width: 800, top: 50, height: 96 }, 120, null)).toBeNull()
  })
  it('nudge stays inside the recording', () => {
    expect(nudge(5, -10, 100)).toBe(0)
    expect(nudge(95, 10, 100)).toBe(100)
    expect(nudge(50, 10, null)).toBe(60)
  })
})
