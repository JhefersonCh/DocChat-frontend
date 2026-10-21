import { afterEach, describe, expect, it, vi } from 'vitest'
import { audioSrc, getWaveform } from './media'

afterEach(() => vi.unstubAllGlobals())

describe('getWaveform', () => {
  it('returns the cleaned peaks and duration', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ peaks: [0, 0.4, 1.5], duration_s: 61 })))
    await expect(getWaveform('d1')).resolves.toEqual({ peaks: [0, 0.4, 1], duration_s: 61 })
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe('/api/v1/documents/d1/waveform')
  })
  it('falls back to null (flat line) on 404, network failure or a malformed body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ code: 'waveform_not_found', message: 'x' }, { status: 404 })))
    await expect(getWaveform('d1')).resolves.toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('down') }))
    await expect(getWaveform('d1')).resolves.toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ peaks: 'nope' })))
    await expect(getWaveform('d1')).resolves.toBeNull()
  })
  it('the audio element reads the original file endpoint (Range)', () => {
    expect(audioSrc('d1')).toBe('/api/v1/documents/d1/file')
  })
})
