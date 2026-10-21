// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AskBridgeProvider } from '@/features/conversation/AskBridge'
import { useAskBridge } from '@/features/conversation/askBridgeContext'
import { SelectionMenu } from './SelectionMenu'

afterEach(cleanup)

const selection = { text: 'El plazo es de 30 días', page: 4, rect: { top: 200, left: 100, width: 80, bottom: 220 } }

function Chat({ ask }: { ask: (q: string) => void }) {
  const { register } = useAskBridge()
  useEffect(() => { register(ask); return () => register(null) })
  return null
}

describe('SelectionMenu', () => {
  it('offers the four actions and sends the quoted passage through the chat', async () => {
    const ask = vi.fn(), done = vi.fn()
    render(<AskBridgeProvider><Chat ask={ask} /><SelectionMenu selection={selection} onDone={done} /></AskBridgeProvider>)
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Explicar', 'Simplificar', 'Definir', 'Traducir'])
    await userEvent.click(screen.getByRole('button', { name: 'Traducir' }))
    expect(ask).toHaveBeenCalledWith(expect.stringContaining('"El plazo es de 30 días"'))
    expect(ask.mock.calls[0]![0]).toContain('página 4')
    expect(done).toHaveBeenCalled()
  })

  it('says so when the chat cannot take a question right now, and renders nothing without a selection', async () => {
    const done = vi.fn()
    const { rerender } = render(<AskBridgeProvider><SelectionMenu selection={selection} onDone={done} /></AskBridgeProvider>)
    await userEvent.click(screen.getByRole('button', { name: 'Explicar' }))
    expect(screen.getByRole('status').textContent).toContain('Esperá')
    expect(done).not.toHaveBeenCalled()
    rerender(<AskBridgeProvider><SelectionMenu selection={null} onDone={done} /></AskBridgeProvider>)
    expect(screen.queryByRole('toolbar')).toBeNull()
  })

  it('has a four-step level slider that shapes the Explicar question', async () => {
    const ask = vi.fn()
    render(<AskBridgeProvider><Chat ask={ask} /><SelectionMenu selection={selection} onDone={vi.fn()} /></AskBridgeProvider>)
    const slider = screen.getByRole('slider', { name: /Nivel/ }) as HTMLInputElement
    expect([slider.min, slider.max, slider.step]).toEqual(['0', '3', '1'])
    expect(screen.getByText('Secundaria')).toBeTruthy()
    fireEvent.change(slider, { target: { value: '3' } })
    expect(screen.getByText('Experto')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Explicar' }))
    expect(ask.mock.calls[0]![0]).toContain('«Experto»')
  })
})
