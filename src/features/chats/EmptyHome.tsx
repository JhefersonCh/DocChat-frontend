import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router'
import { useHealth } from '@/features/providers/hooks'
import { Button } from '@/ui/Button'
import { useCreateChat } from './hooks'
import styles from './EmptyHome.module.css'

const step = (n: number): CSSProperties => ({ ['--d' as string]: n })

const STEPS = [
  ['01', 'Subí', 'un PDF, TXT o MD. Uno por chat.'],
  ['02', 'Preguntá', 'en lenguaje natural. La respuesta llega por streaming.'],
  ['03', 'Verificá', 'cada cita salta al fragmento exacto del original.'],
] as const

export function EmptyHome() {
  const navigate = useNavigate()
  const create = useCreateChat()
  const health = useHealth()
  const noChat = health.data && !health.data.providers.chat
  return (
    <div className={styles.home}>
      <div className={styles.copy}>
        <p className={`${styles.kicker} rise`} style={step(0)}>Sistema experto de lectura</p>
        <h1 className={styles.h1}>
          <span className="rise" style={step(1)}>Un documento.</span>
          <span className="rise" style={step(2)}>Una conversación.</span>
          <span className="rise" style={step(3)}><em className={styles.mark}>Con citas.</em></span>
        </h1>
        <p className={`${styles.lede} rise`} style={step(4)}>Abrí un chat, subí un documento y preguntale lo que quieras. Cada respuesta se puede comprobar.</p>
        <div className="rise" style={step(5)}>
          <Button variant="solid" disabled={create.isPending}
            onClick={() => create.mutate(undefined, { onSuccess: (c) => navigate(`/chats/${c.id}`) })}>
            + Nuevo chat
          </Button>
        </div>
        {noChat && (
          <p className={`${styles.warn} rise`} style={step(6)} role="status">
            Falta un modelo de chat activo. <Link to="/settings">Configuralo</Link>.
          </p>
        )}
        <ol className={styles.steps}>
          {STEPS.map(([n, verb, rest], i) => (
            <li key={n} className="rise" style={step(6 + i)}>
              <span className={styles.n}>{n}</span>
              <span><b>{verb}</b> {rest}</span>
            </li>
          ))}
        </ol>
      </div>
      <figure className={`${styles.specimen} rise`} style={step(5)} aria-hidden="true">
        <div className={`paper ${styles.sheet}`}>
          <p className={styles.quote}>
            Las semillas se mantienen a <mark>veinticinco grados durante diez semanas</mark> antes de pasar al previvero.
            <span className={styles.chip}>1</span>
          </p>
          <p className={styles.note}><span>1</span> pág. 3 · chunk 5d0c</p>
        </div>
        <figcaption className={styles.cap}>ejemplo · cita → fragmento resaltado</figcaption>
      </figure>
    </div>
  )
}
