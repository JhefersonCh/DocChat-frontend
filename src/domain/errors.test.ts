import { describe, expect, it } from 'vitest'
import { describeError, parseFieldErrors } from './errors'

describe('parseFieldErrors', () => {
  it('splits "campo: motivo; campo2: motivo2"', () => {
    expect(parseFieldErrors('name: debe tener al menos 1 caracter; default_k: mayor o igual a 1')).toEqual({
      name: 'debe tener al menos 1 caracter',
      default_k: 'mayor o igual a 1',
    })
  })
  it('returns {} for free text', () => {
    expect(parseFieldErrors('UUID mal formado')).toEqual({})
  })
})

describe('describeError', () => {
  it('maps by code, ignoring message', () => {
    const e = describeError({ code: 'no_embedding_profile', message: 'lo que sea' })
    expect(e.actions).toEqual(['goToSettings'])
    expect(e.detail).toBeUndefined()
  })
  it('unknown code -> generic + retry + literal detail', () => {
    const e = describeError({ code: 'xyz', message: 'boom' })
    expect(e.actions).toEqual(['retry'])
    expect(e.detail).toBe('boom')
  })
  it('provider_in_use wording is valid for both DELETE and PATCH', () => {
    const { title } = describeError({ code: 'provider_in_use', message: 'x' })
    expect(title).toMatch(/borrar/)
    expect(title).toMatch(/cambiar/)
  })
  it('invalid_input exposes parsed fields', () => {
    expect(describeError({ code: 'invalid_input', message: 'model: requerido' }).fields).toEqual({ model: 'requerido' })
  })
  it('document_busy -> warn, no action (the polling keeps going)', () => {
    const e = describeError({ code: 'document_busy', message: 'x' })
    expect(e.tone).toBe('warn')
    expect(e.actions).toEqual([])
  })
})
