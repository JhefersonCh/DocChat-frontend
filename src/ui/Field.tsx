import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import styles from './Field.module.css'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: ReactNode
  error?: string
  /** Rendered next to the input (e.g. key replace/clear controls). */
  adornment?: ReactNode
}

export function Field({ label, hint, error, adornment, className, ...input }: Props) {
  const id = useId()
  const describedBy = error ? `${id}-e` : hint ? `${id}-h` : undefined
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <div className={styles.row}>
        <input
          id={id}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          spellCheck={false}
          {...input}
        />
        {adornment}
      </div>
      {error ? (
        <p id={`${id}-e`} className={styles.error} role="alert">{error}</p>
      ) : hint ? (
        <p id={`${id}-h`} className={styles.hint}>{hint}</p>
      ) : null}
    </div>
  )
}
