// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { joinFocus } from '@/domain/audioFocus'
import { PlayRange } from './PlayRange'
import { rangePlayer } from './rangePlayer'

vi.mock('@/api/media', () => ({ audioSrc: (id: string) => `/api/v1/documents/${id}/file`, getWaveform: vi.fn() }))

let play: ReturnType<typeof vi.fn>
beforeEach(() => {
  play = vi.fn(async () => {})
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: vi.fn() })
  Object.defineProperty(HTMLMediaElement.prototype, 'load', { configurable: true, value: vi.fn() })
  Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { configurable: true, get: () => 4 })
})
afterEach(() => { rangePlayer.stop(); cleanup() })

describe('PlayRange', () => {
  it('plays the range inline from its start, shows a stop state, and a second click stops it', async () => {
    render(<PlayRange docId="a1" start={80} end={100} />)
    await userEvent.click(screen.getByRole('button', { name: 'Escuchar 01:20–01:40' }))
    expect(play).toHaveBeenCalledOnce()
    const stop = screen.getByRole('button', { name: 'Detener 01:20–01:40' })
    expect(stop.getAttribute('aria-pressed')).toBe('true')
    await userEvent.click(stop)
    expect(screen.getByRole('button', { name: 'Escuchar 01:20–01:40' })).toBeTruthy()
  })

  it('takes audio focus: the viewer / the voice are silenced when a preview starts', async () => {
    const silenced = vi.fn()
    const off = joinFocus('viewer', silenced)
    render(<PlayRange docId="a1" start={0} end={20} />)
    await userEvent.click(screen.getByRole('button', { name: /Escuchar/ }))
    expect(silenced).toHaveBeenCalledOnce()
    off()
  })

  it('a second preview cuts the first', async () => {
    render(<><PlayRange docId="a1" start={0} end={20} /><PlayRange docId="a1" start={20} end={40} /></>)
    await userEvent.click(screen.getByRole('button', { name: 'Escuchar 00:00–00:20' }))
    await userEvent.click(screen.getByRole('button', { name: 'Escuchar 00:20–00:40' }))
    expect(screen.getByRole('button', { name: 'Escuchar 00:00–00:20' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Detener 00:20–00:40' })).toBeTruthy()
  })
})
