import { useState } from 'react'
import { segmentThumbUrl } from '@/api/media'
import styles from './Thumb.module.css'

interface Props {
  chunkId: string
  alt: string
  /** CSS width of the box; the box keeps `ratio`, so loading never shifts the layout. */
  width?: number | string
  ratio?: string
  className?: string
}

/** Segment thumbnail (256 px webp): lazy, fixed-aspect box on a grained well, fades in, quiet glyph on error. */
export function Thumb({ chunkId, alt, width = 96, ratio = '4 / 3', className }: Props) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  return (
    <span className={`${styles.box} ${className ?? ''}`} data-state={state} style={{ width, aspectRatio: ratio }}>
      {state !== 'error' && (
        <img
          className={styles.img} src={segmentThumbUrl(chunkId)} alt={alt} loading="lazy" decoding="async"
          onLoad={() => setState('ok')} onError={() => setState('error')}
        />
      )}
      {state === 'error' && <span className={styles.glyph} role="img" aria-label={`${alt} (no disponible)`}>▣</span>}
    </span>
  )
}
