// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { doc } from '@/test/fixtures'
import { DocumentOverview } from './DocumentOverview'

afterEach(cleanup)
const base = { onAsk: vi.fn(), onGenerate: vi.fn(), generating: false, error: null, goToSettings: vi.fn(), compact: false }

describe('DocumentOverview', () => {
  it('ready: shows the summary and starter questions; a click asks it', async () => {
    const onAsk = vi.fn()
    render(<DocumentOverview {...base} onAsk={onAsk} doc={doc({ summary_status: 'ready', summary: 'Un resumen.', suggested_questions: ['¿A?', '¿B?', '¿C?', '¿D?'] })} />)
    expect(screen.getByText('Un resumen.')).toBeTruthy()
    expect(screen.getAllByRole('button')).toHaveLength(3)
    await userEvent.click(screen.getByRole('button', { name: '¿B?' }))
    expect(onAsk).toHaveBeenCalledWith('¿B?')
  })

  it('pending: shows the generating state and no actions', () => {
    render(<DocumentOverview {...base} doc={doc({ summary_status: 'pending' })} />)
    expect(screen.getByText('Generando resumen…')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('skipped/failed: offers "Generar resumen"', async () => {
    const onGenerate = vi.fn()
    render(<DocumentOverview {...base} onGenerate={onGenerate} doc={doc({ summary_status: 'failed' })} />)
    await userEvent.click(screen.getByRole('button', { name: 'Generar resumen' }))
    expect(onGenerate).toHaveBeenCalledTimes(1)
  })

  it('renders nothing until the document is ready', () => {
    const { container } = render(<DocumentOverview {...base} doc={doc({ status: 'processing' })} />)
    expect(container.textContent).toBe('')
  })
})
