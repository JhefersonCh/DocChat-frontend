import { describe, expect, it } from 'vitest'
import { clampView, FIT, fitSize, frameBBox, zoomAt } from './imageView'

const box = { w: 800, h: 600 }

describe('image viewer geometry', () => {
  it('fitSize contains the image and never upscales past 2x', () => {
    expect(fitSize(box, { w: 1600, h: 600 })).toEqual({ w: 800, h: 300 })
    expect(fitSize(box, { w: 100, h: 50 })).toEqual({ w: 200, h: 100 })
    expect(fitSize({ w: 0, h: 0 }, { w: 10, h: 10 })).toEqual({ w: 0, h: 0 })
  })
  const fit = fitSize(box, { w: 1600, h: 1200 }) // 800x600
  it('zoom keeps the point under the cursor in place and is bounded', () => {
    const v = zoomAt(FIT, 2, { x: 200, y: 100 }, box, fit)
    expect(v.zoom).toBe(2)
    expect(v.x).toBe(-200)
    expect(v.y).toBe(-100)
    expect(zoomAt(FIT, 100, { x: 0, y: 0 }, box, fit).zoom).toBe(8)
    expect(zoomAt(FIT, 0.1, { x: 0, y: 0 }, box, fit)).toEqual(FIT)
  })
  it('pan is limited to the overflow; an axis that fits stays centred', () => {
    expect(clampView({ zoom: 2, x: 9999, y: -9999 }, box, fit)).toEqual({ zoom: 2, x: 400, y: -300 })
    const wide = fitSize(box, { w: 1600, h: 400 }) // 800x200
    expect(clampView({ zoom: 1, x: 50, y: 50 }, box, wide)).toEqual(FIT)
  })
  it('frameBBox zooms into a tile and centres it; a whole-image box stays fitted', () => {
    const v = frameBBox([0, 0, 0.5, 0.5], box, fit)
    expect(v.zoom).toBeCloseTo(1.4)
    expect(v.x).toBeGreaterThan(0)
    expect(v.y).toBeGreaterThan(0)
    expect(frameBBox([0, 0, 1, 1], box, fit)).toEqual(FIT)
  })
})
