import { motion, useReducedMotion } from 'motion/react'
import type { ConceptLink, ConceptMapData, ConceptNode, SlideRef } from '@/domain/artifacts'
import { connections } from '@/domain/conceptMap'
import { refLabel } from '@/domain/slides'
import { Button } from '@/ui/Button'
import { ease } from '@/ui/motion'
import { useAliasOf, useOpenRef } from '../useOpenRef'
import styles from './conceptmap.module.css'

function Chips({ refs }: { refs: SlideRef[] }) {
  const open = useOpenRef()
  const aliasOf = useAliasOf()
  if (!refs.length) return null
  return (
    <div className={styles.chips} role="group" aria-label="Fuentes">
      {refs.map((r, i) => {
        const label = refLabel(r, aliasOf(r.document_id))
        return (
          <button key={i} type="button" className={styles.chip} title={`«${r.quote}»`} aria-label={`Abrir fuente ${label}`} onClick={(e) => open(r, e.currentTarget)}>
            {label}
          </button>
        )
      })}
    </div>
  )
}

interface NodeProps {
  data: ConceptMapData
  node: ConceptNode
  folded: boolean | null // null: leaf
  expanding: boolean
  error: string | null
  askFailed: boolean
  onSelect: (id: string) => void
  onSelectLink: (id: string) => void
  onAsk: () => void
  onExpand: () => void
  onCenter: () => void
  onToggle: () => void
  onClose: () => void
}

function Shell({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <motion.aside
      className={styles.card} aria-label={label}
      initial={reduce ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? undefined : { opacity: 0, x: 16 }}
      transition={{ duration: 0.2, ease }}
    >
      <button type="button" className={styles.close} aria-label="Cerrar detalle" onClick={onClose}>×</button>
      {children}
    </motion.aside>
  )
}

export function NodeCard({ data, node, folded, expanding, error, askFailed, onSelect, onSelectLink, onAsk, onExpand, onCenter, onToggle, onClose }: NodeProps) {
  const links = connections(data, node.id)
  return (
    <Shell label={`Detalle de ${node.label}`} onClose={onClose}>
      <p className={styles.kicker}>{node.kind === 'ejemplo' ? 'Ejemplo' : node.id === data.root_id ? 'Concepto central' : `Concepto · nivel ${node.level}`}</p>
      <h4 className={styles.cardName}>{node.label}</h4>
      {node.summary && <p className={styles.cardText}>{node.summary}</p>}
      {!!node.aliases?.length && <p className={styles.meta}>También: {node.aliases.join(', ')}</p>}
      <Chips refs={node.refs} />
      {links.length > 0 && (
        <ul className={styles.props} aria-label="Proposiciones">
          {links.map(({ link, other, outgoing }) => (
            <li key={link.id}>
              <button type="button" onClick={() => onSelectLink(link.id)} aria-label={`Ver proposición ${outgoing ? node.label : other.label} ${link.label} ${outgoing ? other.label : node.label}`}>
                <span className={styles.dir} aria-hidden="true">{outgoing ? '→' : '←'}</span>
                <em>{link.label}</em>
              </button>
              <button type="button" className={styles.other} onClick={() => onSelect(other.id)}>{other.label}</button>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.actions}>
        <Button variant="solid" onClick={onAsk}>Preguntar sobre esto</Button>
        <Button onClick={onExpand} disabled={expanding || node.kind === 'ejemplo'}>{expanding ? 'Expandiendo…' : 'Expandir'}</Button>
        <Button onClick={onCenter}>Centrar aquí</Button>
        {folded !== null && <Button onClick={onToggle}>{folded ? 'Mostrar rama' : 'Ocultar rama'}</Button>}
      </div>
      {expanding && <p className={styles.meta} role="status">Buscando subconceptos en las fuentes…</p>}
      {error && <p className={styles.err} role="alert">{error}</p>}
      {askFailed && <p className={styles.meta} role="status">No se puede preguntar ahora (¿hay una respuesta en curso?).</p>}
    </Shell>
  )
}

interface EdgeProps {
  data: ConceptMapData
  link: ConceptLink
  onSelect: (id: string) => void
  onClose: () => void
}

export function EdgeCard({ data, link, onSelect, onClose }: EdgeProps) {
  const byId = new Map(data.nodes.map((n) => [n.id, n]))
  const a = byId.get(link.source)
  const b = byId.get(link.target)
  return (
    <Shell label="Detalle de la proposición" onClose={onClose}>
      <p className={styles.kicker}>{link.kind === 'cruce' ? 'Relación entre ramas' : 'Proposición'}</p>
      <p className={styles.prop} aria-label={`${a?.label} ${link.label} ${b?.label}`}>
        <button type="button" onClick={() => a && onSelect(a.id)}>{a?.label}</button>
        <span className={styles.arrow}> — <em>{link.label}</em> → </span>
        <button type="button" onClick={() => b && onSelect(b.id)}>{b?.label}</button>
      </p>
      {link.refs.map((r, i) => <q key={i} className={styles.quote}>{r.quote}</q>)}
      <Chips refs={link.refs} />
    </Shell>
  )
}
