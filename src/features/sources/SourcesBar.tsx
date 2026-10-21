import { useRef, useState } from 'react'
import type { ApiClientError } from '@/api/client'
import { ACCEPT_ATTR, prepareUpload } from '@/domain/ingest'
import { KIND_ICON, KIND_LABEL, MAX_SOURCES, kindOf, sourceStatus, toggleActive } from '@/domain/sources'
import type { Source } from '@/domain/types'
import { isFlagged, type Compatibility, type SourceCompat } from '@/domain/compat'
import { ErrorNote } from '@/ui/ErrorNote'
import { PasteTextModal } from './PasteTextModal'
import { CompatBanner, CompatMark } from './compat'
import { useAddSources, useRemoveSource, useSetActiveSources } from './hooks'
import styles from './SourcesBar.module.css'

interface ChipProps {
  source: Source
  sources: Source[]
  selected: boolean
  onSelect: () => void
  chatId: string
  compat?: SourceCompat
}

function SourceChip({ source, sources, selected, onSelect, chatId, compat }: ChipProps) {
  const remove = useRemoveSource(chatId)
  const setActive = useSetActiveSources(chatId)
  const [confirming, setConfirming] = useState(false)
  const multi = sources.length > 1
  const kind = kindOf(source)
  const status = sourceStatus(source)
  const busy = source.status === 'pending' || source.status === 'processing'
  const label = multi ? `${source.alias} ${source.filename}` : source.filename

  if (confirming) {
    return (
      <li className={styles.chip} data-confirming="true">
        <span className={styles.ask}>¿Quitar «{source.filename}»?</span>
        <button type="button" className={styles.danger} disabled={remove.isPending} onClick={() => remove.mutate(source.id, { onSettled: () => setConfirming(false) })}>Quitar</button>
        <button type="button" className={styles.ghost} onClick={() => setConfirming(false)} autoFocus>No</button>
      </li>
    )
  }
  return (
    <li className={styles.chip} data-selected={selected} data-active={source.active} data-failed={source.status === 'failed'} data-busy={busy} data-warn={isFlagged(compat)}>
      <button type="button" className={styles.main} aria-current={selected ? 'true' : undefined} aria-label={`${label}${status ? `, ${status}` : ''}`} title={`${KIND_LABEL[kind]} · ${source.filename}`} onClick={onSelect}>
        <span className={styles.icon} aria-hidden="true">{KIND_ICON[kind]}</span>
        {multi && <span className={styles.alias}>{source.alias}</span>}
        <span className={styles.name}>{source.filename}</span>
        {status && <span className={styles.status} data-failed={source.status === 'failed'}>{status}</span>}
        {isFlagged(compat) && <CompatMark compat={compat} />}
      </button>
      {multi && (
        <label className={styles.toggle} title={source.active ? 'Se usa en las respuestas' : 'Silenciada: no se usa en las respuestas'}>
          <input
            type="checkbox" checked={source.active} disabled={source.status !== 'ready'}
            aria-label={`Usar ${label} en las respuestas`}
            onChange={() => { const ids = toggleActive(sources, source.id); if (ids) setActive.mutate(ids) }}
          />
        </label>
      )}
      <button type="button" className={styles.x} aria-label={`Quitar ${label}`} onClick={() => setConfirming(true)}>×</button>
    </li>
  )
}

interface Props {
  chatId: string
  sources: Source[]
  selectedId: string | null
  onSelect: (id: string) => void
  compat?: Compatibility
}

/** The chat's sources: one chip each (kind, alias, state/progress, active toggle, remove) + add. A chip is also the viewer's tab. */
export function SourcesBar({ chatId, sources, selectedId, onSelect, compat }: Props) {
  const bySource = new Map((compat?.sources ?? []).map((c) => [c.document_id, c]))
  const input = useRef<HTMLInputElement>(null)
  const add = useAddSources(chatId)
  const [rejected, setRejected] = useState(false)
  const [pasting, setPasting] = useState(false)
  const full = sources.length >= MAX_SOURCES

  const pick = (files: FileList | null) => {
    setRejected(false)
    const ok = [...(files ?? [])].map(prepareUpload).flatMap((p) => (p.ok ? [p.file] : []))
    if ((files?.length ?? 0) > ok.length) setRejected(true)
    if (ok.length) add.mutate(ok)
  }
  const readable = sources.filter((s) => s.status === 'ready' && s.active).length

  return (
    <div className={styles.bar} data-multi={sources.length > 1}>
      <ul className={styles.list} aria-label="Fuentes del chat">
        {sources.map((s) => (
          <SourceChip key={s.id} source={s} sources={sources} selected={s.id === selectedId} onSelect={() => onSelect(s.id)} chatId={chatId} compat={bySource.get(s.id)} />
        ))}
        <li className={styles.addItem}>
          <button type="button" className={styles.add} disabled={add.isPending || full} onClick={() => input.current?.click()} title={full ? `Máximo ${MAX_SOURCES} fuentes` : 'Agregar PDF, texto, imagen, audio o video (también podés arrastrarlos acá)'}>
            {add.isPending ? 'Subiendo…' : '+ Agregar fuente'}
          </button>
        </li>
        <li className={styles.addItem}>
          <button type="button" className={styles.add} disabled={add.isPending || full} onClick={() => setPasting(true)} title="Pegar texto como fuente">Pegar texto</button>
        </li>
      </ul>
      <PasteTextModal open={pasting} busy={add.isPending} onClose={() => setPasting(false)} onSubmit={(file) => add.mutate([file], { onSettled: () => setPasting(false) })} />
      <input ref={input} type="file" multiple hidden accept={ACCEPT_ATTR} onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
      <CompatBanner compat={compat} />
      {sources.length > 1 && <p className={styles.hint} role="status">Leyendo {readable} de {sources.length} fuentes</p>}
      {rejected && <p className={styles.hint} role="alert">Algún archivo no es de un tipo admitido y se omitió.</p>}
      {add.error && <ErrorNote error={add.error as ApiClientError} />}
    </div>
  )
}
