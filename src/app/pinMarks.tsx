import { motion, useReducedMotion } from 'motion/react'
import styles from './SidebarSection.module.css'

/** Separator inside a section list: "Fijados" label above the pinned group, hairline above the rest. */
export function PinMark({ kind }: { kind: 'label' | 'divider' }) {
  const calm = useReducedMotion()
  return (
    <motion.li layout={calm ? false : 'position'} className={kind === 'label' ? styles.pinLabel : styles.pinDivider}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden="true">
      {kind === 'label' ? 'Fijados' : null}
    </motion.li>
  )
}
