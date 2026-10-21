import { motion, useReducedMotion } from 'motion/react'
import type { PageRect } from './highlight/types'
import styles from './HighlightOverlay.module.css'

/**
 * Amber marker over a page (plan §6 #6): two beats on arrival, then settles as a static
 * highlighter stroke with a 2 px underline (never colour alone, plan §9). `key` it by `seq`
 * so re-selecting the same citation replays the pulse.
 */
export function HighlightOverlay({ rects }: { rects: PageRect[] }) {
  const calm = useReducedMotion()
  return (
    <div className={styles.layer} aria-hidden="true" data-highlight>
      {rects.map((r, i) => (
        <motion.span
          key={i}
          className={styles.mark}
          style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
          initial={calm ? false : { opacity: 0, scale: 1.02 }}
          animate={calm ? { opacity: 1 } : { opacity: [0, 1, 0.55, 1], scale: [1.02, 1, 1, 1] }}
          transition={{ duration: 0.6, times: [0, 0.35, 0.65, 1], ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}
