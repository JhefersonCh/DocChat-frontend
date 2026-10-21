import type { Document } from '@/domain/types'
import { useSources } from '@/features/sources/SourcesContext'
import { useTrace } from '@/features/conversation/TraceContext'
import styles from './tutor.module.css'

interface Props { doc: Document; sourceId?: string | null; page: number | null; chunkId: string | null; quote: string; label?: string }

/** Opens the source in the viewer through the trace seam and highlights the quote. */
export function SourceLink({ doc: main, sourceId, page, chunkId, quote, label = 'ver en el PDF' }: Props) {
  const { onCiteSelect } = useTrace()
  const doc = useSources().find((s) => s.id === sourceId) ?? main // the point's own source, else the chat's main one
  return (
    <button
      type="button" className={styles.source}
      onClick={(e) => onCiteSelect(
        { n: 0, origin: 'studio', document_id: doc.id, filename: doc.filename, page, snippet: quote, chunk_id: chunkId, page_end: page, content: quote },
        { origin: e.currentTarget },
      )}
    >
      {label}{page != null && ` · pág. ${page}`}
    </button>
  )
}
