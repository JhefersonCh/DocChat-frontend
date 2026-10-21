import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { animate, useReducedMotion } from 'motion/react'
import { isAudioCitation } from '@/domain/audio'
import { isVideoCitation, isVideoTimed } from '@/domain/video'
import { boxLanding, isImageCitation } from '@/domain/media'
import { timeLanding } from '@/domain/time'
import { useTrace } from '@/features/conversation/TraceContext'
import { easeInOut } from '@/ui/motion'
import { useIsPhone } from '@/ui/useMediaQuery'
import styles from './TraceThread.module.css'

const EDGE = 14 // px inside the page's right edge where the thread lands

/**
 * Plan §6 #5b: a 1 px amber thread travels from the clicked chip/note to the viewer, landing where the
 * highlight will settle (30 % down the viewport, same as the page jump). Pure imperative overlay (no React
 * state per click): portaled, never intercepts input. Off on phones (the sheet is the trace there) and
 * with reduced motion.
 */
export function TraceThread() {
  const { origin, seq, activeCitation } = useTrace()
  const calm = useReducedMotion()
  const phone = useIsPhone()
  const group = useRef<SVGGElement>(null)
  const line = useRef<SVGPathElement>(null)
  const dot = useRef<SVGCircleElement>(null)
  const played = useRef(seq) // mounting with an old selection must not replay it

  useEffect(() => {
    if (seq === played.current) return
    played.current = seq
    const g = group.current, path = line.current, end = dot.current
    const view = document.querySelector('[data-viewer] [aria-label^="Documento"]')
    const chat = document.querySelector('[aria-label^="Conversación"]')
    if (!origin?.isConnected || !g || !path || !end || !view || !chat || calm || phone) return

    const o = origin.getBoundingClientRect()
    const v = view.getBoundingClientRect()
    const x1 = o.left, y1 = o.top + o.height / 2
    const page = view.querySelector('[data-page], article')?.getBoundingClientRect()
    let x2 = Math.min(page?.right ?? v.right, v.right) - EDGE, y2 = v.top + v.height * 0.3
    // Image region: land on the box itself (where the page jump will leave it), not at the generic spot.
    const sheet = activeCitation?.page != null ? view.querySelector(`[data-page="${activeCitation.page}"]`)?.getBoundingClientRect() : null
    const land = activeCitation && isImageCitation(activeCitation) && activeCitation.bbox && sheet
      ? boxLanding(sheet, sheet.height, activeCitation.bbox, v) : null
    if (land) { x2 = Math.min(land.x + 6, v.right - EDGE); y2 = land.y }
    // Audio / video range: land on the left edge of its band (filmstrip for a frame, waveform for sound).
    const timed = activeCitation && (isAudioCitation(activeCitation) || isVideoTimed(activeCitation))
    const wave = timed ? view.querySelector(isVideoCitation(activeCitation) ? '[data-filmstrip]' : '[data-waveform]') : null
    if (wave) {
      const w = wave.getBoundingClientRect()
      const at = timeLanding(w, Number(wave.getAttribute('data-duration')) || null, activeCitation?.t_start)
      if (at) { x2 = Math.min(at.x + 4, w.right - 4); y2 = at.y }
    }
    const xm = chat.getBoundingClientRect().left - 14 // turn in the gutter between viewer and chat
    path.setAttribute('d', `M${x1} ${y1} H${xm} V${y2} H${x2}`)
    end.setAttribute('cx', String(x2))
    end.setAttribute('cy', String(y2))
    end.style.transformOrigin = `${x2}px ${y2}px`

    const run = [
      animate(g, { opacity: [1, 1, 0] }, { duration: 1.1, times: [0, 0.62, 1] }),
      animate(path, { pathLength: [0, 1] }, { duration: 0.32, ease: easeInOut, delay: 0.06 }),
      animate(end, { opacity: [0, 1], scale: [0.4, 1] }, { duration: 0.18, delay: 0.38 }),
    ]
    return () => run.forEach((r) => r.stop())
    // eslint-disable-next-line -- a new click (seq) replays the thread; activeCitation changes with it
  }, [seq, origin, calm, phone])

  return createPortal(
    <svg className={styles.svg} aria-hidden="true">
      <g ref={group} opacity={0}>
        <path ref={line} className={styles.line} />
        <circle ref={dot} r={4} className={styles.dot} opacity={0} />
      </g>
    </svg>,
    document.body,
  )
}
