import { useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { findRanges, parseTerms } from '@/domain/globalSearch'
import './jump.css'

const NAME = 'search-hit'
const SHOWN_MS = 3200

const highlights = () => (CSS as { highlights?: Map<string, unknown> }).highlights
let active: { el: HTMLElement; timer: number } | null = null

function stopJump() {
  if (!active) return
  window.clearTimeout(active.timer)
  delete active.el.dataset.jump
  highlights()?.delete(NAME)
  active = null
}

/** Ranges of every term inside the text nodes of `root` (a match split across elements is skipped). */
function rangesIn(root: HTMLElement, terms: string[]): Range[] {
  const out: Range[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    for (const [s, e] of findRanges(n.textContent ?? '', terms)) {
      const r = new Range()
      r.setStart(n, s)
      r.setEnd(n, e)
      out.push(r)
    }
  }
  return out
}

/**
 * A search result opens `/chats/:id?msg=<id>&hl=<query>`: once that message is rendered, scroll it into view,
 * pulse it and mark the matched words (CSS Custom Highlight API: no DOM changes, so React is undisturbed).
 * The params are dropped (replace) so a reload or back does not replay it.
 */
export function useJumpToMessage(chatId: string, messageIds: readonly string[], loaded: boolean) {
  const [params, setParams] = useSearchParams()
  // The outgoing chat of the route transition is still mounted while the URL already points at the next one.
  const target = useParams().id === chatId ? params.get('msg') : null
  const hl = params.get('hl') ?? ''
  const present = target != null && messageIds.includes(target)

  useEffect(() => {
    if (!target || (!present && !loaded)) return
    const rest = new URLSearchParams(params)
    rest.delete('msg')
    rest.delete('hl')
    if (!present) { setParams(rest, { replace: true }); return } // the message is gone: nothing to jump to
    const el = document.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(target)}"]`)
    if (!el) return
    stopJump()
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    requestAnimationFrame(() => el.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' }))
    el.dataset.jump = 'on'
    const terms = parseTerms(hl)
    const registry = highlights()
    const HighlightCtor = (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight
    if (registry && HighlightCtor && terms.length) registry.set(NAME, new HighlightCtor(...rangesIn(el, terms)))
    // Not tied to this effect: dropping the params re-runs it, and that must not cut the highlight short.
    active = { el, timer: window.setTimeout(stopJump, SHOWN_MS) }
    setParams(rest, { replace: true })
  }, [target, hl, present, loaded]) // eslint-disable-line react-hooks/exhaustive-deps
}
