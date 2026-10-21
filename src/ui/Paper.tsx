import type { HTMLAttributes } from 'react'

export function Paper({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={['paper', className].filter(Boolean).join(' ')} {...rest} />
}
