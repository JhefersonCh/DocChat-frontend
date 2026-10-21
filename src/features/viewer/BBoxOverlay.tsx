import { motion, useReducedMotion } from 'motion/react'
import type { PageRect } from './highlight/types'
import styles from './HighlightOverlay.module.css'

const EDGES = [
  { side: 'top', axis: 'scaleX', origin: '0% 50%' },
  { side: 'right', axis: 'scaleY', origin: '50% 0%' },
  { side: 'bottom', axis: 'scaleX', origin: '100% 50%' },
  { side: 'left', axis: 'scaleY', origin: '50% 100%' },
] as const

/**
 * Amber frame around a region of a page / image. The four edges draw themselves in clockwise (top ->
 * right -> bottom -> left, 0.4 s in all), then a faint fill settles; reduced motion shows the final static
 * frame. Plain scaled edges instead of an SVG dash: dashes would not survive a non-uniform box.
 * `key` it by `seq` to replay. Percent positioning: survives zoom and resize.
 */
export function BBoxOverlay({ rect }: { rect: PageRect }) {
  const calm = useReducedMotion()
  return (
    <div
      className={styles.box} aria-hidden="true" data-bbox
      style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }}
    >
      <motion.span
        className={styles.fill}
        initial={calm ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: calm ? 0 : 0.35 }}
      />
      {EDGES.map((e, i) => (
        <motion.span
          key={e.side} className={styles.edge} data-side={e.side} style={{ transformOrigin: e.origin }}
          initial={calm ? false : { [e.axis]: 0 }} animate={{ [e.axis]: 1 }}
          transition={{ duration: 0.12, delay: i * 0.1, ease: [0.2, 0.8, 0.2, 1] }}
        />
      ))}
    </div>
  )
}
