import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { SlidesData } from '@/domain/artifacts'
import { deckFileName, deckToMarkdown, slideRefLabels } from '@/domain/slides'
import { Button } from '@/ui/Button'
import { downloadText } from '@/ui/download'
import { ease } from '@/ui/motion'
import { useAliasOf, useOpenRef } from '../useOpenRef'
import { Presenter } from './Presenter'
import { RefChips } from './RefChips'
import { SlideStage } from './SlideStage'
import styles from './slides.module.css'

/** Resolves once the pictures of the print copy are decoded (so the PDF is not missing images). */
async function settle(root: ParentNode) {
  await new Promise((r) => setTimeout(r, 350))
  const imgs = [...root.querySelectorAll('img')]
  await Promise.race([Promise.all(imgs.map((i) => i.decode().catch(() => {}))), new Promise((r) => setTimeout(r, 4000))])
}

function PrintDeck({ deck, aliasOf, onDone }: { deck: SlidesData; aliasOf: (id: string | null) => string | null; onDone: () => void }) {
  useEffect(() => {
    let cancelled = false
    let fallback: ReturnType<typeof setTimeout> | undefined
    const done = () => { if (!cancelled) onDone() }
    const root = document.querySelector('[data-print-root]')
    document.body.dataset.printDeck = ''
    void (async () => {
      if (root) await settle(root)
      if (cancelled) return
      window.addEventListener('afterprint', done, { once: true }) // the dialog closed (print() blocks in most browsers)
      fallback = setTimeout(done, 120_000)
      window.print()
    })()
    return () => { cancelled = true; clearTimeout(fallback); window.removeEventListener('afterprint', done); delete document.body.dataset.printDeck }
  }, [onDone])
  return createPortal(
    <div data-print-root className={styles.printRoot}>
      {deck.slides.map((s, i) => (
        <div key={i} className={styles.printSlide}>
          <SlideStage slide={s} index={i + 1} total={deck.slides.length} deckTitle={deck.title}
            sources={<span className={styles.plainRef}>{slideRefLabels(s, aliasOf).join(' · ')}</span>} />
        </div>
      ))}
    </div>,
    document.body,
  )
}

/** Deck viewer: thumbnail strip + main 16:9 slide, citation chips, presenter mode and exports (PPTX / PDF / Markdown). */
export function SlidesView({ data: deck }: { data: SlidesData }) {
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState(1)
  const [notes, setNotes] = useState(false)
  const [presenting, setPresenting] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reduce = useReducedMotion()
  const aliasOf = useAliasOf()
  const openRef = useOpenRef()
  const last = deck.slides.length - 1
  const slide = deck.slides[index]!

  const go = (to: number) => {
    const next = Math.min(last, Math.max(0, to))
    setDir(next >= index ? 1 : -1)
    setIndex(next)
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (e.key === 'ArrowRight') go(index + 1)
    else if (e.key === 'ArrowLeft') go(index - 1)
    else return
    e.preventDefault()
  }
  const pptx = async () => {
    setBusy(true)
    setError(null)
    try {
      await (await import('./exportPptx')).exportPptx(deck, aliasOf)
    } catch {
      setError('No se pudo generar el PPTX.')
    } finally {
      setBusy(false)
    }
  }
  const motionProps = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.12 } }
    : { initial: { opacity: 0, x: dir * 28 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: dir * -28 }, transition: { duration: 0.22, ease } }

  return (
    <div className={styles.viewer} onKeyDown={onKey}>
      <div className={styles.toolbar}>
        <Button variant="solid" onClick={() => setPresenting(true)}>Presentar</Button>
        <Button aria-pressed={notes} onClick={() => setNotes((v) => !v)}>Notas</Button>
        <span />
        <Button disabled={busy} onClick={() => void pptx()}>{busy ? 'Exportando…' : 'PPTX'}</Button>
        <Button disabled={printing} onClick={() => setPrinting(true)}>PDF</Button>
        <Button onClick={() => downloadText(deckFileName(deck, 'md'), deckToMarkdown(deck, aliasOf))}>.md</Button>
      </div>
      {error && <p role="alert" className={styles.warn}>{error}</p>}
      <div className={styles.main} aria-roledescription="carrusel" aria-label={`Diapositiva ${index + 1} de ${deck.slides.length}`}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={index} {...motionProps}>
            <SlideStage slide={slide} index={index + 1} total={deck.slides.length} deckTitle={deck.title} />
          </motion.div>
        </AnimatePresence>
      </div>
      <RefChips slide={slide} aliasOf={aliasOf} onOpen={openRef} />
      {notes && <p className={styles.notes}><b>Notas del orador</b>{slide.notes || 'Sin notas para esta diapositiva.'}</p>}
      <div className={styles.strip} role="group" aria-label="Diapositivas">
        {deck.slides.map((s, i) => (
          <button key={i} type="button" className={styles.thumb} aria-current={i === index} aria-label={`Ir a la diapositiva ${i + 1}: ${s.title}`} onClick={() => go(i)}>
            <span aria-hidden="true"><SlideStage slide={s} index={i + 1} total={deck.slides.length} deckTitle="" /></span>
            <span className={styles.thumbN} aria-hidden="true">{i + 1}</span>
          </button>
        ))}
      </div>
      {presenting && <Presenter deck={deck} start={index} aliasOf={aliasOf} onOpenRef={openRef} onClose={(i) => { setIndex(i); setPresenting(false) }} />}
      {printing && <PrintDeck deck={deck} aliasOf={aliasOf} onDone={() => setPrinting(false)} />}
    </div>
  )
}
