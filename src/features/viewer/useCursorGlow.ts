import { useEffect, type RefObject } from 'react'
import { useReducedMotion, useSpring } from 'motion/react'

/**
 * Plan §6 #8: a 4 % amber radial that trails the pointer over the viewer. The position lives in two CSS
 * variables fed by springs (no React state, no re-render); the gradient itself is CSS. Fine pointers
 * only; off with reduced motion.
 */
export function useCursorGlow(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  const calm = useReducedMotion()
  const x = useSpring(0, { stiffness: 120, damping: 20 })
  const y = useSpring(0, { stiffness: 120, damping: 20 })

  useEffect(() => {
    const el = ref.current
    if (!enabled || !el || calm || !window.matchMedia('(pointer: fine)').matches) return
    const offX = x.on('change', (v) => el.style.setProperty('--mx', `${v}px`))
    const offY = y.on('change', (v) => el.style.setProperty('--my', `${v}px`))
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      x.set(e.clientX - r.left)
      y.set(e.clientY - r.top)
      el.dataset.glow = 'on'
    }
    const leave = () => { delete el.dataset.glow }
    el.addEventListener('pointermove', move, { passive: true })
    el.addEventListener('pointerleave', leave)
    return () => {
      offX(); offY()
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
    }
  }, [ref, enabled, calm, x, y])
}
