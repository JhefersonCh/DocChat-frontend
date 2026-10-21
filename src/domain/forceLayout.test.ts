import { describe, expect, it } from 'vitest'
import { layout, neighbors } from './forceLayout'

describe('forceLayout', () => {
  const ids = ['a', 'b', 'c', 'd']
  const edges = [{ source: 'a', target: 'b' }, { source: 'b', target: 'c' }]

  it('is deterministic, keeps every node inside the box and separates them', () => {
    const one = layout(ids, edges, 600, 400)
    expect(layout(ids, edges, 600, 400)).toEqual(one)
    for (const p of Object.values(one)) {
      expect(p.x).toBeGreaterThanOrEqual(20); expect(p.x).toBeLessThanOrEqual(580)
      expect(p.y).toBeGreaterThanOrEqual(20); expect(p.y).toBeLessThanOrEqual(380)
    }
    expect(Math.hypot(one.a.x - one.d.x, one.a.y - one.d.y)).toBeGreaterThan(20)
  })

  it('ignores edges to unknown nodes and finds neighbors', () => {
    expect(Object.keys(layout(ids, [{ source: 'a', target: 'zz' }], 600, 400))).toEqual(ids)
    expect([...neighbors('b', edges)].sort()).toEqual(['a', 'c'])
  })
})
