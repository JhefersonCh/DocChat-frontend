import type { ApiError } from '@/domain/types'

export const API_BASE = '/api/v1'

/** Normalized error: backend `{code,message}` + HTTP status (0 when no response). */
export class ApiClientError extends Error implements ApiError {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ApiClientError'
    this.code = code
    this.status = status
  }
}

function isApiError(body: unknown): body is ApiError {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as ApiError).code === 'string' &&
    typeof (body as ApiError).message === 'string'
  )
}

/** Error from a non-ok response. Never trusts `message` for logic; callers branch on `code`. */
export async function toApiError(res: Response): Promise<ApiClientError> {
  const body: unknown = await res.json().catch(() => null)
  return isApiError(body)
    ? new ApiClientError(body.code, body.message, res.status)
    : new ApiClientError('http_error', `HTTP ${res.status}`, res.status)
}

/** `fetch` that maps a network failure to `network_error`; AbortError passes through. */
export async function request(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE}${path}`, init)
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new ApiClientError('network_error', 'El backend no responde', 0)
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await request(path, init)
  if (!res.ok) throw await toApiError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
