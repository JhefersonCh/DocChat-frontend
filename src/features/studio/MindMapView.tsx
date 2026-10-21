import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { MindMapData, MindNode } from '@/domain/artifacts'
import { ease } from '@/ui/motion'
import { PageLink } from './PageLink'
import styles from './views.module.css'

function Node({ node, depth }: { node: MindNode; depth: number }) {
  const [open, setOpen] = useState(depth < 2)
  const has = node.children.length > 0
  return (
    <li className={styles.node}>
      <div className={styles.nodeRow}>
        {has ? (
          <button type="button" className={styles.toggle} aria-expanded={open} aria-label={`${open ? 'Contraer' : 'Expandir'} ${node.title}`} onClick={() => setOpen(!open)}>
            <span data-open={open} aria-hidden="true">▸</span>
          </button>
        ) : <span className={styles.leaf} aria-hidden="true">·</span>}
        <span className={styles.nodeTitle} data-root={depth === 0}>{node.title}</span>
        <PageLink pageRef={node} />
      </div>
      <AnimatePresence initial={false}>
        {has && open && (
          <motion.ul
            className={styles.tree} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease }}
          >
            {node.children.map((c, i) => <Node key={i} node={c} depth={depth + 1} />)}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  )
}

export function MindMapView({ data }: { data: MindMapData }) {
  return <ul className={`${styles.tree} ${styles.rootTree}`}><Node node={data.root} depth={0} /></ul>
}
