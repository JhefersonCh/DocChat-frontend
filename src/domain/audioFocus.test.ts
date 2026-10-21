import { describe, expect, it, vi } from 'vitest'
import { joinFocus, takeFocus } from './audioFocus'

describe('audio focus', () => {
  it('taking focus silences everyone else, never the taker', () => {
    const viewer = vi.fn(), tts = vi.fn(), preview = vi.fn()
    const off = [joinFocus('viewer', viewer), joinFocus('tts', tts), joinFocus('preview', preview)]
    takeFocus('tts')
    expect(viewer).toHaveBeenCalledOnce()
    expect(preview).toHaveBeenCalledOnce()
    expect(tts).not.toHaveBeenCalled()
    off.forEach((f) => f())
  })
  it('a source that left is not called any more', () => {
    const a = vi.fn()
    const off = joinFocus('a', a)
    off()
    takeFocus('b')
    expect(a).not.toHaveBeenCalled()
  })
})
