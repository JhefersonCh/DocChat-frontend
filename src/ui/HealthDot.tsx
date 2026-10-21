import styles from './HealthDot.module.css'

export type HealthState = 'ok' | 'idle' | 'down' | 'loading'

interface Props {
  state: HealthState
  label: string
  detail?: string
}

/** Lab indicator lamp. ok = lit amber, idle = hollow ring (no active profile), down = error. */
export function HealthDot({ state, label, detail }: Props) {
  return (
    <span className={styles.wrap} title={detail ? `${label}: ${detail}` : label}>
      <span className={`${styles.dot} ${styles[state]}`} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
      <span className={styles.sr}>{detail ?? state}</span>
    </span>
  )
}
