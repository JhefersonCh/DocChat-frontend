import type { MapLayout } from '@/domain/conceptMap'
import styles from './conceptmap.module.css'

const W = 148
const H = 96

interface Props {
  layout: MapLayout
  view: { x: number; y: number; k: number }
  size: { w: number; h: number }
  selected: string | null
  onJump: (wx: number, wy: number) => void
}

/** Overview of the whole (visible) map with the current viewport; click to jump. */
export function MiniMap({ layout, view, size, selected, onJump }: Props) {
  const pad = 24
  const bw = layout.width + pad * 2
  const bh = layout.height + pad * 2
  const s = Math.min(W / bw, H / bh)
  const ox = (W - bw * s) / 2 - (layout.minX - pad) * s
  const oy = (H - bh * s) / 2 - (layout.minY - pad) * s
  const vx = -view.x / view.k
  const vy = -view.y / view.k
  return (
    <svg
      className={styles.mini} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Vista general del mapa"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        onJump(((e.clientX - r.left) * (W / r.width) - ox) / s, ((e.clientY - r.top) * (H / r.height) - oy) / s)
      }}
    >
      {[...layout.boxes.values()].map((b) => (
        <rect key={b.id} x={ox + (b.cx - b.w / 2) * s} y={oy + (b.cy - b.h / 2) * s} width={Math.max(b.w * s, 2)} height={Math.max(b.h * s, 2)} rx="1" data-selected={b.id === selected} />
      ))}
      <rect className={styles.viewport} x={ox + vx * s} y={oy + vy * s} width={(size.w / view.k) * s} height={(size.h / view.k) * s} />
    </svg>
  )
}
