import { motion } from 'motion/react'
import { describeError, type ErrorAction } from '@/domain/errors'
import type { ApiError } from '@/domain/types'
import { Button } from './Button'
import styles from './ErrorNote.module.css'

const LABELS: Record<ErrorAction, string> = {
  goToSettings: 'Ir a Configuración',
  retry: 'Reintentar',
  reupload: 'Subir otro archivo',
  newChat: 'Nuevo chat',
  backToList: 'Volver a la lista',
  refresh: 'Actualizar',
}

interface Props {
  error: ApiError
  /** Only actions with a handler are rendered. */
  handlers?: Partial<Record<ErrorAction, () => void>>
}

export function ErrorNote({ error, handlers = {} }: Props) {
  const info = describeError(error)
  const actions = info.actions.filter((a) => handlers[a])
  return (
    <motion.div
      className={`${styles.note} ${info.tone === 'warn' ? styles.warn : styles.error}`}
      role="alert"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, x: info.tone === 'error' ? [0, -4, 4, -2, 0] : 0 }} // plan §6 #11: 4 px shake (reduced motion: fade only)
      transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <p className={styles.title}>{info.title}</p>
      {info.detail && <p className={styles.detail}>{info.detail}</p>}
      {actions.length > 0 && (
        <div className={styles.actions}>
          {actions.map((a) => (
            <Button key={a} onClick={handlers[a]}>{LABELS[a]}</Button>
          ))}
        </div>
      )}
    </motion.div>
  )
}
