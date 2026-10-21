import { Link } from 'react-router'
import { useProjects } from './hooks'
import styles from './ProjectCrumb.module.css'

/** "← Proyecto X": the way back from a project's chat to its page. Renders nothing for a loose chat. */
export function ProjectCrumb({ projectId }: { projectId: string | null | undefined }) {
  const projects = useProjects()
  if (!projectId) return null
  const project = projects.data?.find((p) => p.id === projectId)
  return (
    <Link to={`/projects/${projectId}`} className={styles.crumb}>
      <span aria-hidden="true">←</span>
      <span className={styles.dot} style={{ background: project?.color ?? 'var(--amber)' }} aria-hidden="true" />
      <span className={styles.name}>Proyecto{project ? ` · ${project.name}` : ''}</span>
    </Link>
  )
}
