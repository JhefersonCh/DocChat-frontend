import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { segmentThumbUrl } from '@/api/media'
import { formatTime, rangeBand, timeFrac, xToTime } from '@/domain/time'
import { frameAt, framePositions, tileCount, tileFrames, type Frame } from '@/domain/video'
import { BBoxOverlay } from '@/features/viewer/BBoxOverlay'
import { useTimeSelector, type TimeStore } from '@/features/audio/useAudioPlayer'
import styles from './Filmstrip.module.css'

const MIN_TILE = 72
const POP_W = 148

interface Props {
  frames: readonly Frame[]
  duration: number | null
  store: TimeStore
  /** The cited range: amber box that draws itself in; `seq` replays it. */
  cite: { start: number; end: number | null } | null
  /** Index of the cited frame (-1 = none): its thumbnails and its tick light up. */
  citedFrame: number
  seq: number
  onSeek: (t: number) => void
}

/** The playhead repaints every frame on its own: the tiles must not. */
function Head({ store, duration }: { store: TimeStore; duration: number | null }) {
  const t = useTimeSelector(store, (x) => x)
  return <span className={styles.head} style={{ left: `${timeFrac(t, duration) * 100}%` }} />
}

/**
 * The video's storyboard on the same time axis as the waveform and the X-ray strip: one tile per slot, each
 * showing the frame on screen at its centre, a tick at every keyframe's real second, the playhead, the cited
 * range. Pointer down / drag scrubs; hover pops the frame under the cursor with its time.
 */
export function Filmstrip({ frames, duration, store, cite, citedFrame, seq, onSeek }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<number | null>(null)
  const scrubbing = useRef(false)

  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const read = () => setWidth(el.clientWidth)
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = tileCount(width, MIN_TILE)
  const tiles = useMemo(() => tileFrames(frames, n, duration), [frames, n, duration])
  const ticks = useMemo(() => framePositions(frames, duration), [frames, duration])
  const band = cite ? rangeBand(cite.start, cite.end, duration, 8 / Math.max(width, 1)) : null
  const citedId = citedFrame >= 0 ? frames[citedFrame]?.id : null

  const at = (e: { clientX: number }) => {
    const r = root.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, w: r.width }
  }
  const onDown = (e: ReactPointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    scrubbing.current = true
    const { x, w } = at(e)
    onSeek(xToTime(x, w, duration))
  }
  const onMove = (e: ReactPointerEvent) => {
    const { x, w } = at(e)
    setHover(Math.min(Math.max(x, 0), w))
    if (scrubbing.current) onSeek(xToTime(x, w, duration))
  }
  const hoverT = hover != null && duration ? xToTime(hover, width, duration) : null
  const hoverFrame = hoverT != null ? frames[Math.max(0, frameAt(frames, hoverT))] : null

  return (
    <div className={styles.wrap}>
      <div
        ref={root} className={styles.strip} data-filmstrip data-duration={duration ?? ''} aria-hidden="true"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => { scrubbing.current = false }}
        onPointerCancel={() => { scrubbing.current = false }} onPointerLeave={() => setHover(null)}
      >
        <div className={styles.tiles} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {tiles.length === 0
            ? Array.from({ length: n }, (_, i) => <span key={i} className={styles.tile} />)
            : tiles.map((fi, i) => {
              const f = frames[fi]
              return (
                <span key={i} className={styles.tile} data-cited={!!citedId && f.id === citedId}>
                  {f.thumb && <img src={segmentThumbUrl(f.id)} alt="" loading="lazy" decoding="async" draggable={false} />}
                </span>
              )
            })}
        </div>
        <div className={styles.ticks}>
          {ticks.map((t) => <span key={t.id} className={styles.tick} data-cited={t.id === citedId} style={{ left: `${t.x * 100}%` }} />)}
        </div>
        {band && <BBoxOverlay key={seq} rect={{ x: band.x, y: 0.04, w: band.w, h: 0.92 }} />}
        <Head store={store} duration={duration} />
      </div>
      {hoverT != null && hover != null && (
        <div className={styles.pop} aria-hidden="true" style={{ left: Math.min(Math.max(hover, POP_W / 2), Math.max(width - POP_W / 2, POP_W / 2)) }}>
          {hoverFrame?.thumb && <img src={segmentThumbUrl(hoverFrame.id)} alt="" width={POP_W} />}
          <b>{formatTime(hoverT)}</b>
        </div>
      )}
    </div>
  )
}
