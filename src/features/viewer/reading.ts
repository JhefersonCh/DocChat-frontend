import { createContext, useContext, useSyncExternalStore } from 'react'

/** Where the reader is: the page in the viewer and whether answers must stay behind it ("solo lo que leí"). */
export interface Reading {
  page: number | null
  spoilerSafe: boolean
}

export interface ReadingStore {
  get: () => Reading
  subscribe: (fn: () => void) => () => void
  setPage: (page: number | null) => void
  setSpoilerSafe: (on: boolean) => void
  /** The `max_page` to send with a question: the current page while spoiler-safe is on and a page is known. */
  maxPage: () => number | null
}

export function createReadingStore(initial: Partial<Reading> = {}, onSpoilerChange?: (on: boolean) => void): ReadingStore {
  let state: Reading = { page: null, spoilerSafe: false, ...initial }
  const listeners = new Set<() => void>()
  const set = (next: Reading) => { state = next; listeners.forEach((fn) => fn()) }
  return {
    get: () => state,
    subscribe: (fn) => { listeners.add(fn); return () => { listeners.delete(fn) } },
    setPage: (page) => { if (page !== state.page) set({ ...state, page }) },
    setSpoilerSafe: (on) => { if (on !== state.spoilerSafe) { set({ ...state, spoilerSafe: on }); onSpoilerChange?.(on) } },
    maxPage: () => (state.spoilerSafe ? state.page : null),
  }
}

// Outside a provider (tests, other screens) the store is inert.
export const ReadingContext = createContext<ReadingStore>(createReadingStore())

export const useReadingStore = () => useContext(ReadingContext)

/** Live reading state; re-renders only the components that call it when the page or the mode changes. */
export function useReading(): Reading {
  const store = useReadingStore()
  return useSyncExternalStore(store.subscribe, store.get)
}
