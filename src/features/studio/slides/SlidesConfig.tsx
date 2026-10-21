import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { assessSlides } from '@/api/artifacts'
import { SLIDE_STYLES, type Artifact, type SlideStyle } from '@/domain/artifacts'
import { Button } from '@/ui/Button'
import styles from '../Studio.module.css'
import deck from './slides.module.css'

interface Props {
  chatId: string
  busy: boolean
  onGenerate: (options: Artifact['options']) => void
  onCancel: () => void
}

/** Suitability pre-check (one cheap call over all the active sources) before generating a deck. */
export function SlidesConfig({ chatId, busy, onGenerate, onCancel }: Props) {
  const check = useQuery({
    queryKey: ['slides-assess', chatId], queryFn: () => assessSlides(chatId),
    staleTime: 0, gcTime: 0, retry: false, refetchOnWindowFocus: false,
  })
  const [count, setCount] = useState('')
  const [audience, setAudience] = useState('')
  const [style, setStyle] = useState<SlideStyle>('ejecutiva')
  const a = check.data
  const n = Number(count || a?.recommended_slides || 0)
  const submit = () => onGenerate({
    ...(n >= 3 ? { slides: Math.min(n, 24) } : {}),
    ...((audience.trim() || a?.audience) ? { audience: audience.trim() || a!.audience! } : {}),
    style,
  })

  return (
    <form className={styles.config} onSubmit={(e) => { e.preventDefault(); submit() }} aria-label="Configurar presentación">
      {check.isPending && <p className={styles.state} role="status">Evaluando si el material sirve para una presentación…</p>}
      {check.isError && <p className={styles.state} role="status">No se pudo evaluar el material; podés generar igual.</p>}
      {a && (
        <div className={a.suitable ? undefined : deck.warn} role="status">
          <p className={styles.state}>
            <span className={a.suitable ? deck.ok : undefined}>{a.suitable ? 'Material apto' : 'Material poco apto'}</span> · puntaje {Math.round(a.score * 100)}%
          </p>
          {a.reasons.length > 0 && <ul className={styles.state}>{a.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>}
          {a.outline_hint.length > 0 && a.suitable && <p className={styles.state}>Esquema sugerido: {a.outline_hint.join(' → ')}</p>}
        </div>
      )}
      <div className={deck.row3}>
        <div>
          <label className={styles.label} htmlFor="slides-count">Diapositivas</label>
          <input id="slides-count" className={styles.input} type="number" min={3} max={24} value={count} onChange={(e) => setCount(e.target.value)} placeholder={a ? String(a.recommended_slides) : 'auto'} />
        </div>
        <div>
          <label className={styles.label} htmlFor="slides-style">Estilo</label>
          <select id="slides-style" className={styles.input} value={style} onChange={(e) => setStyle(e.target.value as SlideStyle)}>
            {SLIDE_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <label className={styles.label} htmlFor="slides-audience">Público (opcional)</label>
      <input id="slides-audience" className={styles.input} value={audience} onChange={(e) => setAudience(e.target.value)} placeholder={a?.audience ?? 'Ej.: comité directivo'} />
      <div className={deck.warnActions}>
        <Button type="submit" variant="solid" disabled={busy || check.isPending}>{a && !a.suitable ? 'Generar igual' : 'Generar'}</Button>
        <Button onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  )
}
