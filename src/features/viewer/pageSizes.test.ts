import { describe, expect, it } from 'vitest'
import { loadPageSizes } from './pageSizes'

const fake = (n: number, log: number[] = []) => ({
  numPages: n,
  getPage: async (i: number) => { log.push(i); return { getViewport: () => ({ width: 100 + i, height: 200 + i }) } },
})

describe('loadPageSizes', () => {
  it('returns every page size in order', async () => {
    const out = await loadPageSizes(fake(20))
    expect(out).toHaveLength(20)
    expect(out?.[0]).toEqual({ width: 101, height: 201 })
    expect(out?.[19]).toEqual({ width: 120, height: 220 })
  })
  it('stops when cancelled', async () => {
    const log: number[] = []
    expect(await loadPageSizes(fake(40, log), () => true)).toBeNull()
    expect(log.length).toBeLessThan(40)
  })
})
