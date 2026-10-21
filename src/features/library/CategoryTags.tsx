import { categoryColor, type CategoryRef } from '@/domain/library'
import styles from './CategoryTags.module.css'

/** Category chips of a document; the × removes the assignment (a user one or an automatic one). */
export function CategoryTags({ categories, onRemove }: { categories: CategoryRef[]; onRemove?: (id: string) => void }) {
  if (categories.length === 0) return null
  return (
    <ul className={styles.tags} aria-label="Categorías">
      {categories.map((c) => (
        <li key={c.id} className={styles.tag} data-auto={c.origin === 'auto'} title={c.origin === 'auto' ? 'Automática' : 'Asignada por vos'}>
          <span className={styles.dot} style={{ background: categoryColor(c) }} aria-hidden="true" />
          {c.name}
          {onRemove && <button type="button" className={styles.x} aria-label={`Quitar categoría ${c.name}`} onClick={() => onRemove(c.id)}>×</button>}
        </li>
      ))}
    </ul>
  )
}
