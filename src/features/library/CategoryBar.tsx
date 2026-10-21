import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ApiClientError } from '@/api/client'
import { CATEGORY_COLORS, categoryColor, type Category, type LibraryFilters } from '@/domain/library'
import { Button } from '@/ui/Button'
import { ErrorNote } from '@/ui/ErrorNote'
import { fade } from '@/ui/motion'
import { useCategories, useCategoryActions } from './hooks'
import styles from './CategoryBar.module.css'

interface Props {
  filters: LibraryFilters
  onFilters: (next: LibraryFilters) => void
  total: number
}

function ManageRow({ category, onDone }: { category: Category; onDone: () => void }) {
  const { rename, remove } = useCategoryActions()
  const [name, setName] = useState(category.name)
  const [confirming, setConfirming] = useState(false)
  const save = () => {
    const next = name.trim()
    if (next && next !== category.name) rename.mutate({ id: category.id, name: next })
    else setName(category.name)
  }
  return (
    <li className={styles.row}>
      <span className={styles.swatches} role="group" aria-label={`Color de ${category.name}`}>
        {CATEGORY_COLORS.map((c) => (
          <button key={c} type="button" className={styles.swatch} data-on={categoryColor(category) === c} style={{ background: c }} aria-label={`Color ${c}`} onClick={() => rename.mutate({ id: category.id, color: c })} />
        ))}
      </span>
      <input className={styles.nameInput} value={name} maxLength={80} aria-label={`Renombrar ${category.name}`} onChange={(e) => setName(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
      <span className={styles.origin}>{category.origin === 'auto' ? 'auto' : 'tuya'}</span>
      {confirming ? (
        <span className={styles.confirm} role="group" aria-label={`Borrar ${category.name}`}>
          <button type="button" className={styles.yes} disabled={remove.isPending} onClick={() => remove.mutate(category.id, { onSuccess: onDone })}>Borrar</button>
          <button type="button" className={styles.no} onClick={() => setConfirming(false)} autoFocus>No</button>
        </span>
      ) : (
        <button type="button" className={styles.del} aria-label={`Borrar categoría ${category.name}`} onClick={() => setConfirming(true)}>×</button>
      )}
      {(rename.error || remove.error) && <ErrorNote error={(rename.error ?? remove.error) as ApiClientError} />}
    </li>
  )
}

/** Category filter chips + manage panel (create / rename / recolor / delete) + the auto-categorize button. */
export function CategoryBar({ filters, onFilters, total }: Props) {
  const categories = useCategories()
  const actions = useCategoryActions()
  const calm = useReducedMotion()
  const [managing, setManaging] = useState(false)
  const [name, setName] = useState('')
  const list = categories.data ?? []
  const selected = filters.category_id ?? null
  const pick = (next: Partial<LibraryFilters>) => onFilters({ ...filters, category_id: null, uncategorized: false, ...next })

  const create = () => {
    const value = name.trim()
    if (!value) return
    actions.create.mutate({ name: value, color: CATEGORY_COLORS[list.length % CATEGORY_COLORS.length] }, { onSuccess: () => setName('') })
  }
  const auto = actions.auto.data

  return (
    <section className={styles.bar} aria-label="Categorías">
      <div className={styles.chips}>
        <button type="button" className={styles.chip} data-on={!selected && !filters.uncategorized} onClick={() => pick({})}>Todas <span className={styles.n}>{total}</span></button>
        {list.map((c) => (
          <button key={c.id} type="button" className={styles.chip} data-on={selected === c.id} data-auto={c.origin === 'auto'} onClick={() => pick({ category_id: selected === c.id ? null : c.id })} title={c.origin === 'auto' ? 'Categoría automática' : 'Tu categoría'}>
            <span className={styles.dot} style={{ background: categoryColor(c) }} aria-hidden="true" />
            {c.name} <span className={styles.n}>{c.doc_count}</span>
          </button>
        ))}
        <button type="button" className={styles.chip} data-on={!!filters.uncategorized} onClick={() => pick({ uncategorized: !filters.uncategorized })}>Sin categoría</button>
      </div>
      <div className={styles.tools}>
        <Button onClick={() => setManaging((m) => !m)} aria-expanded={managing}>{managing ? 'Cerrar' : 'Gestionar categorías'}</Button>
        <Button disabled={actions.auto.isPending} onClick={() => actions.auto.mutate()} title="Agrupa los documentos por similitud y nombra los grupos. Solo toca las categorías automáticas.">
          {actions.auto.isPending ? 'Agrupando…' : '✦ Categorizar automáticamente'}
        </Button>
      </div>
      {actions.auto.error && <ErrorNote error={actions.auto.error as ApiClientError} />}
      {auto && (
        <p className={styles.report} role="status">
          {auto.categories.length > 0
            ? `${auto.categories.length} categorías automáticas sobre ${auto.clustered} documentos${auto.named_by_model ? '' : ' (nombres genéricos: sin modelo de chat)'}.`
            : (auto.note ?? 'Sin cambios.')}
          {auto.skipped_incompatible > 0 && ` ${auto.skipped_incompatible} documentos se omitieron: su perfil de embeddings tiene muy pocos documentos para agruparlos.`}
          {' '}Tus categorías y asignaciones no se tocaron.
        </p>
      )}
      <AnimatePresence initial={false}>
        {managing && (
          <motion.div className={styles.panel} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={calm ? { duration: 0.1 } : fade}>
            <form className={styles.newForm} onSubmit={(e) => { e.preventDefault(); create() }}>
              <input className={styles.nameInput} value={name} maxLength={80} placeholder="Nueva categoría…" aria-label="Nombre de la nueva categoría" onChange={(e) => setName(e.target.value)} />
              <Button variant="solid" type="submit" disabled={actions.create.isPending || !name.trim()}>Crear</Button>
            </form>
            {actions.create.error && <ErrorNote error={actions.create.error as ApiClientError} />}
            <ul className={styles.rows} aria-label="Categorías existentes">
              {list.map((c) => <ManageRow key={c.id} category={c} onDone={() => { if (selected === c.id) pick({}) }} />)}
              {list.length === 0 && <li className={styles.none}>Todavía no hay categorías.</li>}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
