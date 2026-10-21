import type { ChartData, ChartSpec } from '@/domain/artifacts'
import { formatNumber, niceMax, pieAngles } from '@/domain/studio'
import { PageLink } from './PageLink'
import styles from './views.module.css'

const W = 360
const H = 200
const PAD = { l: 40, r: 8, t: 8, b: 28 }
const COLORS = ['var(--amber)', '#7FB7BE', '#C9A0DC', '#9BC53D', '#E07A5F', '#8D99AE']
const color = (i: number) => COLORS[i % COLORS.length]

function Axes({ spec, top }: { spec: ChartSpec; top: number }) {
  const ticks = [0, 0.5, 1]
  const x = (i: number) => PAD.l + ((W - PAD.l - PAD.r) * (i + 0.5)) / spec.labels.length
  return (
    <>
      {ticks.map((t) => {
        const y = H - PAD.b - (H - PAD.b - PAD.t) * t
        return (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="var(--line)" />
            <text x={PAD.l - 4} y={y + 3} textAnchor="end" className={styles.tick}>{formatNumber(top * t)}</text>
          </g>
        )
      })}
      {spec.labels.map((l, i) => (
        <text key={i} x={x(i)} y={H - 10} textAnchor="middle" className={styles.tick}>{l.length > 8 ? `${l.slice(0, 7)}…` : l}</text>
      ))}
    </>
  )
}

function Cartesian({ spec }: { spec: ChartSpec }) {
  const top = niceMax(Math.max(...spec.series.flatMap((s) => s.values), 0))
  const n = spec.labels.length
  const inner = W - PAD.l - PAD.r
  const y = (v: number) => H - PAD.b - ((H - PAD.b - PAD.t) * Math.max(v, 0)) / top
  const cx = (i: number) => PAD.l + (inner * (i + 0.5)) / n
  const bw = inner / n / (spec.series.length + 1)
  return (
    <>
      <Axes spec={spec} top={top} />
      {spec.series.map((s, si) =>
        spec.type === 'bar' ? s.values.map((v, i) => (
          <rect key={`${si}-${i}`} x={cx(i) - (bw * spec.series.length) / 2 + si * bw} y={y(v)} width={bw - 1} height={H - PAD.b - y(v)} fill={color(si)}>
            <title>{`${s.name} · ${spec.labels[i]}: ${formatNumber(v)}`}</title>
          </rect>
        )) : (
          <g key={si}>
            <polyline fill="none" stroke={color(si)} strokeWidth="2" points={s.values.map((v, i) => `${cx(i)},${y(v)}`).join(' ')} />
            {s.values.map((v, i) => <circle key={i} cx={cx(i)} cy={y(v)} r="3" fill={color(si)}><title>{`${s.name} · ${spec.labels[i]}: ${formatNumber(v)}`}</title></circle>)}
          </g>
        ),
      )}
    </>
  )
}

function Pie({ spec }: { spec: ChartSpec }) {
  const values = spec.series[0].values
  const r = 80
  const c = { x: W / 2, y: H / 2 }
  const pt = (a: number) => `${c.x + r * Math.sin(a)},${c.y - r * Math.cos(a)}`
  return (
    <>
      {pieAngles(values).map(({ start, end }, i) => {
        if (end - start < 1e-6) return null
        const full = end - start > Math.PI * 2 - 1e-6
        const d = full
          ? `M ${c.x},${c.y - r} A ${r},${r} 0 1 1 ${c.x - 0.01},${c.y - r} Z`
          : `M ${c.x},${c.y} L ${pt(start)} A ${r},${r} 0 ${end - start > Math.PI ? 1 : 0} 1 ${pt(end)} Z`
        return <path key={i} d={d} fill={color(i)} stroke="var(--bg-1)"><title>{`${spec.labels[i]}: ${formatNumber(values[i])}`}</title></path>
      })}
    </>
  )
}

/** `bare`: only the drawing and legend (a slide supplies its own title and sources). */
export default function ChartView({ data, bare = false }: { data: ChartData; bare?: boolean }) {
  const spec = data.chart
  if (!spec) return <p className={styles.empty}>{data.message ?? 'No se encontraron datos numéricos.'}</p>
  const legend = spec.type === 'pie' ? spec.labels : spec.series.map((s) => s.name)
  return (
    <figure className={styles.chart}>
      {!bare && <figcaption className={styles.h}>{spec.title || 'Gráfico'} <PageLink pageRef={spec} /></figcaption>}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${spec.title || 'Gráfico'}: ${spec.labels.join(', ')}`} className={styles.svg}>
        {spec.type === 'pie' ? <Pie spec={spec} /> : <Cartesian spec={spec} />}
      </svg>
      <ul className={styles.legend}>
        {legend.map((l, i) => <li key={i}><i style={{ background: color(i) }} />{l}</li>)}
      </ul>
      {!bare && <p className={styles.note}>Verificá los valores contra la página de origen.</p>}
    </figure>
  )
}
