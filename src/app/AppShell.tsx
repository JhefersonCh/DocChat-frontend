import { useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { SearchButton } from '@/features/search/SearchButton'
import { SearchPalette } from '@/features/search/SearchPalette'
import { useSearchShortcut } from '@/features/search/useSearchShortcut'
import { Sheet } from '@/ui/Sheet'
import { useIsPhone } from '@/ui/useMediaQuery'
import { Sidebar } from './Sidebar'
import styles from './AppShell.module.css'

export function AppShell() {
  const { pathname } = useLocation()
  const phone = useIsPhone()
  const [menuAt, setMenuAt] = useState<string | null>(null) // path the drawer was opened on: navigating closes it
  const menu = menuAt === pathname
  const content = useRef<HTMLDivElement>(null)
  const [searching, setSearching] = useState(false)
  useSearchShortcut(() => setSearching((o) => !o), () => setSearching(true))
  const route = pathname === '/' ? 'home' : pathname.startsWith('/settings') ? 'settings' : 'chat'

  return (
    <div className={styles.shell} data-route={route}>
      <a href="#content" className={styles.skip} onClick={(e) => { e.preventDefault(); content.current?.focus() }}>
        Saltar al contenido
      </a>
      {phone ? (
        <header className={styles.bar}>
          <button type="button" className={styles.menu} onClick={() => setMenuAt(pathname)} aria-label="Abrir lista de chats" aria-haspopup="dialog" aria-expanded={menu}>
            <span aria-hidden="true">≡</span>
          </button>
          <NavLink to="/" end className={styles.brand}>DocChat</NavLink>
          <span className={styles.barEnd}><SearchButton onClick={() => setSearching(true)} expanded={searching} /></span>
        </header>
      ) : (
        <>
          <div className={styles.sidebar}><Sidebar /></div>
          <header className={styles.topbar}><SearchButton onClick={() => setSearching(true)} expanded={searching} /></header>
        </>
      )}
      <div id="content" ref={content} tabIndex={-1} className={styles.content}><Outlet /></div>
      <SearchPalette open={searching} onClose={() => setSearching(false)} />
      {phone && <Sheet side="left" open={menu} onClose={() => setMenuAt(null)} label="Chats"><Sidebar /></Sheet>}
    </div>
  )
}
