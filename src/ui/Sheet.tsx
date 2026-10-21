import { useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls, useIsPresent, type PanInfo } from 'motion/react'
import { fade, springSheet } from './motion'
import { useModal } from './useModal'
import styles from './Sheet.module.css'

interface Props {
  open: boolean
  onClose: () => void
  /** Accessible name of the dialog. */
  label: string
  /** `bottom` = viewer sheet (85 dvh), `left` = chat-list drawer. */
  side?: 'bottom' | 'left'
  /** Bottom only: the drag zone under the grab handle (trace readout, close button…). */
  header?: ReactNode
  children: ReactNode
}

const FAR = 96 // px dragged past which a release dismisses
const FLICK = 500 // px/s: a quick flick dismisses regardless of distance (Emil: velocity, not threshold)

function Panel({ onClose, label, side, header, children }: Omit<Props, 'open'> & { side: 'bottom' | 'left' }) {
  const ref = useRef<HTMLDivElement>(null)
  const controls = useDragControls()
  const present = useIsPresent()
  useModal(present, ref, onClose)

  const bottom = side === 'bottom'
  const hidden = bottom ? { y: '100%' } : { x: '-100%' }
  const shown = bottom ? { y: 0 } : { x: 0 }
  const onDragEnd = (_: PointerEvent, { offset, velocity }: PanInfo) => {
    const d = bottom ? offset.y : -offset.x
    const v = bottom ? velocity.y : -velocity.x
    if (d > FAR || v > FLICK) onClose()
  }

  return (
    <>
      <motion.div
        className={styles.scrim} aria-hidden="true" onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}
      />
      <motion.div
        ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
        className={`${styles.panel} ${bottom ? styles.bottom : styles.left}`}
        initial={hidden} animate={shown} exit={hidden} transition={springSheet}
        drag={bottom ? 'y' : 'x'} dragListener={!bottom} dragControls={controls}
        dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
        dragElastic={bottom ? { top: 0.04, bottom: 0.7 } : { left: 0.7, right: 0.04 }}
        onDragEnd={onDragEnd}
      >
        {bottom && (
          <div className={styles.grip} onPointerDown={(e) => controls.start(e)}>
            <span className={styles.handle} aria-hidden="true" />
            {header}
          </div>
        )}
        <div className={styles.body}>{children}</div>
      </motion.div>
    </>
  )
}

/** Modal surface for phones (plan §4, §6 #10). Portaled: immune to transformed ancestors. */
export function Sheet({ open, side = 'bottom', ...rest }: Props) {
  return createPortal(
    <AnimatePresence>{open && <Panel key="panel" side={side} {...rest} />}</AnimatePresence>,
    document.body,
  )
}
