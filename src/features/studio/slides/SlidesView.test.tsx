// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Slide, SlidesData } from '@/domain/artifacts'
import { TraceContext } from '@/features/conversation/TraceContext'
import { doc } from '@/test/fixtures'
import { DocContext } from '../DocContext'
import { SlidesView } from './SlidesView'

afterEach(cleanup)
const ref = { quote: 'ventas 150 millones', page: 4, t_start: null, t_end: null, kind: 'text' as const, chunk_id: 'c9', document_id: 'd1' }
const slide = (over: Partial<Slide>): Slide => ({ layout: 'bullets', title: '', bullets: [], notes: '', refs: [], visual: null, ...over })
const deck: SlidesData = {
  title: 'Ventas 2024', subtitle: 'Resumen', style: 'ejecutiva', audience: null,
  slides: [
    slide({ layout: 'title', title: 'Ventas 2024', bullets: ['Resumen'] }),
    slide({ title: 'Crecimiento', bullets: ['Subieron un 25 %'], notes: 'Hablar del 2024.', refs: [ref] }),
    slide({ layout: 'image', title: 'Figura', bullets: ['Gráfico'], refs: [ref], visual: { kind: 'image', segment_id: 's1', caption: 'Barras', page: 4, t_start: null, document_id: 'd1' } }),
  ],
}

function setup(onCiteSelect = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TraceContext.Provider value={{ activeCitation: null, seq: 0, origin: null, onCiteSelect }}>
        <DocContext.Provider value={doc()}><SlidesView data={deck} /></DocContext.Provider>
      </TraceContext.Provider>
    </QueryClientProvider>,
  )
  return onCiteSelect
}

describe('SlidesView', () => {
  it('navigates slides, shows notes, opens a source chip and the presenter', async () => {
    const onCite = setup()
    await userEvent.click(screen.getByRole('button', { name: /Ir a la diapositiva 2/ }))
    expect(screen.getByLabelText('Diapositiva 2 de 3')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Notas' }))
    expect(screen.getByText('Hablar del 2024.')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Abrir fuente pág. 4' }))
    expect(onCite).toHaveBeenCalledWith(expect.objectContaining({ page: 4, chunk_id: 'c9', document_id: 'd1' }), expect.anything())
    await userEvent.click(screen.getByRole('button', { name: 'Presentar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Modo presentación' })
    expect(dialog.textContent).toContain('2 / 3')
    await userEvent.keyboard('{ArrowRight}')
    expect(dialog.textContent).toContain('3 / 3')
    await waitFor(() => expect(dialog.querySelector('img')?.getAttribute('src')).toBe('/api/v1/segments/s1/asset'))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
