import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError, api } from './client'

const stubFetch = (impl: (url: string) => Promise<Response>) => {
  const f = vi.fn(impl)
  vi.stubGlobal('fetch', f)
  return f
}

afterEach(() => vi.unstubAllGlobals())

describe('api', () => {
  it('prefixes /api/v1 and parses JSON', async () => {
    const f = stubFetch(async () => Response.json({ ok: true }))
    await expect(api('/health')).resolves.toEqual({ ok: true })
    expect(f.mock.calls[0]![0]).toBe('/api/v1/health')
  })

  it('returns undefined on 204 without reading a body', async () => {
    stubFetch(async () => new Response(null, { status: 204 }))
    await expect(api('/chats/x', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  it('maps {code,message} bodies to a typed error with status', async () => {
    stubFetch(async () =>
      Response.json({ code: 'chat_not_found', message: 'Chat no encontrado' }, { status: 404 }),
    )
    const err = await api('/chats/x').catch((e) => e)
    expect(err).toBeInstanceOf(ApiClientError)
    expect(err).toMatchObject({ code: 'chat_not_found', message: 'Chat no encontrado', status: 404 })
  })

  it('maps a non-JSON error body to http_error', async () => {
    stubFetch(async () => new Response('<html>bad gateway</html>', { status: 502 }))
    await expect(api('/health')).rejects.toMatchObject({ code: 'http_error', status: 502 })
  })

  it('maps a rejected fetch to network_error', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(api('/health')).rejects.toMatchObject({ code: 'network_error', status: 0 })
  })

  it('lets AbortError through untouched', async () => {
    stubFetch(async () => {
      throw new DOMException('aborted', 'AbortError')
    })
    await expect(api('/health')).rejects.toMatchObject({ name: 'AbortError' })
  })
})
