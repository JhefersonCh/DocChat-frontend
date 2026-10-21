import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { segmentAssetUrl } from '@/api/media'
import { fade } from './motion'
import { useModal } from './useModal'
import styles from './Lightbox.module.css'

interface Props {
  /** Segment whose asset (<= 1024 px) is shown; null = closed. */
  chunkId: string | null
  label: string
  onClose: () => void
}

function Panel({ chunkId, label, onClose }: { chunkId: string; label: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useModal(true, ref, onClose)
  return (
    <motion.div
      ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className={styles.root}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}
      onClick={onClose}
    >
      <figure className={styles.fig} onClick={(e) => e.stopPropagation()}>
        <img className={styles.img} src={segmentAssetUrl(chunkId)} alt={label} />
        <figcaption className={styles.cap}>{label}</figcaption>
      </figure>
      <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar imagen" data-autofocus>Cerrar ✕</button>
    </motion.div>
  )
}

/** Full-size view of any image segment. Portaled, Esc / click outside closes, focus returns to the opener. */
export function Lightbox({ chunkId, label, onClose }: Props) {
  return createPortal(
    <AnimatePresence>{chunkId && <Panel key={chunkId} chunkId={chunkId} label={label} onClose={onClose} />}</AnimatePresence>,
    document.body,
  )
}
