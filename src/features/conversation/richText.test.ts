import type { Element, ElementContent, Root } from 'hast'
import { describe, expect, it } from 'vitest'
import { rehypeRich } from './richText'

const t = (value: string): ElementContent => ({ type: 'text', value })
const el = (tagName: string, ...children: ElementContent[]): Element => ({ type: 'element', tagName, properties: {}, children })
const root = (...children: ElementContent[]): Root => ({ type: 'root', children })

function run(tree: Root, reveal: boolean, seenWords = 0) {
  const stat = { words: 0 }
  rehypeRich({ reveal, seenWords, stat })()(tree)
  return { tree, stat }
}
const kids = (tree: Root) => (tree.children[0] as Element).children
const spans = (tree: Root) => kids(tree).filter((c): c is Element => c.type === 'element')

describe('rehypeRich', () => {
  it('splits [n] and [n, m] refs into data-cite spans, orphans included (resolved later)', () => {
    const { tree } = run(root(el('p', t('A [1, 2] b [9].'))), false)
    expect(kids(tree).map((c) => (c.type === 'text' ? c.value : c.type === 'element' ? c.properties.dataCite : null))).toEqual(['A ', '1,2', ' b ', '9', '.'])
  })

  it('leaves code and pre untouched', () => {
    const { tree, stat } = run(root(el('pre', el('code', t('x[1]'))), el('p', el('code', t('y [2]')))), true)
    expect(JSON.stringify(tree)).not.toContain('dataCite')
    expect(stat.words).toBe(0)
  })

  it('chips and word reveal work inside table cells without touching table structure', () => {
    const { tree } = run(root(el('table', el('tbody', el('tr', el('td', t('Rol [2] activo')))))), true)
    const td = (((tree.children[0] as Element).children[0] as Element).children[0] as Element).children[0] as Element
    expect((tree.children[0] as Element).tagName).toBe('table')
    expect(td.tagName).toBe('td')
    const kidsEl = td.children.filter((c): c is Element => c.type === 'element')
    expect(kidsEl.map((c) => c.properties.dataCite ?? 'w')).toEqual(['w', '2', 'w'])
  })

  it('animates only words past seenWords and reports the new total', () => {
    const { tree, stat } = run(root(el('p', t('uno dos tres'))), true, 2)
    const words = spans(tree)
    expect(words).toHaveLength(3)
    expect(words[0]!.properties.style).toBeUndefined()
    expect(words[1]!.properties.style).toBeUndefined()
    expect(words[2]!.properties.style).toBe('animation-delay:0ms')
    expect(stat.words).toBe(3)
  })

  it('caps the whole cascade at 600ms for a single huge token', () => {
    const { tree } = run(root(el('p', t(Array.from({ length: 500 }, (_, i) => `w${i}`).join(' ')))), true)
    const delays = spans(tree).map((c) => Number(/(\d+)ms/.exec(String(c.properties.style))![1]))
    expect(Math.max(...delays)).toBeLessThanOrEqual(600)
    expect(Math.max(...delays)).toBeGreaterThan(500)
  })
})
