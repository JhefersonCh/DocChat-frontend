import { useEffect, useRef } from 'react'

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

/** Ctrl/Cmd+K toggles from anywhere; "/" opens only when the user is not typing somewhere. */
export function useSearchShortcut(toggle: () => void, open: () => void) {
  const fns = useRef({ toggle, open })
  useEffect(() => { fns.current = { toggle, open } })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); fns.current.toggle(); return }
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(e.target)) { e.preventDefault(); fns.current.open() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
