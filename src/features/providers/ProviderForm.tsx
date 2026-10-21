import { useState, type FormEvent } from 'react'
import { describeError } from '@/domain/errors'
import {
  emptyValues, toProviderIn, toProviderPatch, validate, valuesFrom,
  type FormErrors, type ProviderFormValues,
} from '@/domain/providerForm'
import type { ApiError, Provider, ProviderIn, ProviderKind, ProviderPatch } from '@/domain/types'
import { Button } from '@/ui/Button'
import { ErrorNote } from '@/ui/ErrorNote'
import { Field } from '@/ui/Field'
import styles from './ProviderForm.module.css'

interface Props {
  kind: ProviderKind
  initial?: Provider
  submitting: boolean
  error: ApiError | null
  onCreate: (body: ProviderIn) => void
  onPatch: (body: ProviderPatch) => void
  onCancel: () => void
}

const URL_HINT: Partial<Record<ProviderKind, string>> = {
  chat: 'Sin /chat/completions al final',
  vision: 'Sin /chat/completions al final (acepta image_url en data URL)',
}
const URL_HINT_V1 = (kind: ProviderKind, v: ProviderFormValues) =>
  kind === 'tts' ? 'Termina en /v1 (el servicio expone /v1/audio/speech)'
    : kind === 'stt'
      ? v.protocol === 'ollama' ? 'Raíz del servidor Ollama, sin /v1' : 'Termina en /v1 (usa /v1/audio/transcriptions)'
      : undefined
const URL_PLACEHOLDER: Record<ProviderKind, string> = {
  chat: 'https://api.deepseek.com/v1', embedding: 'http://embeddings:8080/v1',
  stt: 'http://192.168.100.20:11434', tts: 'http://tts:7788/v1', vision: 'https://api.deepseek.com/v1',
}
const MODEL_PLACEHOLDER: Record<ProviderKind, string> = {
  chat: 'deepseek-chat', embedding: 'embeddinggemma-2', stt: 'gemma4:e2b', tts: 'supertonic-3', vision: 'deepseek-flash',
}

export function ProviderForm({ kind, initial, submitting, error, onCreate, onPatch, onCancel }: Props) {
  const [v, setV] = useState<ProviderFormValues>(() => (initial ? valuesFrom(initial) : emptyValues()))
  const [errors, setErrors] = useState<FormErrors>({})
  const set = (k: keyof ProviderFormValues) => (e: { target: { value: string } }) => setV((p) => ({ ...p, [k]: e.target.value }))
  const serverFields = (error && describeError(error).fields) || {}
  const err = (k: keyof ProviderFormValues) => errors[k] ?? serverFields[k]

  function submit(e: FormEvent) {
    e.preventDefault()
    const found = validate(kind, v)
    setErrors(found)
    if (Object.keys(found).length) return
    if (initial) onPatch(toProviderPatch(kind, v, initial))
    else onCreate(toProviderIn(kind, v))
  }

  const editing = !!initial
  const keyControls = editing && (
    <div className={styles.keyActions}>
      {v.keyAction === 'keep' ? (
        <>
          <Button onClick={() => setV((p) => ({ ...p, keyAction: 'replace' }))}>Reemplazar</Button>
          {initial.api_key_masked && (
            <Button variant="danger" onClick={() => setV((p) => ({ ...p, keyAction: 'clear', api_key: '' }))}>Borrar</Button>
          )}
        </>
      ) : (
        <Button onClick={() => setV((p) => ({ ...p, keyAction: 'keep', api_key: '' }))}>Cancelar</Button>
      )}
    </div>
  )

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <Field label="Nombre" value={v.name} onChange={set('name')} error={err('name')} placeholder="DeepSeek" />
      <Field label="Base URL" value={v.base_url} onChange={set('base_url')} error={err('base_url')}
        hint={URL_HINT[kind] ?? URL_HINT_V1(kind, v)} placeholder={URL_PLACEHOLDER[kind]} inputMode="url" />
      <Field label="Modelo" value={v.model} onChange={set('model')} error={err('model')} placeholder={MODEL_PLACEHOLDER[kind]} />
      {kind === 'stt' && (
        <div className={styles.protocol} role="group" aria-label="Protocolo">
          <span className={styles.protocolLabel}>Protocolo</span>
          <Button variant={v.protocol === 'ollama' ? 'solid' : 'ghost'} aria-pressed={v.protocol === 'ollama'}
            onClick={() => setV((p) => ({ ...p, protocol: 'ollama' }))}>Ollama nativo</Button>
          <Button variant={v.protocol === 'openai' ? 'solid' : 'ghost'} aria-pressed={v.protocol === 'openai'}
            onClick={() => setV((p) => ({ ...p, protocol: 'openai' }))}>OpenAI /v1/audio</Button>
        </div>
      )}
      {kind === 'tts' && (
        <Field label="Voz" value={v.voice} onChange={set('voice')} error={err('voice')} placeholder="F2" hint="Supertonic: F1–F5, M1–M5" />
      )}
      {(kind === 'stt' || kind === 'tts') && (
        <Field label="Idioma" value={v.language} onChange={set('language')} error={err('language')} placeholder="es" hint="Código ISO" />
      )}
      <Field
        label="API key"
        type="text"
        className={v.keyAction === 'keep' ? undefined : styles.secret}
        name="provider-secret"
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        spellCheck={false}
        value={v.keyAction === 'keep' ? (initial?.api_key_masked ?? '') : v.api_key}
        onChange={set('api_key')}
        readOnly={v.keyAction === 'keep'}
        disabled={v.keyAction === 'clear'}
        placeholder={v.keyAction === 'clear' ? 'se borrará al guardar' : editing ? 'nueva key' : 'opcional (modelos locales)'}
        hint={editing ? 'La key guardada nunca se muestra completa' : undefined}
        error={err('api_key')}
        adornment={keyControls}
      />
      {kind === 'stt' || kind === 'tts' || kind === 'vision' ? null : kind === 'chat' ? (
        <div className={styles.grid3}>
          <Field label="default_k" inputMode="numeric" value={v.default_k} onChange={set('default_k')} error={err('default_k')} />
          <Field label="max_k" inputMode="numeric" value={v.max_k} onChange={set('max_k')} error={err('max_k')} />
          <Field label="max_tool_calls" inputMode="numeric" value={v.max_tool_calls} onChange={set('max_tool_calls')} error={err('max_tool_calls')} />
        </div>
      ) : (
        <>
          <Field label="Dimensiones" inputMode="numeric" value={v.dimensions} onChange={set('dimensions')}
            error={err('dimensions')} hint="Vacío: se autodetecta al probar" />
          <Field label="query_prefix" value={v.query_prefix} onChange={set('query_prefix')} />
          <Field label="document_prefix" value={v.document_prefix} onChange={set('document_prefix')} hint="Admite {title}" />
          {editing && <p className={styles.warn}>Cambiar modelo o prefijos de un perfil con documentos hace incomparables sus vectores. Creá un perfil nuevo.</p>}
        </>
      )}
      {error && !Object.keys(serverFields).length && <ErrorNote error={error} />}
      <div className={styles.actions}>
        <Button type="submit" variant="solid" disabled={submitting}>{submitting ? 'Guardando…' : editing ? 'Guardar' : 'Crear perfil'}</Button>
        <Button onClick={onCancel} disabled={submitting}>Cancelar</Button>
      </div>
    </form>
  )
}
