import { ScanBar } from '@/ui/ScanBar'
import styles from './RouteFallback.module.css'

/** Suspense fallback of lazy routes: the same scan bar as the ingest, no layout jump. */
export function RouteFallback() {
  return (
    <div className={styles.wrap} role="status">
      <p>Leyendo configuración…</p>
      <ScanBar />
    </div>
  )
}
