import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { animate, useReducedMotion, type AnimationPlaybackControls } from 'motion/react'
import { springSoft } from '@/ui/motion'

/**
 * Scrolls a container with the trace spring (plan §6 #5c: stiffness 260, damping 30).
 * Interruptible: a new target retargets from the current position and any user input
 * (wheel/touch/pointer) cancels it. Reduced motion jumps straight there.
 */
export function useSmoothScroll(ref: RefObject<HTMLElement | null>) {
  const calm = useReducedMotion()
  const anim = useRef<AnimationPlaybackControls | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const stop = () => anim.current?.stop()
    el.addEventListener('wheel', stop, { passive: true })
    el.addEventListener('touchstart', stop, { passive: true })
    el.addEventListener('pointerdown', stop)
    return () => {
      stop()
      el.removeEventListener('wheel', stop)
      el.removeEventListener('touchstart', stop)
      el.removeEventListener('pointerdown', stop)
    }
  }, [ref])

  return useCallback((to: number) => {
    const el = ref.current
    if (!el) return
    anim.current?.stop()
    const max = el.scrollHeight - el.clientHeight
    const target = Math.max(0, Math.min(to, max))
    if (calm) { el.scrollTop = target; return }
    // Far away: land one screen short first so the slide never drags through every page.
    let from = el.scrollTop
    if (Math.abs(target - from) > el.clientHeight * 1.5) {
      from = target - Math.sign(target - from) * el.clientHeight * 1.2
      el.scrollTop = from
    }
    anim.current = animate(from, target, { ...springSoft, onUpdate: (v) => { el.scrollTop = v } })
  }, [ref, calm])
}
