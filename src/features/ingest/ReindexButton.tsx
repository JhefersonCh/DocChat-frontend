import type { ApiClientError } from '@/api/client'
import { isInFlight } from '@/domain/ingest'
import type { Document } from '@/domain/types'
import { Button } from '@/ui/Button'
import { ErrorNote } from '@/ui/ErrorNote'
import { useReindexDocument } from './hooks'
import styles from './ReindexButton.module.css'

/** Re-runs extraction + chunking + embeddings on the stored file. Disabled while the document is in flight. */
export function ReindexButton({ chatId, doc }: { chatId: string; doc: Document }) {
  const reindex = useReindexDocument(chatId)
  const busy = isInFlight(doc.status) || reindex.isPending
  return (
    <div className={styles.wrap}>
      <Button
        disabled={busy}
        onClick={() => reindex.mutate(doc.id)}
        title="Volver a extraer y generar los embeddings del archivo guardado"
      >
        {busy ? 'Re-indexando…' : 'Re-indexar'}
      </Button>
      {reindex.error && <ErrorNote error={reindex.error as ApiClientError} />}
    </div>
  )
}
