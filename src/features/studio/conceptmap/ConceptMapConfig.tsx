import { useState } from 'react'
import type { Artifact } from '@/domain/artifacts'
import { Button } from '@/ui/Button'
import styles from '../Studio.module.css'

interface Props {
  busy: boolean
  onGenerate: (options: Artifact['options']) => void
  onCancel: () => void
}

/** Options of a concept map: central topic (optional), depth and size. */
export function ConceptMapConfig({ busy, onGenerate, onCancel }: Props) {
  const [focus, setFocus] = useState('')
  const [depth, setDepth] = useState('3')
  const [max, setMax] = useState('30')
  const submit = () => onGenerate({
    ...(focus.trim() ? { focus: focus.trim() } : {}),
    depth: Number(depth),
    max_nodes: Math.max(8, Math.min(Number(max) || 30, 60)),
  })
  return (
    <form className={styles.config} onSubmit={(e) => { e.preventDefault(); submit() }} aria-label="Configurar mapa conceptual">
      <label className={styles.label} htmlFor="cmap-focus">Tema central (opcional)</label>
      <input id="cmap-focus" className={styles.input} value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Ej.: fotosíntesis" autoFocus />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-2)' }}>
        <div>
          <label className={styles.label} htmlFor="cmap-depth">Niveles</label>
          <select id="cmap-depth" className={styles.input} style={{ width: '100%' }} value={depth} onChange={(e) => setDepth(e.target.value)}>
            {[2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className={styles.label} htmlFor="cmap-max">Conceptos (máx.)</label>
          <input id="cmap-max" className={styles.input} style={{ width: '100%' }} type="number" min={8} max={60} value={max} onChange={(e) => setMax(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
        <Button type="submit" variant="solid" disabled={busy}>Generar</Button>
        <Button onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  )
}
