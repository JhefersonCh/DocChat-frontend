import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { SlideRef, SlidesData } from '@/domain/artifacts'
import { ease } from '@/ui/motion'
import { RefChips } from './RefChips'
import { SlideStage } from './SlideStage'
import styles from './slides.module.css'

interface Props {
  deck: SlidesData
  start: number
  aliasOf: (id: string | null) => string | null
  onOpenRef: (ref: SlideRef, origin: Element) => void
  onClose: (index: number) => void
}

const NEXT = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'])
const PREV = new Set(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'])

/** Fullscreen presenter: ←/→ move, N toggles speaker notes, Esc leaves. */
export function Presenter({ deck, start, aliasOf, onOpenRef, onClose }: Props) {
  const [index, setIndex] = useState(start)
  const [dir, setDir] = useState(1)
  const [notes, setNotes] = useState(false)
  const reduce = useReducedMotion()
  const root = useRef<HTMLDivElement>(null)
  const state = useRef({ index, onClose })
  useEffect(() => { state.current = { index, onClose } })
  const last = deck.slides.length - 1
  const go = (to: number) => {
    const next = Math.min(last, Math.max(0, to))
    setDir(next >= index ? 1 : -1)
    setIndex(next)
  }

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    root.current?.focus()
    let entered = false
    root.current?.requestFullscreen?.().then(() => { entered = true }, () => {})
    const onFs = () => { if (entered && !document.fullscreenElement) state.current.onClose(state.current.index) }
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      document.removeEventListener('fullscreenchange', onFs)
      entered = false
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
      before?.focus?.()
    }
  }, [])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const k = e.key
    if (k === 'Escape') onClose(index)
    else if (NEXT.has(k)) go(index + 1)
    else if (PREV.has(k)) go(index - 1)
    else if (k === 'Home') go(0)
    else if (k === 'End') go(last)
    else if (k === 'n' || k === 'N') setNotes((v) => !v)
    else return
    e.preventDefault()
  }

  const slide = deck.slides[index]!
  const motionProps = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.12 } }
    : { initial: { opacity: 0, x: dir * 48 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: dir * -48 }, transition: { duration: 0.28, ease } }

  return createPortal(
    <div ref={root} className={styles.presenter} role="dialog" aria-modal="true" aria-label="Modo presentación" tabIndex={-1} onKeyDown={onKey}>
      <div className={styles.pStage}>
        <div className={styles.pFrame} data-notes={notes}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={index} {...motionProps}>
              <SlideStage slide={slide} index={index + 1} total={deck.slides.length} deckTitle={deck.title} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      {notes && <p className={styles.pNotes} aria-label="Notas del orador">{slide.notes || 'Sin notas para esta diapositiva.'}</p>}
      <div className={styles.pBar}>
        <button type="button" className={styles.pBtn} onClick={() => go(index - 1)} disabled={index === 0} aria-label="Diapositiva anterior">←</button>
        <span className={styles.counter} aria-live="polite">{index + 1} / {deck.slides.length}</span>
        <button type="button" className={styles.pBtn} onClick={() => go(index + 1)} disabled={index === last} aria-label="Diapositiva siguiente">→</button>
        <div className={styles.grow}>
          <RefChips slide={slide} aliasOf={aliasOf} onOpen={(r, o) => { onClose(index); onOpenRef(r, o) }} />
        </div>
        <button type="button" className={styles.pBtn} aria-pressed={notes} onClick={() => setNotes((v) => !v)}>Notas (N)</button>
        <button type="button" className={styles.pBtn} onClick={() => onClose(index)}>Salir (Esc)</button>
      </div>
    </div>,
    document.body,
  )
}
