import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { FlashcardsData } from '@/domain/artifacts'
import { Button } from '@/ui/Button'
import { PageLink } from './PageLink'
import styles from './views.module.css'

export function FlashcardsView({ data }: { data: FlashcardsData }) {
  const [at, setAt] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const reduce = useReducedMotion()
  const card = data.cards[at]
  const go = (to: number) => { setAt(to); setFlipped(false) }
  const text = flipped ? card.back : card.front
  return (
    <div className={styles.cards}>
      <button
        type="button" className={styles.card} aria-label={`${flipped ? 'Dorso' : 'Frente'}: ${text}. Tocá para dar vuelta`}
        onClick={() => setFlipped((f) => !f)}
      >
        <motion.span
          key={`${at}-${flipped}`} className={styles.cardFace} data-back={flipped}
          initial={reduce ? { opacity: 0 } : { rotateX: -80, opacity: 0 }}
          animate={reduce ? { opacity: 1 } : { rotateX: 0, opacity: 1 }}
          transition={reduce ? { duration: 0.12 } : { type: 'spring', stiffness: 380, damping: 32 }}
        >
          <small>{flipped ? 'Dorso' : 'Frente'}</small>
          {text}
        </motion.span>
      </button>
      <div className={styles.nav}>
        <Button disabled={at === 0} onClick={() => go(at - 1)} aria-label="Tarjeta anterior">←</Button>
        <span className={styles.count}>{at + 1} / {data.cards.length}</span>
        <Button disabled={at === data.cards.length - 1} onClick={() => go(at + 1)} aria-label="Tarjeta siguiente">→</Button>
        <PageLink pageRef={card} />
      </div>
    </div>
  )
}
