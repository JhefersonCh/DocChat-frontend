import { Link } from 'react-router'
import { KIND_ICON, KIND_LABEL } from '@/domain/sources'
import { formatTime } from '@/domain/time'
import { openLink, type LibraryDoc } from '@/domain/library'
import { CategoryTags } from './CategoryTags'
import styles from './DocRow.module.css'

interface Props {
  doc: LibraryDoc
  selected: boolean
  onToggle: () => void
  onUnassign: (categoryId: string) => void
}

const STATUS: Record<LibraryDoc['status'], string | null> = { ready: null, pending: 'en cola', processing: 'procesando', failed: 'falló' }

/** Where the document lives: its project (page) or its own chat. */
export function Home({ doc }: { doc: LibraryDoc }) {
  const link = openLink(doc)
  if (doc.project_id) {
    return <Link to={`/projects/${doc.project_id}`} className={styles.home}><span aria-hidden="true">◧</span><span className={styles.homeName}>{doc.project_name}</span></Link>
  }
  return link ? <Link to={link} className={styles.home}><span aria-hidden="true">▭</span>Chat</Link> : <span className={styles.homeOff}>Sin chat</span>
}

export function DocRow({ doc, selected, onToggle, onUnassign }: Props) {
  const status = STATUS[doc.status]
  const link = openLink(doc)
  const bits = [KIND_LABEL[doc.kind], doc.page_count ? `${doc.page_count} pág.` : null, doc.duration_s ? formatTime(doc.duration_s) : null].filter(Boolean)
  return (
    <li className={styles.row} data-selected={selected} data-failed={doc.status === 'failed'}>
      <label className={styles.check}>
        <input type="checkbox" checked={selected} disabled={doc.status !== 'ready'} aria-label={`Seleccionar ${doc.filename}`} onChange={onToggle} />
      </label>
      <span className={styles.glyph} aria-hidden="true">{KIND_ICON[doc.kind]}</span>
      <div className={styles.main}>
        {link ? <Link to={link} className={styles.name} title={doc.filename}>{doc.filename}</Link> : <span className={styles.name}>{doc.filename}</span>}
        <span className={styles.meta}>
          {bits.join(' · ')}
          {status && <span className={styles.status} data-failed={doc.status === 'failed'}> · {status}</span>}
        </span>
        <CategoryTags categories={doc.categories} onRemove={onUnassign} />
      </div>
      <Home doc={doc} />
    </li>
  )
}
