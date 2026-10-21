// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { msg } from '@/test/fixtures'
import { HistoryAssistant } from './AssistantMessage'

afterEach(cleanup)

describe('HistoryAssistant', () => {
  it('flags an answer backed by weak evidence, and only that one', () => {
    render(<HistoryAssistant message={msg({ weak_evidence: true })} />)
    expect(screen.getByText('Evidencia débil')).toBeTruthy()
    cleanup()
    render(<HistoryAssistant message={msg()} />)
    expect(screen.queryByText('Evidencia débil')).toBeNull()
  })
})
