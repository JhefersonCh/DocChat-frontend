import { useState } from 'react'
import type { ApiClientError } from '@/api/client'
import type { ProbeResult, Provider } from '@/domain/types'
import { Button } from '@/ui/Button'
import { ErrorNote } from '@/ui/ErrorNote'
import { ProbeBadge } from './ProbeBadge'
import styles from './ProviderCard.module.css'

interface Props {
  provider: Provider
  active: boolean
  suggestProbe: boolean
  probe: { pending: boolean; result?: ProbeResult; error?: ApiClientError | null }
  busy: boolean
  deleteError: ApiClientError | null
  onProbe: () => void
  onActivate: () => void
  onEdit: () => void
  onDelete: () => void
}

export function ProviderCard({ provider: p, active, suggestProbe, probe, busy, deleteError, onProbe, onActivate, onEdit, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false)
  const meta =
    p.kind === 'chat' ? [`k ${p.default_k}/${p.max_k}`, `tool-calls ${p.max_tool_calls}`]
    : p.kind === 'stt' ? [p.protocol === 'ollama' ? 'Ollama nativo' : 'OpenAI /v1/audio', `idioma ${p.language ?? 'es'}`]
    : p.kind === 'tts' ? [`voz ${p.voice ?? '?'}`, `idioma ${p.language ?? 'es'}`]
    : p.kind === 'vision' ? ['descripción de imágenes']
    : [p.dimensions ? `${p.dimensions} dims` : 'dims sin detectar']

  return (
    <article className={`${styles.card} ${active ? styles.active : ''}`} aria-label={p.name}>
      <header className={styles.head}>
        <h3 className={styles.name}>{p.name}</h3>
        {active && <span className={styles.on}>ACTIVO</span>}
        {p.kind === 'chat' && p.supports_tools && <span className={styles.tag}>TOOLS</span>}
      </header>
      <dl className={styles.meta}>
        <dt>modelo</dt><dd>{p.model}</dd>
        <dt>url</dt><dd>{p.base_url}</dd>
        <dt>key</dt><dd>{p.api_key_masked ?? 'sin key'}</dd>
        <dt>ajustes</dt><dd>{meta.join(' · ')}</dd>
      </dl>
      <ProbeBadge pending={probe.pending} result={probe.result} error={probe.error} />
      {deleteError && <ErrorNote error={deleteError} />}
      <div className={styles.actions}>
        {confirming ? (
          <>
            <span className={styles.ask}>¿Borrar este perfil?</span>
            <Button variant="danger" disabled={busy} onClick={() => { setConfirming(false); onDelete() }}>Sí, borrar</Button>
            <Button onClick={() => setConfirming(false)}>No</Button>
          </>
        ) : (
          <>
            <Button variant={suggestProbe ? 'solid' : 'ghost'} onClick={onProbe} disabled={probe.pending}>
              {suggestProbe ? 'Probar ahora' : 'Probar'}
            </Button>
            {!active && <Button onClick={onActivate} disabled={busy}>Activar</Button>}
            <Button onClick={onEdit}>Editar</Button>
            <Button onClick={() => setConfirming(true)}>Borrar</Button>
          </>
        )}
      </div>
    </article>
  )
}
