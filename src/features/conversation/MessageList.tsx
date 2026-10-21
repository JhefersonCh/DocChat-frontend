import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import styles from './Conversation.module.css'

/** Scroll area that follows the stream only while the reader is at the bottom. */
export function MessageList({ children, tick }: { children: ReactNode; tick: number }) {
  const end = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)

  useEffect(() => {
    const el = end.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { atBottom.current = !!e?.isIntersecting }, { rootMargin: '0px 0px 96px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useLayoutEffect(() => {
    if (atBottom.current) end.current?.scrollIntoView({ block: 'end' })
  }, [tick])

  return (
    <div className={styles.list}>
      <div className={styles.items}>{children}</div>
      <div ref={end} aria-hidden="true" />
    </div>
  )
}
