import { useEffect, useMemo, useRef, useState } from 'react'
import { TYPE_COLOR, type EntityGraphData, type GraphEntity, type GraphRelation } from '@/domain/artifacts'
import { layout, neighbors, type Pt } from '@/domain/forceLayout'
import { useAskBridge } from '@/features/conversation/askBridgeContext'
import { Button } from '@/ui/Button'
import { PageLink } from './PageLink'
import { useOpenPage } from './useOpenPage'
import styles from './graph.module.css'

const W = 640
const H = 420
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

type Selection = { kind: 'node'; id: string } | { kind: 'edge'; index: number } | null

export function GraphView({ data }: { data: EntityGraphData }) {
  const { entities, relations } = data
  const base = useMemo(() => layout(entities.map((e) => e.id), relations, W, H), [entities, relations])
  const [moved, setMoved] = useState<Record<string, Pt>>({})
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const [hover, setHover] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection>(null)
  const [askFailed, setAskFailed] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ id: string | null; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null)
  const open = useOpenPage()
  const { ask } = useAskBridge()
  const pos = (id: string): Pt => moved[id] ?? base[id] ?? { x: W / 2, y: H / 2 }
  const byId = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities])
  const degree = useMemo(() => {
    const d: Record<string, number> = {}
    for (const r of relations) { d[r.source] = (d[r.source] ?? 0) + 1; d[r.target] = (d[r.target] ?? 0) + 1 }
    return d
  }, [relations])

  const focus = hover ?? (selection?.kind === 'node' ? selection.id : null)
  const near = useMemo(() => (focus ? neighbors(focus, relations) : null), [focus, relations])
  const dim = (id: string) => !!focus && id !== focus && !near?.has(id)

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setView((v) => ({ ...v, k: clamp(v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12), MIN_ZOOM, MAX_ZOOM) }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const unit = () => (svgRef.current?.clientWidth ? W / svgRef.current.clientWidth : 1) / view.k
  const startDrag = (e: React.PointerEvent, id: string | null) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const p = id ? pos(id) : view
    drag.current = { id, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, moved: false }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
    if (!d.moved) return
    if (d.id) {
      const id = d.id
      setMoved((m) => ({ ...m, [id]: { x: d.ox + dx * unit(), y: d.oy + dy * unit() } }))
    } else setView((v) => ({ ...v, x: d.ox + dx * unit() * v.k, y: d.oy + dy * unit() * v.k }))
  }
  const endDrag = (select?: () => void) => {
    const d = drag.current
    drag.current = null
    if (d && !d.moved) select?.()
  }
  const zoom = (f: number) => setView((v) => ({ ...v, k: clamp(v.k * f, MIN_ZOOM, MAX_ZOOM) }))
  const reset = () => { setView({ x: 0, y: 0, k: 1 }); setMoved({}) }

  const selected: GraphEntity | undefined = selection?.kind === 'node' ? byId.get(selection.id) : undefined
  const edge: GraphRelation | undefined = selection?.kind === 'edge' ? relations[selection.index] : undefined
  const types = [...new Set(entities.map((e) => e.type))]

  const select = (s: Selection) => { setSelection(s); setAskFailed(false) }

  return (
    <div className={styles.graph}>
      <div className={styles.stage}>
        <svg
          ref={svgRef} className={styles.svg} viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Grafo de entidades"
          onPointerDown={(e) => startDrag(e, null)} onPointerMove={onMove} onPointerUp={() => endDrag(() => select(null))}
        >
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`} style={{ transformOrigin: '0 0' }}>
            {relations.map((r, i) => {
              const a = pos(r.source)
              const b = pos(r.target)
              const on = !focus || r.source === focus || r.target === focus
              const sel = selection?.kind === 'edge' && selection.index === i
              return (
                <g key={i} className={styles.edge} data-dim={!on} data-selected={sel}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                  <line
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={styles.hit} role="button" tabIndex={0}
                    aria-label={`Relación: ${byId.get(r.source)?.name} ${r.label} ${byId.get(r.target)?.name}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { select({ kind: 'edge', index: i }); open(r, r.quote, e.currentTarget) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { select({ kind: 'edge', index: i }); open(r, r.quote, e.currentTarget) } }}
                  />
                  {(sel || (focus && on)) && <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} className={styles.edgeLabel}>{r.label}</text>}
                </g>
              )
            })}
            {entities.map((n) => {
              const p = pos(n.id)
              const r = 6 + Math.min(degree[n.id] ?? 0, 8) * 1.2
              return (
                <g
                  key={n.id} className={styles.node} data-dim={dim(n.id)} data-selected={focus === n.id && selection?.kind === 'node'}
                  transform={`translate(${p.x} ${p.y})`} role="button" tabIndex={0} aria-label={`${n.name} (${n.type})`}
                  onPointerDown={(e) => startDrag(e, n.id)} onPointerMove={onMove}
                  onPointerUp={(e) => { e.stopPropagation(); endDrag(() => select({ kind: 'node', id: n.id })) }}
                  onPointerEnter={() => setHover(n.id)} onPointerLeave={() => setHover(null)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') select({ kind: 'node', id: n.id }) }}
                >
                  <circle r={r} fill={TYPE_COLOR[n.type]} />
                  <text y={r + 11} textAnchor="middle">{n.name.length > 22 ? `${n.name.slice(0, 21)}…` : n.name}</text>
                </g>
              )
            })}
          </g>
        </svg>
        <div className={styles.controls}>
          <button type="button" aria-label="Acercar" onClick={() => zoom(1.25)}>+</button>
          <button type="button" aria-label="Alejar" onClick={() => zoom(0.8)}>−</button>
          <button type="button" aria-label="Restablecer vista" onClick={reset}>⟲</button>
        </div>
      </div>
      <ul className={styles.legend} aria-label="Tipos de entidad">
        {types.map((t) => <li key={t}><i style={{ background: TYPE_COLOR[t] }} />{t}</li>)}
      </ul>
      {selected && (
        <aside className={styles.sideCard} aria-label={`Detalle de ${selected.name}`}>
          <p className={styles.cardType} style={{ color: TYPE_COLOR[selected.type] }}>{selected.type}</p>
          <h4 className={styles.cardName}>{selected.name}</h4>
          {selected.description && <p className={styles.cardText}>{selected.description}</p>}
          {selected.aliases.length > 0 && <p className={styles.cardMeta}>También: {selected.aliases.join(', ')}</p>}
          <div className={styles.cardActions}>
            <PageLink pageRef={selected} />
            <Button onClick={() => setAskFailed(!ask(`Contame sobre ${selected.name} según el documento.`))}>Preguntar sobre {selected.name}</Button>
          </div>
          {askFailed && <p className={styles.cardMeta} role="status">No se puede preguntar ahora (¿hay una respuesta en curso?).</p>}
        </aside>
      )}
      {edge && (
        <aside className={styles.sideCard} aria-label="Detalle de la relación">
          <p className={styles.cardType}>{byId.get(edge.source)?.name} → {edge.label} → {byId.get(edge.target)?.name}</p>
          <q className={styles.cardQuote}>{edge.quote}</q>
          <div className={styles.cardActions}><PageLink pageRef={edge} quote={edge.quote} /></div>
        </aside>
      )}
      {!selection && <p className={styles.hint}>Arrastrá los nodos, tocá uno para ver el detalle o una línea para abrir la cita en el PDF.</p>}
    </div>
  )
}
