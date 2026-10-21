import { useEffect, type RefObject } from 'react'
import { findSpoken } from '@/domain/spokenRange'
import { useSpeech } from './speechContext'

const NAME = 'spoken'

interface HighlightRegistry { set: (name: string, h: unknown) => void; delete: (name: string) => void }
const registry = (): HighlightRegistry | null => (globalThis.CSS as unknown as { highlights?: HighlightRegistry })?.highlights ?? null

/** Marks the sentence being read inside `root` with the CSS Custom Highlight API (no DOM changes, no re-render of the markdown). */
export function SpokenHighlight({ root, owner }: { root: RefObject<HTMLElement | null>; owner: string }) {
  const speech = useSpeech()
  const sentence = speech.owner === owner ? speech.sentence : null
  useEffect(() => {
    const highlights = registry()
    const el = root.current
    if (!highlights || !el || !sentence || typeof Highlight === 'undefined') return
    const nodes: { node: Text; start: number }[] = []
    let text = ''
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      nodes.push({ node: n as Text, start: text.length })
      text += (n as Text).data
    }
    const found = findSpoken(text, sentence)
    if (!found) return
    const locate = (offset: number, end: boolean) => {
      const hit = [...nodes].reverse().find((n) => n.start <= offset - (end ? 1 : 0))
      return hit ? { node: hit.node, offset: offset - hit.start } : null
    }
    const a = locate(found[0], false)
    const b = locate(found[1], true)
    if (!a || !b) return
    const range = new Range()
    range.setStart(a.node, a.offset)
    range.setEnd(b.node, b.offset)
    highlights.set(NAME, new Highlight(range))
    return () => highlights.delete(NAME)
  }, [sentence, root])
  return null
}
