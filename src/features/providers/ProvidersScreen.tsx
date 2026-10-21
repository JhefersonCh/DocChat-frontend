import type { ApiClientError } from '@/api/client'
import { ErrorNote } from '@/ui/ErrorNote'
import { useActive, useProviders } from './hooks'
import { ProviderColumn } from './ProviderColumn'
import styles from './ProvidersScreen.module.css'

export function ProvidersScreen() {
  const providers = useProviders()
  const active = useActive()
  const error = (providers.error ?? active.error) as ApiClientError | null
  const ready = providers.data && active.data

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <p className={styles.kicker}>Laboratorio / proveedores</p>
        <h1 className={styles.h1}>Configuración</h1>
        <p className={styles.lede}>
          Las API keys viajan una sola vez al guardar. El backend nunca las devuelve: solo ves la versión enmascarada.
        </p>
      </header>
      {error && (
        <ErrorNote error={error} handlers={{ retry: () => { void providers.refetch(); void active.refetch() }, refresh: () => { void providers.refetch(); void active.refetch() } }} />
      )}
      {!ready && !error && <p className={styles.loading} role="status">Leyendo perfiles…</p>}
      {ready && (
        <div className={styles.cols}>
          <ProviderColumn kind="chat" providers={providers.data!.filter((p) => p.kind === 'chat')} activeId={active.data!.chat_profile_id} />
          <ProviderColumn kind="embedding" providers={providers.data!.filter((p) => p.kind === 'embedding')} activeId={active.data!.embedding_profile_id} />
          <ProviderColumn kind="stt" providers={providers.data!.filter((p) => p.kind === 'stt')} activeId={active.data!.stt_profile_id ?? null} />
          <ProviderColumn kind="tts" providers={providers.data!.filter((p) => p.kind === 'tts')} activeId={active.data!.tts_profile_id ?? null} />
          <ProviderColumn kind="vision" providers={providers.data!.filter((p) => p.kind === 'vision')} activeId={active.data!.vision_profile_id ?? null} />
        </div>
      )}
    </div>
  )
}
