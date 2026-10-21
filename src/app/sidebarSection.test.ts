import { describe, expect, it } from 'vitest'
import { pickVisible } from './sidebarSection'

describe('pickVisible', () => {
  // newest first: a > b > c > d > e
  const items = ['a', 'b', 'c', 'd', 'e'].map((id, n) => ({ id, created_at: `2026-10-0${5 - n}T00:00:00Z`, pinned_at: null as string | null }))
  const ids = (xs: { id: string }[]) => xs.map((i) => i.id)
  it('limits by recency and expands', () => {
    expect(ids(pickVisible(items, 3, false))).toEqual(['a', 'b', 'c'])
    expect(ids(pickVisible(items, 3, true))).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
  it('puts the active item right after the pinned ones, inside the limit', () => {
    expect(ids(pickVisible(items, 3, false, 'e'))).toEqual(['e', 'a', 'b'])
    expect(ids(pickVisible(items, 3, true, 'e'))).toEqual(['e', 'a', 'b', 'c', 'd'])
    const pinned = items.map((i) => (i.id === 'd' ? { ...i, pinned_at: '2026-10-09T00:00:00Z' } : i))
    expect(ids(pickVisible(pinned, 3, false, 'e'))).toEqual(['d', 'e', 'a'])
  })
  it('shows every pinned item (latest pinned first) even beyond the limit', () => {
    const pinned = items.map((i, n) => (n >= 1 ? { ...i, pinned_at: `2026-10-1${n}T00:00:00Z` } : i))
    expect(ids(pickVisible(pinned, 3, false))).toEqual(['e', 'd', 'c', 'b'])
  })
})
