import { expect, it } from 'vitest'
import { mergeRects } from './mergeRects'

it('merges touching items on one line and keeps separate lines apart', () => {
  const out = mergeRects([
    { x: 0.1, y: 0.2, w: 0.1, h: 0.02 },
    { x: 0.2, y: 0.2005, w: 0.15, h: 0.02 },
    { x: 0.1, y: 0.23, w: 0.2, h: 0.02 },
  ])
  expect(out).toHaveLength(2)
  expect(out[0].x).toBeCloseTo(0.1)
  expect(out[0].w).toBeCloseTo(0.25)
})
