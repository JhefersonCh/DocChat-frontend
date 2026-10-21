// rehype plugin: turns `[n]` refs into <span data-cite> and (while streaming) wraps new
// words in <span class="w"> so only the freshly arrived ones play the reveal (plan §6 #1).
import type { Element, ElementContent, Root } from 'hast'

const REF = /\[(\d+(?:\s*,\s*\d+)*)\]/g
const MAX_STAGGER_MS = 600 // single-token providers: cap the whole cascade
const STEP_MS = 12

export interface RichOptions {
  reveal: boolean
  /** Words already on screen before this render (they must not animate again). */
  seenWords: number
  /** Out: total words after this render. */
  stat: { words: number }
}

const text = (value: string): ElementContent => ({ type: 'text', value })
const span = (properties: Element['properties'], value: string): Element => ({
  type: 'element', tagName: 'span', properties, children: [text(value)],
})

function countWords(root: Root): number {
  let n = 0
  const walk = (children: ElementContent[] | Root['children'], skip: boolean) => {
    for (const c of children) {
      if (c.type === 'text' && !skip) n += (c.value.match(/\S+/g) ?? []).length
      else if (c.type === 'element') walk(c.children, skip || c.tagName === 'code' || c.tagName === 'pre')
    }
  }
  walk(root.children, false)
  return n
}

export function rehypeRich({ reveal, seenWords, stat }: RichOptions) {
  return () => (tree: Root) => {
    const fresh = Math.max(countWords(tree) - seenWords, 1)
    const step = Math.min(STEP_MS, MAX_STAGGER_MS / fresh)
    let index = 0

    const words = (value: string): ElementContent[] =>
      value.split(/(\s+)/).filter(Boolean).map((tok) => {
        if (/^\s+$/.test(tok)) return text(tok)
        const i = index++
        const isNew = i >= seenWords
        return span(isNew ? { className: ['w'], style: `animation-delay:${Math.round((i - seenWords) * step)}ms` } : { className: ['w'] }, tok)
      })

    const split = (value: string): ElementContent[] => {
      const out: ElementContent[] = []
      let last = 0
      for (const m of value.matchAll(REF)) {
        if (m.index > last) out.push(...(reveal ? words(value.slice(last, m.index)) : [text(value.slice(last, m.index))]))
        out.push(span({ dataCite: m[1]!.replace(/\s/g, '') }, m[0]))
        last = m.index + m[0].length
      }
      if (last < value.length) out.push(...(reveal ? words(value.slice(last)) : [text(value.slice(last))]))
      return out
    }

    const visit = (node: Root | Element) => {
      if (node.type === 'element' && (node.tagName === 'code' || node.tagName === 'pre')) return
      node.children = (node.children as ElementContent[]).flatMap((c): ElementContent[] => {
        if (c.type === 'text') return split(c.value)
        if (c.type === 'element') visit(c)
        return [c]
      }) as typeof node.children
    }
    visit(tree)
    stat.words = index
  }
}
