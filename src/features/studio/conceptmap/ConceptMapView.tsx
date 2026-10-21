import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ApiClientError } from '@/api/client'
import type { ConceptMapData } from '@/domain/artifacts'
import {
  ancestorsOf, descendants, edgeGeometry, foldBelow, hiddenIds, layoutConceptMap, matchNodes, ROOT_FONT, NODE_FONT,
  sourceColors, sourceOf, treeOf, type Box, type Orientation,
} from '@/domain/conceptMap'
import { useAskBridge } from '@/features/conversation/askBridgeContext'
import { useSources } from '@/features/sources/SourcesContext'
import { useExpandNode } from '../hooks'
import { EdgeCard, NodeCard } from './DetailCard'
import { exportJson, exportPng, exportSvg } from './exportMap'
import { MiniMap } from './MiniMap'
import styles from './conceptmap.module.css'

const MIN_K = 0.2
const MAX_K = 2.5
const CARD_W = 340
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
type View = { x: number; y: number; k: number }
type Selection = { kind: 'node' | 'edge'; id: string } | null

function useMedia(query: string) {
  const get = () => (typeof matchMedia === 'function' ? matchMedia(query).matches : false)
  const [on, setOn] = useState(get)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const m = matchMedia(query)
    const h = () => setOn(m.matches)
    m.addEventListener('change', h)
    return () => m.removeEventListener('change', h)
  }, [query])
  return on
}

interface Props { data: ConceptMapData; chatId: string; artifactId: string }

/** Novak-style concept map: layered layout, labeled curved links, collapsible branches, pan / zoom, grounded expansion. */
export function ConceptMapView({ data, chatId, artifactId }: Props) {
  const reduce = useReducedMotion()
  const compact = useMedia('(max-width: 640px)')
  const sources = useSources()
  const { ask } = useAskBridge()
  const expand = useExpandNode(chatId, artifactId)
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 })
  const [smooth, setSmooth] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => (compact ? foldBelow(data, 1) : new Set()))
  const [selection, setSelection] = useState<Selection>(null)
  const [query, setQuery] = useState('')
  const [matchAt, setMatchAt] = useState(0)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const [expanding, setExpanding] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [askFailed, setAskFailed] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [pref, setPref] = useState<'auto' | Orientation>('auto')
  const [note, setNote] = useState<string | null>(null)
  const [pending, setPending] = useState<{ ids: string[]; mode: 'fit' | 'center' } | null>(null)
  const viewRef = useRef(view)
  const handled = useRef<unknown>(null)
  useEffect(() => { viewRef.current = view }, [view])
  const fitted = useRef(false)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ moved: boolean; x: number; y: number; dist: number } | null>(null)

  const hidden = useMemo(() => hiddenIds(data, collapsed), [data, collapsed])
  const W = size.w || 800
  const H = size.h || 560
  const down = useMemo(() => layoutConceptMap(data, hidden, compact, 'down'), [data, hidden, compact])
  const side = useMemo(() => layoutConceptMap(data, hidden, compact, 'right'), [data, hidden, compact])
  // auto: whichever orientation lets the map be read at the larger scale in this stage
  const scaleOf = (l: typeof down) => Math.min((W - 80) / Math.max(l.width, 1), (H - 80) / Math.max(l.height, 1))
  const orientation: Orientation = pref === 'auto' ? (scaleOf(side) > scaleOf(down) * 1.15 ? 'right' : 'down') : pref
  const layout = orientation === 'right' ? side : down
  const tree = useMemo(() => treeOf(data), [data])
  const colors = useMemo(() => sourceColors(data), [data])
  const nodeById = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data])
  const links = useMemo(() => data.links.filter((l) => layout.boxes.has(l.source) && layout.boxes.has(l.target)), [data, layout])
  const matches = useMemo(() => matchNodes(data.nodes, query), [data, query])
  const matchSet = useMemo(() => new Set(matches), [matches])
  const cardOpen = !!selection && !compact

  const focusIds = useMemo(() => {
    if (!selection) return null
    if (selection.kind === 'edge') {
      const l = data.links.find((x) => x.id === selection.id)
      return l ? new Set([l.source, l.target]) : null
    }
    const ids = new Set([selection.id])
    for (const l of data.links) {
      if (l.source === selection.id) ids.add(l.target)
      if (l.target === selection.id) ids.add(l.source)
    }
    return ids
  }, [selection, data])

  const go = useCallback((v: View, animate = true) => { setSmooth(animate && !reduce); setView(v) }, [reduce])
  const bounds = useCallback((ids: string[]) => {
    const bs = ids.map((i) => layout.boxes.get(i)).filter((b): b is Box => !!b)
    if (!bs.length) return null
    return {
      x0: Math.min(...bs.map((b) => b.cx - b.w / 2)), x1: Math.max(...bs.map((b) => b.cx + b.w / 2)),
      y0: Math.min(...bs.map((b) => b.cy - b.h / 2)), y1: Math.max(...bs.map((b) => b.cy + b.h / 2)),
    }
  }, [layout])
  const fitIds = useCallback((ids: string[], animate = true, maxK = 1.1) => {
    const b = bounds(ids)
    if (!b) return
    const availW = W - (cardOpen ? CARD_W : 0)
    const pad = 36
    const k = clamp(Math.min((availW - pad * 2) / Math.max(b.x1 - b.x0, 1), (H - pad * 2) / Math.max(b.y1 - b.y0, 1)), MIN_K, maxK)
    go({ k, x: availW / 2 - k * (b.x0 + b.x1) / 2, y: H / 2 - k * (b.y0 + b.y1) / 2 }, animate)
  }, [bounds, W, H, cardOpen, go])
  const fitAll = useCallback((animate = true) => fitIds([...layout.boxes.keys()], animate), [fitIds, layout])
  const centerOn = useCallback((id: string, k?: number) => {
    const b = layout.boxes.get(id)
    if (!b) return
    const nk = clamp(k ?? Math.max(viewRef.current.k, 0.85), MIN_K, MAX_K)
    const availW = W - (cardOpen ? CARD_W : 0)
    go({ k: nk, x: availW / 2 - nk * b.cx, y: H / 2 - nk * b.cy })
  }, [layout, W, H, cardOpen, go])
  const zoomAt = useCallback((f: number, px = W / 2, py = H / 2, animate = false) => {
    const v = viewRef.current
    const k = clamp(v.k * f, MIN_K, MAX_K)
    go({ k, x: px - (px - v.x) * (k / v.k), y: py - (py - v.y) * (k / v.k) }, animate)
  }, [W, H, go])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    if (!fitted.current && size.w > 0 && layout.boxes.size) { fitted.current = true; fitAll(false) }
  }, [size, layout, fitAll])
  useEffect(() => {
    if (!pending || handled.current === pending || !pending.ids.every((i) => layout.boxes.has(i))) return
    handled.current = pending
    // viewport sync once the new layout exists (the view is external state of the canvas)
    // oxlint-disable-next-line react/set-state-in-effect
    if (pending.mode === 'fit') fitIds(pending.ids, true, 1)
    else centerOn(pending.ids[0])
  }, [pending, layout, fitIds, centerOn])
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { fitted.current = false; setFullscreen(false) } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [fullscreen])
  useEffect(() => {
    if (!fresh.size) return
    const t = setTimeout(() => setFresh(new Set()), 3600)
    return () => clearTimeout(t)
  }, [fresh])
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(null), 3000); return () => clearTimeout(t) }, [note])

  // --- pan / pinch -------------------------------------------------------------------------
  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]
    gesture.current = { moved: false, x: e.clientX, y: e.clientY, dist: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0 }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g || !pointers.current.has(e.pointerId)) return
    const prev = pointers.current.get(e.pointerId)!
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]
    if (pts.length === 2) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const r = stageRef.current!.getBoundingClientRect()
      if (g.dist) zoomAt(dist / g.dist, (pts[0].x + pts[1].x) / 2 - r.left, (pts[0].y + pts[1].y) / 2 - r.top)
      g.dist = dist
      g.moved = true
      return
    }
    if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 5) return
    if (!g.moved) e.currentTarget.setPointerCapture?.(e.pointerId)
    g.moved = true
    setSmooth(false)
    setView((v) => ({ ...v, x: v.x + e.clientX - prev.x, y: v.y + e.clientY - prev.y }))
  }
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size === 0) setTimeout(() => { gesture.current = null }, 0)
  }
  const tapped = () => !gesture.current?.moved

  // --- actions -----------------------------------------------------------------------------
  const select = (s: Selection) => { setSelection(s); setAskFailed(false); setFailure(null) }
  const selectNode = (id: string) => { select({ kind: 'node', id }); centerOn(id) }
  const toggle = (id: string) => setCollapsed((c) => { const n = new Set(c); if (!n.delete(id)) n.add(id); return n })
  const reveal = (id: string) => setCollapsed((c) => {
    const up = ancestorsOf(data, id).filter((a) => c.has(a))
    if (!up.length) return c
    const n = new Set(c)
    for (const a of up) n.delete(a)
    return n
  })
  const allFolded = collapsed.size > 0
  const flip = () => { fitted.current = false; setPref(orientation === 'down' ? 'right' : 'down') }
  const toggleAll = () => {
    setCollapsed(allFolded ? new Set() : foldBelow(data, 1))
    setPending({ ids: [data.root_id], mode: 'fit' })
  }
  const jump = (id: string) => { reveal(id); setSelection({ kind: 'node', id }); setPending({ ids: [id], mode: 'center' }) }
  const nextMatch = (step = 1) => {
    if (!matches.length) return
    const i = (matchAt + step + matches.length) % matches.length
    setMatchAt(i)
    jump(matches[i])
  }
  const doExpand = (id: string) => {
    setFailure(null)
    setExpanding(id)
    expand.mutate(id, {
      onSuccess: (res) => {
        setCollapsed((c) => { const n = new Set(c); n.delete(id); return n })
        setFresh(new Set(res.added_nodes))
        setPending({ ids: [id, ...res.added_nodes], mode: 'fit' })
      },
      onError: (e) => {
        const message = (e as ApiClientError).message ?? 'No se pudo expandir el concepto.'
        setFailure(message)
        setNote(message)
      },
      onSettled: () => setExpanding(null),
    })
  }
  // "Ampliar": the map takes the whole viewport (CSS overlay: works on phones, where element fullscreen does not)
  const toggleFullscreen = () => { fitted.current = false; setFullscreen((f) => !f) }
  const doPng = async () => { if (!(await exportPng(data, layout, colors))) setNote('No se pudo generar el PNG; probá con SVG.') }

  const node = selection?.kind === 'node' ? nodeById.get(selection.id) : undefined
  const link = selection?.kind === 'edge' ? data.links.find((l) => l.id === selection.id) : undefined
  const spring = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 240, damping: 30 }
  const fade = reduce ? { duration: 0 } : { duration: 0.18 }
  const enterFrom = (id: string) => layout.boxes.get(tree.parent.get(id) ?? '') ?? layout.boxes.get(id)!
  const searching = query.trim().length > 0
  const legend = sources.length > 1 ? sources.filter((s) => [...colors.keys()].includes(s.id)) : []
  const dimNode = (id: string) => (searching ? !matchSet.has(id) : !!focusIds && !focusIds.has(id))

  return (
    <div ref={rootRef} className={styles.root} data-fullscreen={fullscreen}>
      <div className={styles.toolbar} role="toolbar" aria-label="Herramientas del mapa">
        <div className={styles.search}>
          <input
            type="search" className={styles.searchInput} placeholder="Buscar concepto…" aria-label="Buscar concepto" value={query}
            onChange={(e) => { setQuery(e.target.value); setMatchAt(0) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); nextMatch(e.shiftKey ? -1 : 1) } }}
          />
          {searching && <span className={styles.count} role="status">{matches.length ? `${matchAt + 1}/${matches.length}` : 'sin resultados'}</span>}
        </div>
        <div className={styles.group}>
          <button type="button" aria-label="Alejar" onClick={() => zoomAt(0.8, undefined, undefined, true)}>−</button>
          <button type="button" aria-label="Acercar" onClick={() => zoomAt(1.25, undefined, undefined, true)}>+</button>
          <button type="button" aria-label="Ajustar a la pantalla" onClick={() => fitAll()}>Ajustar</button>
          <button type="button" aria-label={`Orientación: ${orientation === 'down' ? 'vertical' : 'horizontal'}. Cambiar`} onClick={flip}>{orientation === 'down' ? '⇣' : '⇢'}</button>
          <button type="button" aria-pressed={allFolded} onClick={toggleAll}>{allFolded ? 'Desplegar' : 'Plegar'}</button>
          <button type="button" aria-pressed={fullscreen} onClick={toggleFullscreen}>{fullscreen ? 'Cerrar' : 'Ampliar'}</button>
        </div>
        <div className={styles.group} role="group" aria-label="Exportar">
          <button type="button" onClick={() => exportSvg(data, layout, colors)}>SVG</button>
          <button type="button" onClick={() => void doPng()}>PNG</button>
          <button type="button" onClick={() => exportJson(data)}>JSON</button>
        </div>
      </div>

      <div className={styles.frame}>
        <div
          ref={stageRef} className={styles.stage}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
          onClick={() => { if (tapped()) select(null) }}
          onKeyDown={(e) => { if (e.key === 'Escape') select(null) }}
        >
          <svg className={styles.svg} width="100%" height="100%" role="group" aria-label="Mapa conceptual">
            <defs>
              <marker id={`arr-${artifactId}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" className={styles.arrowHead} /></marker>
            </defs>
            <g className={styles.world} data-smooth={smooth} style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
              <AnimatePresence initial={false}>
                {links.map((l) => {
                  const a = layout.boxes.get(l.source)!
                  const b = layout.boxes.get(l.target)!
                  const g = edgeGeometry(a, b, l.label, orientation)
                  const on = selection?.kind === 'edge' && selection.id === l.id
                  const near = !focusIds || (focusIds.has(l.source) && focusIds.has(l.target))
                  const dim = searching ? !(matchSet.has(l.source) || matchSet.has(l.target)) : !near
                  const choose = () => { if (tapped()) select({ kind: 'edge', id: l.id }) }
                  return (
                    <motion.g
                      key={l.id} className={styles.edge} data-kind={l.kind} data-selected={on} data-dim={dim}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}
                    >
                      <motion.path className={styles.line} markerEnd={`url(#arr-${artifactId})`} initial={{ d: g.d }} animate={{ d: g.d }} transition={spring} />
                      <motion.path
                        className={styles.hit} initial={{ d: g.d }} animate={{ d: g.d }} transition={spring} role="button" tabIndex={0}
                        aria-label={`Proposición: ${nodeById.get(l.source)?.label} ${l.label} ${nodeById.get(l.target)?.label}`}
                        onClick={(e) => { e.stopPropagation(); choose() }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select({ kind: 'edge', id: l.id }) } }}
                      />
                      <motion.g
                        className={styles.pill} initial={{ x: g.mx, y: g.my }} animate={{ x: g.mx, y: g.my }} transition={spring}
                        onClick={(e) => { e.stopPropagation(); choose() }}
                      >
                        <rect x={-g.w / 2} y={-9} width={g.w} height={18} rx={9} />
                        <text y={3.5} textAnchor="middle">{l.label.length > 28 ? `${l.label.slice(0, 27)}…` : l.label}</text>
                      </motion.g>
                    </motion.g>
                  )
                })}
              </AnimatePresence>
              <AnimatePresence initial={false}>
                {[...layout.boxes.values()].map((b) => {
                  const n = nodeById.get(b.id)!
                  const root = b.id === data.root_id
                  const from = enterFrom(b.id)
                  const color = colors.get(sourceOf(n) ?? '')
                  const kids = tree.children.get(b.id)?.length ?? 0
                  const lh = Math.round((root ? ROOT_FONT : NODE_FONT) * 1.25)
                  const isSel = selection?.kind === 'node' && selection.id === b.id
                  return (
                    <motion.g
                      key={b.id} className={styles.node} data-root={root} data-kind={n.kind} data-selected={isSel} data-dim={dimNode(b.id)}
                      data-match={searching && matchSet.has(b.id)} data-fresh={fresh.has(b.id)}
                      initial={{ x: from.cx, y: from.cy, opacity: 0, scale: 0.8 }} animate={{ x: b.cx, y: b.cy, opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }} transition={spring}
                      role="button" tabIndex={0} aria-label={`${n.label}${n.kind === 'ejemplo' ? ' (ejemplo)' : ''}`}
                      onClick={(e) => { e.stopPropagation(); if (tapped()) select({ kind: 'node', id: b.id }) }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectNode(b.id) } }}
                    >
                      <rect className={styles.box} x={-b.w / 2} y={-b.h / 2} width={b.w} height={b.h} rx={n.kind === 'ejemplo' ? b.h / 2 : 7} />
                      {color && <rect x={-b.w / 2 + 1} y={-b.h / 2 + 6} width={3} height={b.h - 12} rx={1.5} fill={color} />}
                      {b.lines.map((line, i) => (
                        <text key={i} className={styles.label} y={-b.h / 2 + (root ? 11 : 9) + lh * (i + 0.8)} textAnchor="middle">{line}</text>
                      ))}
                      {kids > 0 && (
                        <g
                          className={styles.fold} transform={`translate(0 ${b.h / 2})`} role="button" tabIndex={0} aria-expanded={!collapsed.has(b.id)}
                          aria-label={`${collapsed.has(b.id) ? 'Mostrar' : 'Ocultar'} rama de ${n.label}`}
                          onClick={(e) => { e.stopPropagation(); if (tapped()) toggle(b.id) }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggle(b.id) } }}
                        >
                          <circle r={compact ? 11 : 9} />
                          <text y={3.5} textAnchor="middle">{collapsed.has(b.id) ? `+${descendants(data, b.id)}` : '−'}</text>
                        </g>
                      )}
                      {kids === 0 && (
                        <g
                          className={styles.plus} data-busy={expanding === b.id} role="button" tabIndex={0} aria-busy={expanding === b.id}
                          transform={orientation === 'right' ? `translate(${b.w / 2} 0)` : `translate(0 ${b.h / 2})`}
                          aria-label={`Expandir ${n.label}`}
                          onClick={(e) => { e.stopPropagation(); if (tapped() && expanding === null) doExpand(b.id) }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (expanding === null) doExpand(b.id) } }}
                        >
                          <circle r={compact ? 12 : 9} />
                          {expanding === b.id
                            ? <circle className={styles.spin} r={compact ? 6 : 4.5} />
                            : <path d="M-4 0H4M0 -4V4" />}
                        </g>
                      )}
                    </motion.g>
                  )
                })}
              </AnimatePresence>
            </g>
          </svg>
          {!compact && <MiniMap layout={layout} view={view} size={{ w: W, h: H }} selected={selection?.kind === 'node' ? selection.id : null} onJump={(wx, wy) => go({ ...viewRef.current, x: (W - (cardOpen ? CARD_W : 0)) / 2 - viewRef.current.k * wx, y: H / 2 - viewRef.current.k * wy })} />}
          {!selection && <p className={styles.hint}>Arrastrá para moverte, rueda o pellizco para acercar. Tocá un concepto o una línea.</p>}
          {note && <p className={styles.toast} role="status">{note}</p>}
        </div>
        <AnimatePresence mode="wait">
          {node && (
            <NodeCard
              key={`n-${node.id}`} data={data} node={node}
              folded={(tree.children.get(node.id)?.length ?? 0) > 0 ? collapsed.has(node.id) : null}
              expanding={expanding === node.id} error={failure} askFailed={askFailed}
              onSelect={selectNode} onSelectLink={(id) => select({ kind: 'edge', id })}
              onAsk={() => setAskFailed(!ask(`Explicame "${node.label}" y cómo se relaciona con los demás conceptos, según las fuentes.`))}
              onExpand={() => doExpand(node.id)} onCenter={() => centerOn(node.id, 1)} onToggle={() => toggle(node.id)}
              onClose={() => select(null)}
            />
          )}
          {link && <EdgeCard key={`e-${link.id}`} data={data} link={link} onSelect={selectNode} onClose={() => select(null)} />}
        </AnimatePresence>
      </div>

      <ul className={styles.legend} aria-label="Leyenda">
        <li><svg width="28" height="8" aria-hidden="true"><line x1="0" y1="4" x2="28" y2="4" /></svg>jerarquía</li>
        <li><svg width="28" height="8" aria-hidden="true"><line x1="0" y1="4" x2="28" y2="4" strokeDasharray="5 4" /></svg>relación entre ramas</li>
        <li><i className={styles.pillSwatch} />ejemplo</li>
        {legend.map((s) => <li key={s.id}><i style={{ background: colors.get(s.id) }} />{s.alias} · {s.filename}</li>)}
      </ul>
    </div>
  )
}
