import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { ApiClientError } from '@/api/client'
import type { ProbeResult, Provider, ProviderKind } from '@/domain/types'
import { Button } from '@/ui/Button'
import { fade, spring } from '@/ui/motion'
import {
  useCreateProvider, useDeleteProvider, usePatchProvider, useProbe, useSetActive,
} from './hooks'
import { ProviderCard } from './ProviderCard'
import { ProviderForm } from './ProviderForm'
import styles from './ProviderColumn.module.css'

interface Props {
  kind: ProviderKind
  providers: Provider[]
  activeId: string | null
}

type ProbeState = { result?: ProbeResult; error?: ApiClientError }

const COPY = {
  chat: { title: 'Chat', hint: 'Modelo que responde. Con tools el modelo decide qué buscar en el documento.' },
  embedding: { title: 'Embedding', hint: 'Cambiar el activo solo afecta a documentos nuevos; los ya indexados conservan el suyo.' },
  stt: { title: 'Voz → texto', hint: 'Transcribe lo que decís en modo voz. Ollama con gemma4:e2b: protocolo "Ollama nativo", URL sin /v1.' },
  tts: { title: 'Texto → voz', hint: 'Lee las respuestas en voz alta, frase por frase. El perfil local usa Supertonic 3 (voz F2).' },
  vision: { title: 'Visión', hint: 'Describe las imágenes (y lee gráficos) al indexar. Sin perfil activo se indexan igual, sin descripciones.' },
}
const ACTIVE_KEY = {
  chat: 'chat_profile_id', embedding: 'embedding_profile_id', stt: 'stt_profile_id', tts: 'tts_profile_id',
  vision: 'vision_profile_id',
} as const

export function ProviderColumn({ kind, providers, activeId }: Props) {
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [freshId, setFreshId] = useState<string | null>(null)
  const [probes, setProbes] = useState<Record<string, ProbeState>>({})
  const [deleteError, setDeleteError] = useState<{ id: string; error: ApiClientError } | null>(null)

  const create = useCreateProvider()
  const patch = usePatchProvider()
  const del = useDeleteProvider()
  const probe = useProbe()
  const setActive = useSetActive()

  const runProbe = (id: string) => {
    setFreshId(null)
    setProbes((s) => ({ ...s, [id]: {} }))
    probe.mutate(id, {
      onSuccess: (result) => setProbes((s) => ({ ...s, [id]: { result } })),
      onError: (e) => setProbes((s) => ({ ...s, [id]: { error: e as ApiClientError } })),
    })
  }
  const closeForm = () => { setEditing(null); create.reset(); patch.reset() }
  const activate = (id: string) => setActive.mutate({ [ACTIVE_KEY[kind]]: id })
  const remove = (id: string) => {
    setDeleteError(null)
    del.mutate(id, { onError: (e) => setDeleteError({ id, error: e as ApiClientError }) })
  }

  return (
    <section className={styles.col} aria-labelledby={`col-${kind}`}>
      <header className={styles.head}>
        <h2 id={`col-${kind}`} className={styles.title}>{COPY[kind].title}</h2>
        <Button variant="solid" onClick={() => { closeForm(); setEditing('new') }} disabled={editing === 'new'}>+ Nuevo perfil</Button>
      </header>
      <p className={styles.hint}>{COPY[kind].hint}</p>
      {kind === 'chat' && !activeId && (
        <p className={styles.notice} role="status">Sin modelo de chat activo: no se puede conversar hasta activar uno.</p>
      )}

      <AnimatePresence initial={false}>
        {editing === 'new' && (
          <motion.div key="new" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={fade}>
            <ProviderForm
              kind={kind} submitting={create.isPending} error={create.error as ApiClientError | null}
              onCancel={closeForm} onPatch={() => {}}
              onCreate={(body) => create.mutate(body, { onSuccess: (p) => { setEditing(null); setFreshId(p.id) } })}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <ul className={styles.list}>
        <AnimatePresence initial={false}>
          {providers.map((p) => (
            <motion.li key={p.id} layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -12 }} transition={{ ...spring, opacity: fade }}>
              {editing === p.id ? (
                <ProviderForm
                  kind={kind} initial={p} submitting={patch.isPending} error={patch.error as ApiClientError | null}
                  onCancel={closeForm} onCreate={() => {}}
                  onPatch={(body) => patch.mutate({ id: p.id, body }, { onSuccess: closeForm })}
                />
              ) : (
                <ProviderCard
                  provider={p} active={p.id === activeId} suggestProbe={p.id === freshId}
                  probe={{ pending: probe.isPending && probe.variables === p.id, ...probes[p.id] }}
                  busy={setActive.isPending || del.isPending}
                  deleteError={deleteError?.id === p.id ? deleteError.error : null}
                  onProbe={() => runProbe(p.id)} onActivate={() => activate(p.id)}
                  onEdit={() => { closeForm(); setEditing(p.id) }} onDelete={() => remove(p.id)}
                />
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {providers.length === 0 && editing !== 'new' && <p className={styles.empty}>Sin perfiles. Creá uno para empezar.</p>}
    </section>
  )
}
