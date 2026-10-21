import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SseEvent } from '@/domain/types'
import { parseSse, postSse } from './sse'

const enc = new TextEncoder()

function streamOf(chunks: (string | Uint8Array)[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(typeof ch === 'string' ? enc.encode(ch) : ch)
      c.close()
    },
  })
}

async function collect(it: AsyncIterable<SseEvent>): Promise<SseEvent[]> {
  const out: SseEvent[] = []
  for await (const e of it) out.push(e)
  return out
}

const search = 'event: search\ndata: {"query":"gato","k":5,"hits":3}\n\n'
const citations = 'event: citations\ndata: [{"n":1,"document_id":"d","filename":"t.txt","page":null,"snippet":"s","chunk_id":null,"page_end":null,"content":null}]\n\n'
const token = (t: string) => `event: token\ndata: {"text":"${t}"}\n\n`
const done = 'event: done\ndata: {"message_id":"m1","cited":[1]}\n\n'

describe('parseSse', () => {
  it('yields search -> citations -> token x N -> done in order', async () => {
    const events = await collect(parseSse(streamOf([search, search, citations, token('El '), token('gato [1].'), done])))
    expect(events.map((e) => e.event)).toEqual(['search', 'search', 'citations', 'token', 'token', 'done'])
    expect(events[0]).toEqual({ event: 'search', data: { query: 'gato', k: 5, hits: 3 } })
    expect(events[5]).toEqual({ event: 'done', data: { message_id: 'm1', cited: [1] } })
  })

  it('reassembles events split at arbitrary byte boundaries (even mid-UTF-8)', async () => {
    const bytes = enc.encode(token('año ñandú') + done)
    const chunks = Array.from(bytes, (b) => new Uint8Array([b])) // 1 byte per chunk
    const events = await collect(parseSse(streamOf(chunks)))
    expect(events).toEqual([
      { event: 'token', data: { text: 'año ñandú' } },
      { event: 'done', data: { message_id: 'm1', cited: [1] } },
    ])
  })

  it('handles CRLF, comments, and multi-line data', async () => {
    const raw = ': keep-alive\r\n\r\nevent: token\r\ndata: {"text":\r\ndata: "a\\nb"}\r\n\r\n'
    expect(await collect(parseSse(streamOf([raw])))).toEqual([{ event: 'token', data: { text: 'a\nb' } }])
  })

  it('flushes a final event without trailing blank line', async () => {
    const events = await collect(parseSse(streamOf(['event: done\ndata: {"message_id":"m","cited":[]}'])))
    expect(events).toEqual([{ event: 'done', data: { message_id: 'm', cited: [] } }])
  })

  it('yields a terminal error event after tokens', async () => {
    const err = 'event: error\ndata: {"code":"provider_unreachable","message":"boom"}\n\n'
    const events = await collect(parseSse(streamOf([token('x'), err])))
    expect(events.at(-1)).toEqual({ event: 'error', data: { code: 'provider_unreachable', message: 'boom' } })
  })

  it('ignores unknown event names', async () => {
    expect(await collect(parseSse(streamOf(['event: ping\ndata: {}\n\n', done])))).toHaveLength(1)
  })
})

describe('postSse', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('POSTs JSON and streams events on text/event-stream', async () => {
    const f = vi.fn(async () => new Response(streamOf([done]), { headers: { 'content-type': 'text/event-stream' } }))
    vi.stubGlobal('fetch', f)
    const events = await collect(postSse('/chats/c1/messages', { content: 'hola' }))
    expect(events).toHaveLength(1)
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/chats/c1/messages')
    expect(init).toMatchObject({ method: 'POST', body: '{"content":"hola"}' })
  })

  it('throws the typed error for pre-stream JSON errors', async () => {
    vi.stubGlobal('fetch', async () =>
      Response.json({ code: 'no_chat_profile', message: 'x' }, { status: 409 }),
    )
    await expect(collect(postSse('/chats/c1/messages', { content: 'hola' }))).rejects.toMatchObject({
      code: 'no_chat_profile',
      status: 409,
    })
  })
})
