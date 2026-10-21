// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { updateChatSettings } from '@/api/chats'
import type { Chat } from '@/domain/types'
import { ChatSettings } from './ChatSettings'

vi.mock('@/api/chats', () => ({ updateChatSettings: vi.fn() }))
const update = vi.mocked(updateChatSettings)

afterEach(() => { cleanup(); update.mockReset() })

const chat: Chat = { id: 'c1', title: 't', created_at: '2026-10-14T00:00:00Z', style: 'normal', length: 'normal', custom_instructions: null, persona: null }

function setup(over: Partial<Chat> = {}) {
  update.mockImplementation(async (_id, changes) => ({ ...chat, ...over, ...changes }))
  render(<QueryClientProvider client={new QueryClient()}><ChatSettings chat={{ ...chat, ...over }} /></QueryClientProvider>)
}

describe('ChatSettings', () => {
  it('opens a popover; picking a style or length persists just that change', async () => {
    setup()
    expect(screen.queryByRole('radiogroup')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Respuesta/ }))
    await userEvent.click(screen.getByRole('radio', { name: 'Conciso' }))
    expect(update).toHaveBeenCalledWith('c1', { style: 'conciso' })
    await userEvent.click(screen.getByRole('radio', { name: 'Larga' }))
    expect(update).toHaveBeenLastCalledWith('c1', { length: 'larga' })
  })

  it('custom style reveals the instructions box, saved on blur', async () => {
    setup({ style: 'custom' })
    await userEvent.click(screen.getByRole('button', { name: /Respuesta/ }))
    const box = screen.getByRole('textbox', { name: /Instrucciones/ })
    await userEvent.type(box, 'Usá viñetas')
    await userEvent.tab()
    expect(update).toHaveBeenCalledWith('c1', { custom_instructions: 'Usá viñetas' })
  })

  it('closes on Escape', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /Respuesta/ }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('radiogroup', { name: /Estilo/ })).toBeNull()
  })

  it('persona: free text saved on blur, chips from the overview, cleared with null', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /Respuesta/ }))
    await userEvent.type(screen.getByRole('textbox', { name: /Voz/ }), 'el zorro')
    await userEvent.tab()
    expect(update).toHaveBeenCalledWith('c1', { persona: 'el zorro' })
    await userEvent.click(screen.getByRole('button', { name: 'el autor' }))
    expect(update).toHaveBeenLastCalledWith('c1', { persona: 'el autor' })
  })

  it('persona: "Quitar voz" clears it', async () => {
    setup({ persona: 'el zorro' })
    await userEvent.click(screen.getByRole('button', { name: /Voz: el zorro/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Quitar voz' }))
    expect(update).toHaveBeenLastCalledWith('c1', { persona: null })
  })
})
