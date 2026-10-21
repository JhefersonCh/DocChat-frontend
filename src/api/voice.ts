import { request, toApiError } from './client'

/** 200 {text}. 409 no_stt_profile; 422 audio_too_long / audio_undecodable / empty_audio; provider errors 502. */
export async function transcribe(wav: Blob, signal?: AbortSignal): Promise<string> {
  const form = new FormData()
  form.append('audio', wav, 'audio.wav')
  const res = await request('/voice/transcribe', { method: 'POST', body: form, signal })
  if (!res.ok) throw await toApiError(res)
  return ((await res.json()) as { text: string }).text
}

/** audio/wav bytes. 409 no_tts_profile; 422 nothing_to_speak / text_too_long; provider errors 502. */
export async function speak(text: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const res = await request('/voice/speak', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
    signal,
  })
  if (!res.ok) throw await toApiError(res)
  return res.arrayBuffer()
}
