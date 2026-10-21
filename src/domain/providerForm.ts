// Form <-> API payload mapping for provider profiles (plan §7.4). Pure.
import type { Provider, ProviderIn, ProviderKind, ProviderPatch, SttProtocol } from './types'

export type KeyAction = 'keep' | 'replace' | 'clear'

export interface ProviderFormValues {
  name: string
  base_url: string
  model: string
  api_key: string
  keyAction: KeyAction
  dimensions: string
  query_prefix: string
  document_prefix: string
  default_k: string
  max_k: string
  max_tool_calls: string
  voice: string
  language: string
  protocol: SttProtocol
}

export type FormErrors = Partial<Record<keyof ProviderFormValues, string>>

export function emptyValues(): ProviderFormValues {
  return {
    name: '', base_url: '', model: '', api_key: '', keyAction: 'replace',
    dimensions: '', query_prefix: '', document_prefix: '',
    default_k: '5', max_k: '15', max_tool_calls: '3',
    voice: '', language: 'es', protocol: 'ollama',
  }
}

export function valuesFrom(p: Provider): ProviderFormValues {
  return {
    name: p.name, base_url: p.base_url, model: p.model, api_key: '', keyAction: 'keep',
    dimensions: p.dimensions?.toString() ?? '',
    query_prefix: p.query_prefix ?? '', document_prefix: p.document_prefix ?? '',
    default_k: String(p.default_k), max_k: String(p.max_k), max_tool_calls: String(p.max_tool_calls),
    voice: p.voice ?? '', language: p.language ?? 'es', protocol: p.protocol ?? 'ollama',
  }
}

const isPosInt = (s: string) => /^\d+$/.test(s.trim()) && Number(s) >= 1

export function validate(kind: ProviderKind, v: ProviderFormValues): FormErrors {
  const e: FormErrors = {}
  if (!v.name.trim()) e.name = 'Requerido'
  if (!v.model.trim()) e.model = 'Requerido'
  if (!/^https?:\/\/\S+$/.test(v.base_url.trim())) e.base_url = 'URL http(s) válida'
  if (kind === 'stt' || kind === 'tts') {
    if (!v.language.trim()) e.language = 'Requerido (ej. es)'
    if (kind === 'tts' && !v.voice.trim()) e.voice = 'Requerido (ej. F2)'
  } else if (kind === 'vision') {
    // only name / url / model / key: nothing else to validate
  } else if (kind === 'embedding') {
    if (v.dimensions.trim() && !isPosInt(v.dimensions)) e.dimensions = 'Entero ≥ 1'
  } else {
    for (const k of ['default_k', 'max_k', 'max_tool_calls'] as const) {
      if (!isPosInt(v[k])) e[k] = 'Entero ≥ 1'
    }
    if (!e.default_k && !e.max_k && Number(v.default_k) > Number(v.max_k)) e.default_k = 'No puede superar max_k'
  }
  return e
}

function kindFields(kind: ProviderKind, v: ProviderFormValues) {
  if (kind === 'stt') return { language: v.language.trim(), protocol: v.protocol }
  if (kind === 'tts') return { language: v.language.trim(), voice: v.voice.trim() }
  if (kind === 'vision') return {}
  return kind === 'embedding'
    ? {
        dimensions: v.dimensions.trim() ? Number(v.dimensions) : null,
        query_prefix: v.query_prefix,
        document_prefix: v.document_prefix,
      }
    : { default_k: Number(v.default_k), max_k: Number(v.max_k), max_tool_calls: Number(v.max_tool_calls) }
}

export function toProviderIn(kind: ProviderKind, v: ProviderFormValues): ProviderIn {
  const body: ProviderIn = {
    kind, name: v.name.trim(), base_url: v.base_url.trim(), model: v.model.trim(),
    ...kindFields(kind, v),
  }
  if (v.api_key) body.api_key = v.api_key
  if (kind === 'embedding') {
    if (body.dimensions === null) delete body.dimensions
    if (!v.query_prefix) delete body.query_prefix
    if (!v.document_prefix) delete body.document_prefix
  }
  return body
}

/** PATCH: only changed fields. Key: untouched -> absent, replace -> new value, clear -> null. */
export function toProviderPatch(kind: ProviderKind, v: ProviderFormValues, initial: Provider): ProviderPatch {
  const next = { name: v.name.trim(), base_url: v.base_url.trim(), model: v.model.trim(), ...kindFields(kind, v) }
  const patch: Record<string, unknown> = {}
  for (const [k, val] of Object.entries(next)) {
    const before = initial[k as keyof Provider]
    const same = typeof val === 'string' ? val === (before ?? '') : val === before
    if (!same) patch[k] = val
  }
  if (v.keyAction === 'clear') patch.api_key = null
  else if (v.keyAction === 'replace' && v.api_key) patch.api_key = v.api_key
  return patch as ProviderPatch
}
