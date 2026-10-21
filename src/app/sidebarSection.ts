import { useCallback, useState } from 'react'

export interface Pinnable { id: string; created_at: string; pinned_at?: string | null }

const ms = (iso: string) => Date.parse(iso) || 0

/** Sidebar order: pinned first (latest pinned on top), then the active item, then the rest by recency. */
export function orderItems<T extends Pinnable>(items: T[], activeId?: string): T[] {
  const pinned = items.filter((i) => i.pinned_at).sort((a, b) => ms(b.pinned_at!) - ms(a.pinned_at!))
  const rest = items.filter((i) => !i.pinned_at).sort((a, b) => ms(b.created_at) - ms(a.created_at))
  const at = activeId ? rest.findIndex((i) => i.id === activeId) : -1
  if (at > 0) rest.unshift(...rest.splice(at, 1))
  return [...pinned, ...rest]
}

/**
 * Items to render, already ordered (see `orderItems`). The limit applies after ordering, so the
 * active item sits near the top and never jumps when collapsing; pinned ones are always shown.
 */
export function pickVisible<T extends Pinnable>(items: T[], limit: number, expanded: boolean, activeId?: string): T[] {
  const ordered = orderItems(items, activeId)
  if (expanded || ordered.length <= limit) return ordered
  const pinned = ordered.filter((i) => i.pinned_at).length
  return ordered.slice(0, Math.max(limit, pinned))
}

/** Separator to draw before `cur` in an ordered list: label before the first pinned, divider before the first unpinned after pinned. */
export function pinMarkBefore(prev: Pinnable | undefined, cur: Pinnable, index: number): 'label' | 'divider' | null {
  if (cur.pinned_at && index === 0) return 'label'
  return !cur.pinned_at && prev?.pinned_at ? 'divider' : null
}

/** Optimistic cache update: pin (stamp now) or unpin one item. */
export function optimisticPin<T extends Pinnable>(items: T[], id: string, pinned: boolean): T[] {
  return items.map((i) => (i.id === id ? { ...i, pinned_at: pinned ? new Date().toISOString() : null } : i))
}

/** Boolean flag remembered in localStorage (storage may be blocked: never throws). */
export function usePersistedFlag(key: string, initial = false): [boolean, () => void] {
  const [value, setValue] = useState(() => {
    try { const v = localStorage.getItem(key); return v === null ? initial : v === '1' } catch { return initial }
  })
  const toggle = useCallback(() => {
    setValue((v) => {
      try { localStorage.setItem(key, v ? '0' : '1') } catch { /* ignore */ }
      return !v
    })
  }, [key])
  return [value, toggle]
}
