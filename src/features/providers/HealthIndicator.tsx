import { HealthDot, type HealthState } from '@/ui/HealthDot'
import { useHealth } from './hooks'

/** Container: GET /health every 30 s. Shows chat + embedding lamps. */
export function HealthIndicator() {
  const { data, isError, isPending } = useHealth()
  if (isPending) return <HealthDot state="loading" label="backend…" />
  if (isError || !data) return <HealthDot state="down" label="backend sin respuesta" detail="el backend no responde" />

  const lamp = (kind: 'chat' | 'embedding') => {
    const p = data.providers[kind]
    const state: HealthState = !p ? 'idle' : p.reachable ? 'ok' : 'down'
    const detail = !p ? 'sin perfil activo' : p.reachable ? 'activo' : 'no alcanzable'
    return <HealthDot key={kind} state={state} label={p ? p.name : `${kind}: sin activo`} detail={`${kind}: ${detail}`} />
  }
  return (
    <div style={{ display: 'grid', gap: 'var(--s-2)', minWidth: 0 }} aria-label="Estado de proveedores" role="group">
      {lamp('chat')}
      {lamp('embedding')}
    </div>
  )
}
