import type { SseEvent } from '@/domain/types'
import { request, toApiError } from './client'

const BLOCK_SEPARATOR = /\r?\n\r?\n/
const KNOWN = new Set(['search', 'citations', 'token', 'done', 'error'])

function parseBlock(block: string): SseEvent | null {
  let event = 'message'
  const data: string[] = []
  for (const raw of block.split(/\r?\n/)) {
    if (raw.startsWith(':')) continue // comment / keep-alive
    if (raw.startsWith('event:')) event = raw.slice(6).trim()
    else if (raw.startsWith('data:')) data.push(raw.slice(5).replace(/^ /, ''))
  }
  if (data.length === 0 || !KNOWN.has(event)) return null
  return { event, data: JSON.parse(data.join('\n')) } as SseEvent
}

/** Pure SSE parser over a byte stream. Events end at a blank line; chunks may cut anywhere. */
export async function* parseSse(stream: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let m: RegExpExecArray | null
      while ((m = BLOCK_SEPARATOR.exec(buffer))) {
        const event = parseBlock(buffer.slice(0, m.index))
        buffer = buffer.slice(m.index + m[0].length)
        if (event) yield event
      }
    }
    buffer += decoder.decode()
    const last = buffer.trim() ? parseBlock(buffer) : null
    if (last) yield last
  } finally {
    reader.cancel().catch(() => {})
  }
}

/**
 * POST + SSE. Pre-stream failures (409, 404, 422...) arrive as JSON with an HTTP status
 * and are thrown as ApiClientError; mid-stream failures arrive as an `error` event.
 */
export async function* postSse(path: string, body: unknown, signal?: AbortSignal): AsyncGenerator<SseEvent> {
  const res = await request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok || !res.headers.get('content-type')?.includes('text/event-stream') || !res.body) {
    throw await toApiError(res)
  }
  yield* parseSse(res.body)
}
