import { describe, expect, it } from 'vitest'
import { msg } from '@/test/fixtures'
import { suggestionTarget } from './suggestions'

describe('suggestionTarget', () => {
  const u = msg({ id: 'u', role: 'user' })
  const a1 = msg({ id: 'a1' })
  const a2 = msg({ id: 'a2' })
  it('is the last message only when it is an assistant answer and no turn is running', () => {
    expect(suggestionTarget([u, a1, u, a2], false)?.id).toBe('a2')
    expect(suggestionTarget([u, a1, u], false)).toBeUndefined()
    expect(suggestionTarget([u, a1], true)).toBeUndefined()
    expect(suggestionTarget([], false)).toBeUndefined()
  })
})
