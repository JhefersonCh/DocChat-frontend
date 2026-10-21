import type { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'ghost' | 'danger'
}

/** Lab button: near-square, mono, uppercase. `solid` is the single amber call to action. */
export function Button({ variant = 'ghost', className, type = 'button', ...rest }: Props) {
  return <button type={type} className={[styles.btn, styles[variant], className].filter(Boolean).join(' ')} {...rest} />
}
