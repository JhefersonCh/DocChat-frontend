import { motion, useReducedMotion } from 'motion/react'
import { Link } from 'react-router'
import { hitLocator, openLink, scorePct, type DocHit, type SearchResult } from '@/domain/library'
import { KIND_ICON, KIND_LABEL } from '@/domain/sources'
import { spring } from '@/ui/motion'
import { Thumb } from '@/ui/Thumb'
import { CategoryTags } from './CategoryTags'
import { Home } from './DocRow'
import styles from './ResultCard.module.css'

interface Props {
  rank: number
  result: SearchResult
  selected: boolean
  onToggle: () => void
}

function HitBlock({ result, hit, lead }: { result: SearchResult; hit: DocHit; lead: boolean }) {
  const doc = result.document
  const link = openLink(doc, hit)
  const where = hitLocator(hit)
  const body = (
    <>
      {hit.has_thumb && hit.chunk_id && <Thumb chunkId={hit.chunk_id} alt={`${doc.filename} ${where}`} width={lead ? 120 : 72} />}
      <span className={styles.hitText}>
        {where && <span className={styles.where}>{KIND_ICON[doc.kind]} {where}</span>}
        <span className={lead ? styles.snippet : styles.snippetSmall}>{hit.snippet || 'Sin texto: coincide por contenido visual o sonoro.'}</span>
      </span>
    </>
  )
  return link ? (
    <Link to={link} className={`${styles.hit} ${lead ? styles.lead : ''}`} aria-label={`Abrir ${doc.filename} ${where}`.trim()}>{body}</Link>
  ) : (
    <div className={`${styles.hit} ${lead ? styles.lead : ''}`}>{body}</div>
  )
}

/** A ranked document of the concept search: score bar, where it lives, categories and its best passages (each one opens its chat there). */
export function ResultCard({ rank, result, selected, onToggle }: Props) {
  const calm = useReducedMotion()
  const doc = result.document
  const [first, ...more] = result.hits
  return (
    <motion.li
      className={styles.card} data-selected={selected} data-weak={!result.relevant}
      layout="position" initial={{ opacity: 0, y: calm ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={calm ? { duration: 0.12 } : { ...spring, delay: Math.min(rank, 8) * 0.03 }}
    >
      <header className={styles.head}>
        <label className={styles.check}>
          <input type="checkbox" checked={selected} aria-label={`Seleccionar ${doc.filename}`} onChange={onToggle} />
        </label>
        <span className={styles.rank} aria-hidden="true">{String(rank).padStart(2, '0')}</span>
        <div className={styles.title}>
          <span className={styles.name} title={doc.filename}>{KIND_ICON[doc.kind]} {doc.filename}</span>
          <span className={styles.sub}>{KIND_LABEL[doc.kind]}{doc.page_count ? ` · ${doc.page_count} pág.` : ''}</span>
        </div>
        <Home doc={doc} />
        <span className={styles.score} role="img" aria-label={`Relevancia ${scorePct(result.score)}`}>
          <span className={styles.bar}><span className={styles.fill} style={{ width: scorePct(result.score) }} /></span>
          <span className={styles.pct}>{scorePct(result.score)}</span>
        </span>
      </header>
      {first ? <HitBlock result={result} hit={first} lead /> : doc.summary && <p className={styles.summary}>{doc.summary}</p>}
      {more.length > 0 && <div className={styles.more}>{more.map((h, i) => <HitBlock key={h.chunk_id ?? i} result={result} hit={h} lead={false} />)}</div>}
      <CategoryTags categories={doc.categories} />
    </motion.li>
  )
}
