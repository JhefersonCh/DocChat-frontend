// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Citation } from '@/domain/types'
import { CitationChip } from './CitationChip'
import { TraceContext } from './TraceContext'

afterEach(cleanup)

const citation: Citation = {
  n: 2, document_id: 'd', filename: 'a.pdf', page: 5, page_end: null, chunk_id: 'c1', content: 'full',
  snippet: 'S E C C I Ó N 0 1 El plazo de entrega', section: '3. Plazos', score: 0.874,
}

function setup() {
  const onCiteSelect = vi.fn()
  render(
    <TraceContext.Provider value={{ activeCitation: null, seq: 0, origin: null, onCiteSelect }}>
      <CitationChip citation={citation} group={[citation]} />
    </TraceContext.Provider>,
  )
  return { chip: screen.getByRole('button', { name: /Cita 2/ }), onCiteSelect }
}

describe('CitationChip preview', () => {
  it('shows section, page, relevance and the display snippet on keyboard focus, and hides on blur/Escape', async () => {
    const { chip } = setup()
    expect(screen.queryByRole('tooltip')).toBeNull()
    await userEvent.tab()
    const tip = screen.getByRole('tooltip')
    expect(chip.getAttribute('aria-describedby')).toBe(tip.id)
    expect(tip.textContent).toContain('3. Plazos')
    expect(tip.textContent).toContain('p. 5')
    expect(tip.textContent).toContain('87%')
    expect(tip.textContent).toContain('SECCIÓN 01 El plazo de entrega')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('tooltip')).toBeNull()
    await userEvent.tab({ shift: true }); await userEvent.tab()
    await userEvent.tab()
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('shows on mouse hover after a short delay and click still selects the citation', async () => {
    const { chip, onCiteSelect } = setup()
    fireEvent.pointerEnter(chip, { pointerType: 'mouse' })
    expect(await screen.findByRole('tooltip')).toBeTruthy()
    fireEvent.pointerLeave(chip, { pointerType: 'mouse' })
    expect(screen.queryByRole('tooltip')).toBeNull()
    await userEvent.click(chip)
    expect(onCiteSelect).toHaveBeenCalledWith(citation, expect.objectContaining({ group: [citation] }))
  })

  it('an image citation previews its thumbnail (lazy, from the segment endpoint) and the "Imagen · pág. · zona" label', async () => {
    const image: Citation = { ...citation, n: 3, kind: 'image', bbox: [0.1, 0.05, 0.9, 0.25], has_thumb: true, snippet: 'Foto de un gato', section: null }
    render(
      <TraceContext.Provider value={{ activeCitation: null, seq: 0, origin: null, onCiteSelect: vi.fn() }}>
        <CitationChip citation={image} group={[image]} />
      </TraceContext.Provider>,
    )
    await userEvent.tab()
    const tip = screen.getByRole('tooltip')
    const img = tip.querySelector('img')!
    expect(img.getAttribute('src')).toBe('/api/v1/segments/c1/thumb')
    expect(img.getAttribute('loading')).toBe('lazy')
    expect(tip.textContent).toContain('Imagen · pág. 5 · zona superior')
    expect(tip.textContent).toContain('Foto de un gato')
  })

  it('an image citation without a thumbnail never requests one', async () => {
    const image: Citation = { ...citation, kind: 'image', has_thumb: false, bbox: null }
    render(
      <TraceContext.Provider value={{ activeCitation: null, seq: 0, origin: null, onCiteSelect: vi.fn() }}>
        <CitationChip citation={image} group={[image]} />
      </TraceContext.Provider>,
    )
    await userEvent.tab()
    expect(screen.getByRole('tooltip').querySelector('img')).toBeNull()
  })
})
