import { useEffect, useRef } from 'react'
import { useAnimate, useReducedMotion } from 'motion/react'

/** Plan §6 #5a: the clicked chip/note pulses (150 ms) on every selection, including re-selecting the same one. */
export function usePulse<T extends HTMLElement>(active: boolean, seq: number) {
  const [scope, animate] = useAnimate<T>()
  const calm = useReducedMotion()
  const last = useRef(seq) // a remount must not replay an old selection
  useEffect(() => {
    if (seq === last.current) return
    last.current = seq
    if (active && !calm && scope.current) void animate(scope.current, { scale: [1, 1.18, 1] }, { duration: 0.15, ease: 'easeOut' })
  }, [seq, active, calm, animate, scope])
  return scope
}
