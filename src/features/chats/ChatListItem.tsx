import { useState } from 'react'
import { Link } from 'react-router'
import type { Chat } from '@/domain/types'
import { ChatIcon, PinButton } from '@/app/SidebarSection'
import styles from './ChatListItem.module.css'

const full = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto', style: 'narrow' })

/** "hace 5 min", "hace 3 h", "ayer", "hace 4 d", then a short date. */
function relativeTime(iso: string, now = Date.now()): string {
  const min = Math.round((new Date(iso).getTime() - now) / 60000)
  if (min > -1) return 'ahora'
  if (min > -60) return rtf.format(min, 'minute')
  if (min > -1440) return rtf.format(Math.round(min / 60), 'hour')
  if (min > -1440 * 7) return rtf.format(Math.round(min / 1440), 'day')
  return new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short' }).format(new Date(iso))
}

interface Props {
  chat: Chat
  active: boolean
  deleting: boolean
  onDelete: () => void
  onTogglePin: () => void
}

export function ChatListItem({ chat, active, deleting, onDelete, onTogglePin }: Props) {
  const [confirming, setConfirming] = useState(false)
  const title = chat.title || 'Nuevo chat'

  if (confirming) {
    return (
      <div className={styles.confirm} role="group" aria-label={`Borrar ${title}`}>
        <span className={styles.ask}>¿Borrar chat, documento y mensajes?</span>
        <div className={styles.confirmBtns}>
          <button type="button" className={styles.yes} disabled={deleting} onClick={onDelete}>Sí, borrar</button>
          <button type="button" className={styles.no} onClick={() => setConfirming(false)} autoFocus>No</button>
        </div>
      </div>
    )
  }
  return (
    <div className={`${styles.item} ${active ? styles.active : ''}`}>
      <Link to={`/chats/${chat.id}`} className={styles.link} title={title} aria-current={active ? 'page' : undefined}>
        <span className={`${styles.glyph} ${chat.title ? '' : styles.blank}`} aria-hidden="true"><ChatIcon /></span>
        <span className={styles.text}>
          <span className={`${styles.title} ${chat.title ? '' : styles.untitled}`}>{title}</span>
          {(chat.source_count ?? 0) > 1 && <span className={styles.count}>{chat.source_count} fuentes</span>}
        </span>
        <time className={styles.when} dateTime={chat.created_at} title={full.format(new Date(chat.created_at))}>{relativeTime(chat.created_at)}</time>
      </Link>
      <PinButton pinned={!!chat.pinned_at} noun="chat" name={title} onToggle={onTogglePin} />
      <button type="button" className={styles.del} aria-label={`Borrar ${title}`} onClick={() => setConfirming(true)}>×</button>
    </div>
  )
}
