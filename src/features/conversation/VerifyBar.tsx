import { describeError } from '@/domain/errors'
import type { ApiClientError } from '@/api/client'
import type { Verification } from '@/domain/types'
import { summaryLabel } from '@/domain/verification'
import { useVerify } from './hooks'
import styles from './Verify.module.css'

interface Props {
  chatId: string
  messageId: string
  verification: Verification | null | undefined
  /** Showing the underlined view (true) or the original rendering (false). */
  shown: boolean
  onToggle: () => void
}

/** "Verificar" under a persisted answer; once checked, the summary chip ("5 respaldadas · 1 parcial · …") and a view toggle. */
export function VerifyBar({ chatId, messageId, verification, shown, onToggle }: Props) {
  const verify = useVerify(chatId, messageId)
  if (!verification) {
    return (
      <>
        <button type="button" className={styles.verify} disabled={verify.isPending} onClick={() => verify.mutate()}>
          {verify.isPending ? 'Verificando…' : verify.isError ? 'No se pudo verificar · reintentar' : 'Verificar'}
        </button>
        {verify.isError && <p className={styles.error} role="alert">{describeError(verify.error as ApiClientError).title}</p>}
      </>
    )
  }
  return (
    <>
      <p className={styles.chip} role="status">{summaryLabel(verification.claims)}</p>
      <button type="button" className={styles.toggle} aria-pressed={shown} onClick={onToggle}>{shown ? 'Ver original' : 'Ver verificación'}</button>
    </>
  )
}
