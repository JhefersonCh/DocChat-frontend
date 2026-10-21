// @vitest-environment jsdom
import { StrictMode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getSuggestions } from '@/api/messages'
import { msg } from '@/test/fixtures'
import { LastSuggestions } from './LastSuggestions'

vi.mock('@/api/messages', () => ({ getSuggestions: vi.fn() }))
const fetchQs = vi.mocked(getSuggestions)

afterEach(() => { cleanup(); fetchQs.mockReset() })

function setup(message: ReturnType<typeof msg>, onPick = vi.fn(), pending = false) {
  const qc = new QueryClient()
  const ui = (m: typeof message, p = pending) => (
    <StrictMode><QueryClientProvider client={qc}><LastSuggestions chatId="c1" message={m} pending={p} onPick={onPick} /></QueryClientProvider></StrictMode>
  )
  const view = render(ui(message))
  return { rerender: (m = message, p = pending) => view.rerender(ui(m, p)), onPick }
}

describe('LastSuggestions', () => {
  it('fetches once (StrictMode + re-renders), shows max 3 chips and a click asks that exact question', async () => {
    fetchQs.mockResolvedValue(['¿Uno?', '¿Dos?', '¿Tres?', '¿Cuatro?'])
    const { rerender, onPick } = setup(msg())
    await screen.findByRole('button', { name: '¿Uno?' })
    rerender(); rerender()
    expect(fetchQs).toHaveBeenCalledTimes(1)
    expect(screen.getAllByRole('button')).toHaveLength(3)
    await userEvent.click(screen.getByRole('button', { name: '¿Dos?' }))
    expect(onPick).toHaveBeenCalledWith('¿Dos?')
  })

  it('uses stored suggestions without calling the backend, and stays silent on failure', async () => {
    setup(msg({ suggestions: ['¿Guardada?'] }))
    expect(screen.getByRole('button', { name: '¿Guardada?' })).toBeTruthy()
    expect(fetchQs).not.toHaveBeenCalled()
    cleanup()
    fetchQs.mockRejectedValue(new Error('boom'))
    setup(msg({ id: 'm2' }))
    await vi.waitFor(() => expect(fetchQs).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('does not fetch while a new turn is pending', () => {
    setup(msg(), vi.fn(), true)
    expect(fetchQs).not.toHaveBeenCalled()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
