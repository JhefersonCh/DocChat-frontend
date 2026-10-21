import { useSyncExternalStore } from 'react'

/** Live `matchMedia`. Layout changes by breakpoint stay in CSS; this is only for what must not render at all. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', notify)
      return () => mq.removeEventListener('change', notify)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Phone breakpoint (plan §4: < 768 px). */
export const useIsPhone = () => useMediaQuery('(max-width: 767px)')
