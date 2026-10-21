import type { ApiClientError } from '@/api/client'
import { Link, useNavigate } from 'react-router'
import { enrichInfo } from '@/domain/media'
import type { Document } from '@/domain/types'
import { Button } from '@/ui/Button'
import { ErrorNote } from '@/ui/ErrorNote'
import { useEnrichDocument } from './hooks'
import styles from './EnrichStrip.module.css'

/**
 * Stage 2 (image descriptions) readout: "Describiendo imágenes 3/12" with a thin bar while it runs, a badge
 * when it ended parcial / fallido / sin perfil de visión, and "Reintentar descripciones". Renders nothing when
 * there is nothing to say (no images, or the descriptions are ready). Never changes the document's `ready`.
 */
export function EnrichStrip({ doc }: { doc: Document }) {
  const info = enrichInfo(doc)
  const retry = useEnrichDocument()
  const navigate = useNavigate()
  if (!info || info.tone === 'ok') return null
  const pct = info.fraction == null ? null : Math.round(info.fraction * 100)
  return (
    <div className={styles.strip} data-tone={info.tone} aria-label={info.area === 'audio' ? 'Transcripción del audio' : 'Descripciones de imágenes'}>
      <div className={styles.row}>
        <span className={styles.badge} role="status">{info.label}</span>
        {info.needsProfile && <Link className={styles.link} to="/settings">{info.area === 'audio' ? 'Configurar proveedor de voz a texto' : 'Configurar proveedor de visión'}</Link>}
        {info.canRetry && (
          <Button disabled={retry.isPending} onClick={() => retry.mutate(doc.id)}>
            {retry.isPending ? 'Reintentando…' : info.area === 'audio' ? 'Reintentar transcripción' : 'Reintentar descripciones'}
          </Button>
        )}
      </div>
      {info.tone === 'busy' && (
        pct != null
          ? <div className={styles.bar} role="progressbar" aria-label={info.area === 'audio' ? 'Progreso de la transcripción' : 'Progreso de descripciones'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><span style={{ width: `${pct}%` }} /></div>
          : <div className={styles.bar} data-indeterminate="true" aria-hidden="true"><span /></div>
      )}
      {info.detail && <p className={styles.detail}>{info.detail}</p>}
      {retry.error && <ErrorNote error={retry.error as ApiClientError} handlers={{ goToSettings: () => navigate('/settings') }} />}
    </div>
  )
}
