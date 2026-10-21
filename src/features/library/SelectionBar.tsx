import { motion, useReducedMotion } from 'motion/react'
import { useNavigate } from 'react-router'
import type { ApiClientError } from '@/api/client'
import { MAX_SOURCES } from '@/domain/sources'
import { Button } from '@/ui/Button'
import { ErrorNote } from '@/ui/ErrorNote'
import { CompatBanner } from '@/features/sources/compat'
import { useSelectionCompat } from '@/features/sources/useCompat'
import { springSheet } from '@/ui/motion'
import { useAskDocuments, useCategories, useCategoryActions } from './hooks'
import styles from './SelectionBar.module.css'

interface Props { ids: string[]; onClear: () => void }

/** Bottom bar while documents are selected: file them under a category or "Preguntar a estos documentos" (a new chat / project with copies). */
export function SelectionBar({ ids, onClear }: Props) {
  const navigate = useNavigate()
  const calm = useReducedMotion()
  const ask = useAskDocuments()
  const categories = useCategories()
  const { assign } = useCategoryActions()
  const tooMany = ids.length > MAX_SOURCES
  const compat = useSelectionCompat(ids)
  const go = (mode: 'chat' | 'project') =>
    ask.mutate({ ids, mode }, { onSuccess: (r) => { onClear(); navigate(`/chats/${r.chat_id}`) } })
  return (
    <motion.div
      className={styles.bar} role="region" aria-label="Documentos seleccionados"
      initial={{ opacity: 0, y: calm ? 0 : 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: calm ? 0 : 24 }} transition={calm ? { duration: 0.12 } : springSheet}
    >
      <span className={styles.count}><b>{ids.length}</b> {ids.length === 1 ? 'seleccionado' : 'seleccionados'}</span>
      <select className={styles.select} value="" aria-label="Asignar a una categoría" disabled={assign.isPending || !categories.data?.length} onChange={(e) => { if (e.target.value) assign.mutate({ id: e.target.value, documentIds: ids }) }}>
        <option value="">{categories.data?.length ? 'Asignar categoría…' : 'Sin categorías'}</option>
        {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <span className={styles.group}>
        <Button variant="solid" disabled={ask.isPending || tooMany} title={tooMany ? `Hasta ${MAX_SOURCES} documentos` : 'Copia los documentos a un chat nuevo y se reindexan'} onClick={() => go('chat')}>
          {ask.isPending ? 'Creando…' : 'Preguntar a estos documentos'}
        </Button>
        <Button disabled={ask.isPending || tooMany} title="Crea un proyecto con copias de estos documentos" onClick={() => go('project')}>En un proyecto</Button>
      </span>
      <Button onClick={onClear} aria-label="Limpiar selección">✕</Button>
      <CompatBanner compat={compat} label={(s) => `«${s.filename}»`} className={styles.err} />
      {(ask.error || assign.error) && <div className={styles.err}><ErrorNote error={(ask.error ?? assign.error) as ApiClientError} /></div>}
    </motion.div>
  )
}
