import { useId, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { easeInOut } from '@/ui/motion'
import { usePersistedFlag } from './sidebarSection'
import styles from './SidebarSection.module.css'

interface Props {
  storageKey: string
  title: string
  icon: ReactNode
  count?: number
  addLabel: string
  onAdd: () => void
  addPressed?: boolean
  addDisabled?: boolean
  children: ReactNode
}

const Chevron = ({ open }: { open: boolean }) => (
  <svg className={styles.chev} data-open={open} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
    <path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** Collapsible sidebar section: chevron header (remembered per section) + "+" action + animated body. */
export function SidebarSection({ storageKey, title, icon, count, addLabel, onAdd, addPressed, addDisabled, children }: Props) {
  const [collapsed, toggle] = usePersistedFlag(`sidebar:${storageKey}:collapsed`)
  const calm = useReducedMotion()
  const bodyId = useId()
  const open = !collapsed
  return (
    <section className={styles.section} aria-label={title}>
      <div className={styles.head}>
        <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={bodyId} title={title} onClick={toggle}>
          <Chevron open={open} />
          <span className={styles.icon} aria-hidden="true">{icon}</span>
          <span className={styles.title}>{title}</span>
          {count !== undefined && <span className={styles.badge} aria-label={`${count} en total`}>{count}</span>}
        </button>
        <button type="button" className={styles.add} aria-label={addLabel} title={addLabel} aria-expanded={addPressed} disabled={addDisabled} onClick={onAdd}>
          <span data-open={addPressed} aria-hidden="true">+</span>
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={bodyId} className={styles.body} style={{ overflow: 'hidden' }}
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={calm ? { duration: 0.1 } : { duration: 0.26, ease: easeInOut }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

export function MoreToggle({ expanded, hidden, onClick }: { expanded: boolean; hidden: number; onClick: () => void }) {
  return (
    <button type="button" className={styles.more} aria-expanded={expanded} onClick={onClick}>
      {expanded ? 'Ver menos' : `Ver más (${hidden})`}
    </button>
  )
}

const PinIcon = ({ filled }: { filled: boolean }) => (
  <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M10 1.8 14.2 6l-1.4.7-2.2 2.2.3 3.1-1 1-2.6-2.6-3.6 3.6-.7-.7 3.6-3.6L3.9 7.1l1-1 3.1.3 2.2-2.2z"
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
)

/** Pin toggle of a sidebar row: hover / focus to reveal (always shown on touch), amber when pinned. */
export function PinButton({ pinned, noun, name, onToggle, className }: { pinned: boolean; noun: 'chat' | 'proyecto'; name: string; onToggle: () => void; className?: string }) {
  const label = `${pinned ? 'Desfijar' : 'Fijar'} ${noun}`
  return (
    <button type="button" className={`${styles.pin} ${className ?? ''}`} data-pinned={pinned} aria-pressed={pinned} aria-label={label} title={`${label}: ${name}`} onClick={onToggle}>
      <PinIcon filled={pinned} />
    </button>
  )
}

export const FolderIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16"><path d="M1.5 4.5a1 1 0 0 1 1-1h3.2l1.5 1.7h6.3a1 1 0 0 1 1 1v6.3a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" fill="currentColor" /></svg>
)
export const ChatIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16"><path d="M2.5 3h11a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H8l-3 2.5v-2.5H2.5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
)
