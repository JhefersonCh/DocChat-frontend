// code -> how the UI should react (plan §7.5). Never branches on `message`.
import type { ApiError } from './types'

export type ErrorAction =
  | 'goToSettings'
  | 'retry'
  | 'reupload'
  | 'newChat'
  | 'backToList'
  | 'refresh'

export type ErrorTone = 'error' | 'warn'

export interface ErrorInfo {
  tone: ErrorTone
  title: string
  actions: ErrorAction[]
  /** Technical detail worth showing verbatim (provider/internal errors), if any. */
  detail?: string
  /** `invalid_input` / `invalid_k`: field -> reason, when the message can be parsed. */
  fields?: Record<string, string>
}

const TABLE: Record<string, Omit<ErrorInfo, 'detail' | 'fields'>> = {
  unsupported_file_type: { tone: 'warn', title: 'Formato no soportado. Subí un pdf, txt, md o una imagen (jpg, png, webp, gif).', actions: [] },
  chat_not_found: { tone: 'error', title: 'Este chat ya no existe.', actions: ['backToList'] },
  document_not_found: { tone: 'error', title: 'El documento no existe.', actions: ['refresh'] },
  file_not_found: { tone: 'warn', title: 'El archivo original ya no está disponible.', actions: [] },
  provider_not_found: { tone: 'error', title: 'El perfil ya no existe.', actions: ['refresh'] },
  chat_has_document: { tone: 'warn', title: 'Este chat ya tiene un documento.', actions: ['newChat'] },
  no_embedding_profile: { tone: 'warn', title: 'Falta un modelo de embeddings activo.', actions: ['goToSettings'] },
  no_chat_profile: { tone: 'warn', title: 'Falta un modelo de chat activo.', actions: ['goToSettings'] },
  no_stt_profile: { tone: 'warn', title: 'Falta un proveedor de voz → texto activo para el modo voz.', actions: ['goToSettings'] },
  no_tts_profile: { tone: 'warn', title: 'Falta un proveedor de texto → voz activo para escuchar respuestas.', actions: ['goToSettings'] },
  audio_too_long: { tone: 'warn', title: 'La grabación supera los 30 segundos.', actions: [] },
  audio_undecodable: { tone: 'warn', title: 'No se pudo procesar el audio.', actions: ['retry'] },
  empty_audio: { tone: 'warn', title: 'No se escuchó nada.', actions: [] },
  nothing_to_speak: { tone: 'warn', title: 'No hay texto para leer en voz alta.', actions: [] },
  mic_denied: { tone: 'warn', title: 'Sin permiso de micrófono. Habilitalo en el navegador (ícono del candado) y volvé a intentar.', actions: ['retry'] },
  mic_unavailable: { tone: 'error', title: 'No se encontró un micrófono disponible.', actions: ['retry'] },
  mic_insecure: { tone: 'error', title: 'El micrófono solo funciona en https o localhost.', actions: [] },
  no_document: { tone: 'warn', title: 'Este chat no tiene documento todavía.', actions: [] },
  document_not_ready: { tone: 'warn', title: 'El documento todavía no está listo.', actions: ['reupload'] },
  embedding_profile_missing: {
    tone: 'error',
    title: 'El perfil de embeddings de este documento fue borrado.',
    actions: ['newChat'],
  },
  no_vision_profile: { tone: 'warn', title: 'Falta un perfil de visión activo para describir las imágenes.', actions: ['goToSettings'] },
  document_busy: { tone: 'warn', title: 'El documento se está procesando. Esperá a que termine.', actions: [] },
  provider_in_use: { tone: 'warn', title: 'Perfil en uso por documentos indexados: no se puede borrar ni cambiar su modelo/prefijos. Creá un perfil nuevo.', actions: [] },
  provider_unreachable: {
    tone: 'error',
    title: 'No se pudo contactar al modelo. Revisá URL y key.',
    actions: ['goToSettings', 'retry'],
  },
  kind_mismatch: { tone: 'error', title: 'El perfil no es del tipo esperado.', actions: ['refresh'] },
  database_unavailable: { tone: 'error', title: 'Servicio no disponible.', actions: ['retry'] },
  network_error: { tone: 'error', title: 'El backend no responde.', actions: ['retry'] },
  invalid_input: { tone: 'error', title: 'Hay campos inválidos.', actions: [] },
  invalid_k: { tone: 'error', title: 'default_k no puede superar max_k.', actions: [] },
}

const SHOW_DETAIL = new Set(['provider_unreachable', 'internal_error', 'http_error'])

/** Parses "campo: motivo; campo2: motivo2" (invalid_input message). Unparseable -> {}. */
export function parseFieldErrors(message: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of message.split(';')) {
    const i = part.indexOf(':')
    if (i <= 0) continue
    const field = part.slice(0, i).trim()
    const reason = part.slice(i + 1).trim()
    if (field && reason && !/\s/.test(field)) out[field] = reason
  }
  return out
}

export function describeError(err: ApiError): ErrorInfo {
  const known = TABLE[err.code]
  const info: ErrorInfo = known
    ? { ...known, actions: [...known.actions] }
    : { tone: 'error', title: 'Algo salió mal.', actions: ['retry'] }
  if (SHOW_DETAIL.has(err.code) || !known) info.detail = err.message
  if (err.code === 'invalid_input') {
    const fields = parseFieldErrors(err.message)
    if (Object.keys(fields).length) info.fields = fields
  }
  return info
}
