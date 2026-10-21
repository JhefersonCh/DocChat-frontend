import { forwardRef } from 'react'
import styles from './SearchButton.module.css'

export const MagnifierIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
    <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5 14 14" />
  </svg>
)

/** Magnifier at the top-right of the app header; on desktop it also shows the shortcut. */
export const SearchButton = forwardRef<HTMLButtonElement, { onClick: () => void; expanded: boolean }>(function SearchButton({ onClick, expanded }, ref) {
  return (
    <button ref={ref} type="button" className={styles.btn} onClick={onClick} aria-label="Buscar en todos los chats" aria-haspopup="dialog" aria-expanded={expanded} aria-keyshortcuts="Control+K Meta+K">
      <MagnifierIcon />
      <span className={styles.label}>Buscar</span>
      <kbd className={styles.kbd} aria-hidden="true">Ctrl K</kbd>
    </button>
  )
})
