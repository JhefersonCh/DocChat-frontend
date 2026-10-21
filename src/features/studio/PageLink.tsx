import type { PageRef } from '@/domain/artifacts'
import { withAlias } from '@/domain/sources'
import { useSources } from '@/features/sources/SourcesContext'
import { useDoc } from './DocContext'
import { useOpenPage } from './useOpenPage'
import styles from './views.module.css'

/** "pág. N" button: reuses the citation seam, so the viewer jumps to the page (and highlights `quote` if given). */
export function PageLink({ pageRef, quote }: { pageRef: PageRef; quote?: string | null }) {
  const open = useOpenPage()
  const doc = useDoc()
  const sources = useSources()
  if (pageRef.page == null || !doc) return null
  const alias = sources.length > 1 ? (sources.find((s) => s.id === pageRef.document_id)?.alias ?? null) : null
  return (
    <button type="button" className={styles.page} aria-label={`Ir a la página ${pageRef.page}`} onClick={(e) => open(pageRef, quote, e.currentTarget)}>
      {withAlias(alias, `pág. ${pageRef.page}`)}
    </button>
  )
}
