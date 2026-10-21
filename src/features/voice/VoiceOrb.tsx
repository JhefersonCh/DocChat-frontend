import { useRef } from 'react'
import { useAnimationFrame, useReducedMotion } from 'motion/react'
import type { VoicePhase } from './useVoiceMode'
import styles from './VoiceOrb.module.css'

/** Amber orb whose core follows the voice level (yours while listening, the answer's while speaking). */
export function VoiceOrb({ phase, level, size = 56 }: { phase: VoicePhase; level: () => number; size?: number }) {
  const reduce = useReducedMotion()
  const core = useRef<HTMLSpanElement>(null)
  const smooth = useRef(0)

  useAnimationFrame(() => {
    const el = core.current
    if (!el || reduce) return
    const live = phase === 'hearing' || phase === 'speaking' || phase === 'listening'
    const target = live ? level() : 0
    smooth.current += (target - smooth.current) * (target > smooth.current ? 0.5 : 0.15) // quick attack, slow release
    el.style.transform = `scale(${(1 + smooth.current * 1.1).toFixed(3)})`
  })

  return (
    <div className={styles.orb} data-phase={phase} style={{ ['--size' as string]: `${size}px` }} aria-hidden="true">
      <span className={styles.ring} />
      <span className={styles.ring} />
      <span className={styles.arc} />
      <span ref={core} className={styles.core} />
    </div>
  )
}
