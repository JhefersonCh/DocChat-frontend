import { useState, type DragEvent, type ReactNode } from 'react'
import { prepareUpload } from '@/domain/ingest'
import { useAddSources } from './hooks'
import styles from './DropToAdd.module.css'

/** Dropping files anywhere over the viewer adds them as sources of the chat. */
export function DropToAdd({ chatId, children, className }: { chatId: string; children: ReactNode; className?: string }) {
  const add = useAddSources(chatId)
  const [over, setOver] = useState(false)
  const hasFiles = (e: DragEvent) => [...e.dataTransfer.types].includes('Files')
  return (
    <div
      className={`${styles.zone} ${className ?? ''}`} data-over={over}
      onDragOver={(e) => { if (hasFiles(e)) { e.preventDefault(); setOver(true) } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false) }}
      onDrop={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault(); setOver(false)
        const files = [...e.dataTransfer.files].map(prepareUpload).flatMap((p) => (p.ok ? [p.file] : []))
        if (files.length) add.mutate(files)
      }}
    >
      {children}
      {over && <p className={styles.overlay} role="status">Soltá para agregar como fuente</p>}
    </div>
  )
}
