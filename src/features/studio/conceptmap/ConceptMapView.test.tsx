// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConceptMapData, SlideRef } from '@/domain/artifacts'
import { layoutConceptMap } from '@/domain/conceptMap'
import { TraceContext } from '@/features/conversation/TraceContext'
import { doc } from '@/test/fixtures'
import { DocContext } from '../DocContext'
import { ConceptMapView } from './ConceptMapView'

afterEach(cleanup)
const ref = (quote: string, page: number): SlideRef => ({ quote, page, t_start: null, t_end: null, kind: 'text', chunk_id: `c${page}`, document_id: 'd1' })
const data: ConceptMapData = {
  root_id: 'n1',
  nodes: [
    { id: 'n1', label: 'Fotosíntesis', summary: 'Proceso que convierte luz en energía química.', level: 0, kind: 'concepto', refs: [ref('La fotosíntesis produce oxígeno', 2)] },
    { id: 'n2', label: 'Oxígeno', summary: 'Gas liberado.', level: 1, kind: 'concepto', refs: [ref('El oxígeno liberado', 3)] },
    { id: 'n3', label: 'Clorofila', summary: 'Pigmento verde.', level: 1, kind: 'concepto', refs: [ref('La clorofila absorbe la luz', 4)] },
    { id: 'n4', label: 'Hoja de roble', summary: '', level: 2, kind: 'ejemplo', refs: [ref('la hoja del roble', 4)] },
  ],
  links: [
    { id: 'e1', source: 'n1', target: 'n2', label: 'produce', kind: 'jerarquia', refs: [ref('La fotosíntesis produce oxígeno', 2)] },
    { id: 'e2', source: 'n1', target: 'n3', label: 'requiere', kind: 'jerarquia', refs: [ref('La clorofila absorbe la luz', 4)] },
    { id: 'e3', source: 'n3', target: 'n4', label: 'ejemplo de', kind: 'jerarquia', refs: [ref('la hoja del roble', 4)] },
    { id: 'e4', source: 'n2', target: 'n3', label: 'se relaciona con', kind: 'cruce', refs: [ref('El oxígeno liberado', 3)] },
  ],
}

describe('ConceptMapView', () => {
  it('lays out by level, shows labeled links, opens a node card with citation chips and a proposition', async () => {
    const layout = layoutConceptMap(data)
    expect(layout.boxes.get('n1')!.cy).toBeLessThan(layout.boxes.get('n2')!.cy)
    expect(layout.boxes.get('n2')!.cy).toBeLessThan(layout.boxes.get('n4')!.cy)

    const onCite = vi.fn()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TraceContext.Provider value={{ activeCitation: null, seq: 0, origin: null, onCiteSelect: onCite }}>
          <DocContext.Provider value={doc()}><ConceptMapView data={data} chatId="c1" artifactId="a1" /></DocContext.Provider>
        </TraceContext.Provider>
      </QueryClientProvider>,
    )
    expect(await screen.findByText('produce')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Clorofila' }))
    expect(screen.getByRole('complementary', { name: 'Detalle de Clorofila' }).textContent).toContain('Pigmento verde.')
    await userEvent.click(screen.getByRole('button', { name: 'Abrir fuente pág. 4' }))
    expect(onCite).toHaveBeenCalledWith(expect.objectContaining({ page: 4, chunk_id: 'c4', document_id: 'd1' }), expect.anything())
    expect(screen.getByRole('button', { name: 'Expandir' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /Proposición: Fotosíntesis produce Oxígeno/ }))
    expect((await screen.findByRole('complementary', { name: 'Detalle de la proposición' })).textContent).toContain('La fotosíntesis produce oxígeno')
  })
})
