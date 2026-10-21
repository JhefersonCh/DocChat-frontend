import { NavLink } from 'react-router'
import { ChatList } from '@/features/chats/ChatList'
import { ProjectsSection } from '@/features/projects/ProjectsSection'
import { HealthIndicator } from '@/features/providers/HealthIndicator'
import logo from '../../public/logo.png'
import styles from './Sidebar.module.css'

export function Sidebar() {
  return (
    <aside className={styles.sidebar} aria-label="Chats">
      <NavLink to="/" end className={`${styles.brand} rise`} aria-label="DocChat, inicio">
        <img src={logo} alt="Logo" width={100} />
      </NavLink>
      <div className={`${styles.list} rise`} style={{ ['--d' as string]: 1 }}>
        <NavLink to="/library" className={({ isActive }) => `${styles.lib} ${isActive ? styles.libOn : ''}`} title="Biblioteca">
          <span className={styles.libGlyph} aria-hidden="true">▦</span><span className={styles.libText}>Biblioteca</span><span className={styles.libArrow} aria-hidden="true">→</span>
        </NavLink>
        <div className={styles.sections}>
          <ProjectsSection />
          <hr className={styles.rule} />
          <ChatList />
        </div>
      </div>
      <footer className={`${styles.foot} rise`} style={{ ['--d' as string]: 2 }}>
        <NavLink to="/settings" className={({ isActive }) => `${styles.cfg} ${isActive ? styles.on : ''}`} title="Configuración">
          <span aria-hidden="true">⚙</span><span className={styles.cfgText}>Configuración</span>
        </NavLink>
        <HealthIndicator />
      </footer>
    </aside>
  )
}
