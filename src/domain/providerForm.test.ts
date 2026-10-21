import { describe, expect, it } from 'vitest'
import { toProviderIn, toProviderPatch, validate, valuesFrom } from './providerForm'
import type { Provider } from './types'

const chat: Provider = {
  id: 'p1', kind: 'chat', name: 'DS', base_url: 'https://x/v1', model: 'm', api_key_masked: 'sk-****1234',
  dimensions: null, query_prefix: null, document_prefix: null, supports_tools: false,
  default_k: 5, max_k: 15, max_tool_calls: 3,
}

describe('toProviderPatch', () => {
  it('untouched form -> empty patch (key absent)', () => {
    expect(toProviderPatch('chat', valuesFrom(chat), chat)).toEqual({})
  })
  it('replace key + changed model only', () => {
    const v = { ...valuesFrom(chat), model: 'm2', keyAction: 'replace' as const, api_key: 'sk-new' }
    expect(toProviderPatch('chat', v, chat)).toEqual({ model: 'm2', api_key: 'sk-new' })
  })
  it('clear key -> api_key null', () => {
    expect(toProviderPatch('chat', { ...valuesFrom(chat), keyAction: 'clear' }, chat)).toEqual({ api_key: null })
  })
})

describe('validate', () => {
  it('rejects default_k > max_k before sending', () => {
    expect(validate('chat', { ...valuesFrom(chat), default_k: '20' }).default_k).toBeTruthy()
  })
})

const vision: Provider = { ...chat, id: 'v1', kind: 'vision', name: 'Visión', model: 'deepseek-flash' }

describe('vision profiles', () => {
  it('validate: only name / url / model, no k fields', () => {
    expect(validate('vision', valuesFrom(vision))).toEqual({})
    expect(validate('vision', { ...valuesFrom(vision), model: '' }).model).toBeTruthy()
  })
  it('payload carries no chat or embedding fields', () => {
    const body = toProviderIn('vision', { ...valuesFrom(vision), api_key: 'sk-x' })
    expect(body).toEqual({ kind: 'vision', name: 'Visión', base_url: 'https://x/v1', model: 'deepseek-flash', api_key: 'sk-x' })
  })
  it('patch: untouched -> empty; changed model only', () => {
    expect(toProviderPatch('vision', valuesFrom(vision), vision)).toEqual({})
    expect(toProviderPatch('vision', { ...valuesFrom(vision), model: 'otro' }, vision)).toEqual({ model: 'otro' })
  })
})
