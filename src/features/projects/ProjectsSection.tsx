import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { NavLink, useMatch, useNavigate } from 'react-router'
import type { ApiClientError } from '@/api/client'
import { FolderIcon, MoreToggle, PinButton, SidebarSection } from '@/app/SidebarSection'
import { PinMark } from '@/app/pinMarks'
import { pickVisible, pinMarkBefore } from '@/app/sidebarSection'
import { CATEGORY_COLORS } from '@/domain/library'
import { ErrorNote } from '@/ui/ErrorNote'
import { fade, spring } from '@/ui/motion'
import { useCreateProject, usePinProject, useProjects } from './hooks'
import styles from './ProjectsSection.module.css'

const LIMIT = 3
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Sidebar "Proyectos": the 3 most recent as cards (+ "Ver más"), with an inline "new project" form. */
export function ProjectsSection() {
  const projects = useProjects()
  const create = useCreateProject()
  const pin = usePinProject()
  const navigate = useNavigate()
  const calm = useReducedMotion()
  const activeId = useMatch('/projects/:id')?.params.id
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [name, setName] = useState('')
  const all = projects.data ?? []
  const shown = pickVisible(all, LIMIT, expanded, activeId)

  const submit = () => {
    const value = name.trim()
    if (!value) return
    const color = CATEGORY_COLORS[all.length % CATEGORY_COLORS.length]
    create.mutate({ name: value, color }, { onSuccess: (p) => { setName(''); setOpen(false); navigate(`/projects/${p.id}`) } })
  }

  return (
    <SidebarSection storageKey="projects" title="Proyectos" icon={<FolderIcon />} count={projects.data ? all.length : undefined} addLabel="Nuevo proyecto" addPressed={open} onAdd={() => setOpen((o) => !o)}>
      <AnimatePresence initial={false}>
        {open && (
          <motion.form
            className={styles.form} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            transition={calm ? { duration: 0.1 } : fade} onSubmit={(e) => { e.preventDefault(); submit() }}
          >
            <input className={styles.input} value={name} maxLength={80} placeholder="Nombre del proyecto" aria-label="Nombre del proyecto" autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }} />
            <button type="submit" className={styles.ok} disabled={create.isPending || !name.trim()}>Crear</button>
          </motion.form>
        )}
      </AnimatePresence>
      {create.error && <ErrorNote error={create.error as ApiClientError} />}
      {projects.error && <ErrorNote error={projects.error as ApiClientError} handlers={{ retry: () => void projects.refetch() }} />}
      <ul className={styles.list} aria-label="Lista de proyectos">
        <AnimatePresence initial={false}>
          {shown.flatMap((p, i) => {
            const color = p.color ?? 'var(--amber)'
            const meta = `${plural(p.source_count, 'fuente', 'fuentes')} · ${plural(p.chat_count, 'chat', 'chats')}`
            return [
              ...((m) => (m ? [<PinMark key={m} kind={m} />] : []))(pinMarkBefore(shown[i - 1], p, i)),
              <motion.li key={p.id} layout={calm ? false : 'position'} className={styles.row} initial={{ opacity: 0, x: calm ? 0 : -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: calm ? 0 : -16 }} transition={calm ? { duration: 0.12 } : { ...spring, opacity: fade }}>
                <NavLink to={`/projects/${p.id}`} className={({ isActive }) => `${styles.card} ${isActive ? styles.active : ''}`} style={{ ['--accent' as string]: color }} title={`${p.name} · ${meta}`}>
                  <span className={styles.glyph} aria-hidden="true"><FolderIcon /></span>
                  <span className={styles.info}>
                    <span className={styles.name}>{p.name}</span>
                    <span className={styles.meta}>{meta}</span>
                  </span>
                </NavLink>
                <PinButton className={styles.pinBtn} pinned={!!p.pinned_at} noun="proyecto" name={p.name} onToggle={() => pin.mutate({ id: p.id, pinned: !p.pinned_at })} />
              </motion.li>,
            ]
          })}
        </AnimatePresence>
      </ul>
      {all.length > LIMIT && <MoreToggle expanded={expanded} hidden={all.length - LIMIT} onClick={() => setExpanded((e) => !e)} />}
      {projects.data?.length === 0 && !open && <p className={styles.empty}>Agrupá fuentes y chats en un proyecto.</p>}
    </SidebarSection>
  )
}
