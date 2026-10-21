import { useState } from 'react'
import type { ApiClientError } from '@/api/client'
import { KINDS, KIND_META, RUBRIC_PRESETS, type Artifact, type ArtifactKind, type RubricPreset } from '@/domain/artifacts'
import { parseColumns } from '@/domain/studio'
import type { Document } from '@/domain/types'
import { Button } from '@/ui/Button'
import { ErrorNote } from '@/ui/ErrorNote'
import { ConceptMapConfig } from './conceptmap/ConceptMapConfig'
import { SlidesConfig } from './slides/SlidesConfig'
import { ArtifactCard } from './ArtifactCard'
import { DocContext } from './DocContext'
import { useArtifacts, useCreateArtifact, useDeleteArtifact } from './hooks'
import styles from './Studio.module.css'

interface Props {
  chatId: string
  doc: Document | null
  goToSettings: () => void
}

/** Generated study material for the chat's document: pick a kind, it generates in the background, cards open inline. */
export function StudioPanel({ chatId, doc, goToSettings }: Props) {
  const list = useArtifacts(chatId)
  const create = useCreateArtifact(chatId)
  const remove = useDeleteArtifact(chatId)
  const [config, setConfig] = useState<'chart' | 'extraction' | 'rubric' | 'slides' | 'concept_map' | null>(null)
  const [preset, setPreset] = useState<RubricPreset>('general')
  const [text, setText] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const ready = doc?.status === 'ready'
  const columns = parseColumns(text)

  const start = (kind: ArtifactKind, options?: Artifact['options']) =>
    create.mutate({ kind, options }, { onSuccess: (a) => setOpen((s) => new Set(s).add(a.id)) })
  const pick = (kind: ArtifactKind) => {
    if (kind === 'chart' || kind === 'extraction' || kind === 'rubric' || kind === 'slides' || kind === 'concept_map') { setConfig(config === kind ? null : kind); setText(''); return }
    setConfig(null)
    start(kind)
  }
  const submit = () => {
    if (config === 'extraction' && columns.length) start('extraction', { columns })
    else if (config === 'rubric') start('rubric', { preset })
    else if (config === 'chart') start('chart', text.trim() ? { request: text.trim() } : undefined)
    else return
    setConfig(null)
    setText('')
  }
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n })

  return (
    <DocContext.Provider value={doc}>
      <div className={styles.panel}>
        <div className={styles.scroll}>
          {!ready && <p className={styles.state}>El material de estudio se genera cuando el documento está listo.</p>}
          <ul className={styles.kinds} aria-label="Generar material">
            {KINDS.map((k) => (
              <li key={k}>
                <button type="button" className={styles.kind} disabled={!ready || create.isPending} aria-expanded={k === config ? true : undefined} onClick={() => pick(k)}>
                  <span>{KIND_META[k].label}</span>
                  <small>{KIND_META[k].hint}</small>
                </button>
              </li>
            ))}
          </ul>
          {config === 'slides' && (
            <SlidesConfig chatId={chatId} busy={create.isPending} onCancel={() => setConfig(null)} onGenerate={(o) => { start('slides', o); setConfig(null) }} />
          )}
          {config === 'concept_map' && (
            <ConceptMapConfig busy={create.isPending} onCancel={() => setConfig(null)} onGenerate={(o) => { start('concept_map', o); setConfig(null) }} />
          )}
          {config && config !== 'slides' && config !== 'concept_map' && (
            <form className={styles.config} onSubmit={(e) => { e.preventDefault(); submit() }}>
              {config === 'rubric' ? (
                <>
                  <label className={styles.label} htmlFor="studio-preset">Tipo de documento a evaluar</label>
                  <select id="studio-preset" className={styles.input} value={preset} onChange={(e) => setPreset(e.target.value as RubricPreset)}>
                    {RUBRIC_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </>
              ) : (
                <>
                  <label className={styles.label} htmlFor="studio-input">
                    {config === 'extraction' ? 'Columnas a extraer (separadas por coma)' : 'Qué graficar (opcional)'}
                  </label>
                  <input
                    id="studio-input" className={styles.input} value={text} onChange={(e) => setText(e.target.value)} autoFocus
                    placeholder={config === 'extraction' ? 'Nombre, Fecha, Monto total' : 'Ej.: ventas por año'}
                  />
                </>
              )}
              <Button type="submit" variant="solid" disabled={create.isPending || (config === 'extraction' && !columns.length)}>Generar</Button>
            </form>
          )}
          {create.error && <ErrorNote error={create.error as ApiClientError} handlers={{ goToSettings }} />}
          {list.error && <ErrorNote error={list.error as ApiClientError} handlers={{ retry: () => void list.refetch() }} />}
          <ul className={styles.cards}>
            {list.data?.map((a) => (
              <ArtifactCard
                key={a.id} chatId={chatId} artifact={a} open={open.has(a.id)} busy={create.isPending}
                onToggle={() => toggle(a.id)} onDelete={() => remove.mutate(a.id)}
                onRetry={() => { start(a.kind, a.options); remove.mutate(a.id) }}
              />
            ))}
          </ul>
          {list.data?.length === 0 && ready && <p className={styles.state}>Todavía no generaste nada. Elegí un formato.</p>}
        </div>
      </div>
    </DocContext.Provider>
  )
}
