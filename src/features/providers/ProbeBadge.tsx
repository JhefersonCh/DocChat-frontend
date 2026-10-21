import { motion } from 'motion/react'
import type { ApiClientError } from '@/api/client'
import type { ProbeResult } from '@/domain/types'
import { fade } from '@/ui/motion'
import styles from './ProbeBadge.module.css'

interface Props {
  pending: boolean
  result?: ProbeResult
  error?: ApiClientError | null
}

/** Lab readout of the last `/test`: `ok` decides, never the HTTP status (always 200). */
export function ProbeBadge({ pending, result, error }: Props) {
  if (pending) return <p className={`${styles.line} ${styles.run}`} role="status">&gt; probando<span className={styles.dots} /></p>
  if (error) return <p className={`${styles.line} ${styles.bad}`} role="alert">&gt; {error.code === 'network_error' ? 'backend sin respuesta' : error.code}</p>
  if (!result) return null
  return (
    <motion.p
      className={`${styles.line} ${result.ok ? styles.ok : styles.bad}`}
      role={result.ok ? 'status' : 'alert'}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={fade}
    >
      &gt; {result.ok ? 'OK' : 'FALLÓ'} · {result.detail}
      {result.dimensions != null && ` · ${result.dimensions} dims`}
      {result.audio_bytes != null && ` · ${Math.round(result.audio_bytes / 1024)} kB de audio`}
      {result.caption && ` · «${result.caption}»`}
    </motion.p>
  )
}
