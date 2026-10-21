import { describe, expect, it } from 'vitest'
import { encodeWav } from './wav'

describe('encodeWav', () => {
  it('writes a canonical 16 kHz mono PCM16 header', () => {
    const view = new DataView(encodeWav(new Float32Array([0, 1, -1, 0.5]), 16_000))
    const tag = (o: number) => String.fromCharCode(...[0, 1, 2, 3].map((i) => view.getUint8(o + i)))
    expect([tag(0), tag(8), tag(12), tag(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data'])
    expect(view.getUint32(24, true)).toBe(16_000)
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(40, true)).toBe(8)
    expect(view.getInt16(46, true)).toBe(32767)
    expect(view.getInt16(48, true)).toBe(-32768)
  })

  it('clamps out-of-range samples', () => {
    const view = new DataView(encodeWav(new Float32Array([5, -5])))
    expect([view.getInt16(44, true), view.getInt16(46, true)]).toEqual([32767, -32768])
  })
})
