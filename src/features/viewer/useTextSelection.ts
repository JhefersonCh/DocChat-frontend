import { useEffect, useState } from 'react'

export interface TextSelection {
  text: string
  /** Page of the selection's start (PDF pages carry `data-page`); null in continuous text. */
  page: number | null
  /** Viewport rect of the selection: the menu anchors to it. */
  rect: { top: number; left: number; width: number; bottom: number }
}

/** The non-empty selection inside `el` (state-held: the phone sheet mounts it late), kept current on mouse/keyboard selection (not while dragging). */
export function useTextSelection(el: HTMLElement | null): [TextSelection | null, () => void] {
  const [sel, setSel] = useState<TextSelection | null>(null)

  useEffect(() => {
    if (!el) return
    const read = () => {
      const s = window.getSelection()
      const text = s?.toString().trim()
      if (!s || s.rangeCount === 0 || s.isCollapsed || !text || !el.contains(s.anchorNode) || !el.contains(s.focusNode)) {
        return setSel(null)
      }
      const range = s.getRangeAt(0)
      const r = range.getBoundingClientRect()
      const start = range.startContainer
      const page = (start instanceof Element ? start : start.parentElement)?.closest<HTMLElement>('[data-page]')?.dataset.page
      setSel({ text, page: page ? Number(page) : null, rect: { top: r.top, left: r.left, width: r.width, bottom: r.bottom } })
    }
    const onSelectionChange = () => { if (!window.getSelection()?.toString().trim()) setSel(null) }
    el.addEventListener('mouseup', read)
    el.addEventListener('keyup', read)
    el.addEventListener('touchend', read)
    document.addEventListener('selectionchange', onSelectionChange)
    return () => {
      el.removeEventListener('mouseup', read)
      el.removeEventListener('keyup', read)
      el.removeEventListener('touchend', read)
      document.removeEventListener('selectionchange', onSelectionChange)
    }
  }, [el])

  return [sel, () => { window.getSelection()?.removeAllRanges(); setSel(null) }]
}
