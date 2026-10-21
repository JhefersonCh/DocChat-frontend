import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiClientError } from '@/api/client'
import { transcribe } from '@/api/voice'
import type { ApiError } from '@/domain/types'
import { useActive } from '@/features/providers/hooks'
import type { AskPhase } from '@/features/conversation/askReducer'
import { useSpeech, type SpeechJob } from './speechContext'
import { useVoiceCapture } from './useVoiceCapture'

export type VoicePhase = 'off' | 'loading' | 'listening' | 'hearing' | 'transcribing' | 'thinking' | 'speaking' | 'error'

interface Options {
  /** Send a question as if typed (the transcript shows up as the user message). */
  ask: (question: string) => void
  /** Abort the answer in flight without restoring the composer. */
  cancelAsk: () => void
  /** The turn in flight (from `useAskStream`): its tokens are read aloud as they arrive. */
  turn: { phase: AskPhase; text: string; messageId: string | null; active: boolean }
  /** The document is ready to be asked. */
  ready: boolean
}

const TOO_SHORT = 2

/** Hands-free loop: listen -> transcribe -> ask -> speak the streamed answer, interruptible at any moment. */
export function useVoiceMode({ ask, cancelAsk, turn, ready }: Options) {
  const speech = useSpeech()
  const active = useActive()
  const [wanted, setWanted] = useState(false)
  const enabled = wanted && ready // a document that stops being ready ends the session
  const [transcribing, setTranscribing] = useState(false)
  const [heard, setHeard] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const latest = useRef({ ask, cancelAsk, turn, speech })
  useEffect(() => { latest.current = { ask, cancelAsk, turn, speech } })
  const pending = useRef<AbortController | null>(null)

  const sttMissing = enabled && active.data != null && !active.data.stt_profile_id
  const sttError: ApiError | null = sttMissing ? { code: 'no_stt_profile', message: '' } : null

  const onSpeech = useCallback(() => {
    // Barge-in: the user talks over the answer. Silence it and drop what is still being generated.
    const { speech: s, turn: t, cancelAsk: cancel } = latest.current
    s.stop()
    if (t.active) cancel()
  }, [])

  const onUtterance = useCallback(async (audio: Blob) => {
    pending.current?.abort()
    const ctrl = new AbortController()
    pending.current = ctrl
    setTranscribing(true)
    setError(null)
    try {
      const text = (await transcribe(audio, ctrl.signal)).trim()
      if (ctrl.signal.aborted || text.length < TOO_SHORT) return
      setHeard(text)
      latest.current.speech.stop()
      latest.current.ask(text)
    } catch (e) {
      if (ctrl.signal.aborted) return
      setError(e instanceof ApiClientError ? e : { code: 'network_error', message: String(e) })
    } finally {
      if (pending.current === ctrl) { pending.current = null; setTranscribing(false) }
    }
  }, [])

  const capture = useVoiceCapture({
    enabled: enabled && !sttMissing, strict: speech.speaking, onSpeech, onUtterance,
  })

  const enable = useCallback(() => { void speech.unlock(); setError(null); setWanted(true) }, [speech])
  const disable = useCallback(() => {
    pending.current?.abort()
    setTranscribing(false)
    speech.stop()
    setWanted(false)
  }, [speech])
  const toggle = useCallback(() => { if (enabled) disable(); else enable() }, [enabled, enable, disable])

  // Leaving the chat (or the page) ends the session: no orphan mic, no audio from a chat you left.
  useEffect(() => () => { pending.current?.abort(); latest.current.speech.stop() }, [])

  // Read the answer aloud while it streams.
  const job = useRef<SpeechJob | null>(null)
  const consumed = useRef(0)
  const { phase: askPhase, text, messageId } = turn
  useEffect(() => {
    if (!enabled) { job.current = null; return }
    if (askPhase === 'connecting' || askPhase === 'idle' || askPhase === 'cancelled') {
      job.current = null
      consumed.current = 0
      return
    }
    if (text.length > consumed.current) {
      job.current ??= latest.current.speech.begin('live')
      job.current.push(text.slice(consumed.current))
      consumed.current = text.length
    }
    if (askPhase === 'complete' || askPhase === 'failed') {
      job.current?.end()
      job.current = null
    }
  }, [enabled, askPhase, text])
  useEffect(() => { if (messageId) latest.current.speech.retarget('live', messageId) }, [messageId])

  const err = sttError ?? capture.error ?? error ?? (enabled ? speech.error : null)
  const phase: VoicePhase =
    !enabled ? 'off'
    : err && (sttError || capture.status === 'error') ? 'error'
    : capture.status === 'loading' ? 'loading'
    : capture.hearing ? 'hearing'
    : speech.speaking ? 'speaking'
    : transcribing ? 'transcribing'
    : turn.active ? 'thinking'
    : 'listening'

  const level = useCallback(() => (phase === 'speaking' ? latest.current.speech.level() : capture.level()), [phase, capture])

  return {
    enabled, phase, error: err, heard, toggle, disable, level,
    mode: capture.mode, pttStart: capture.pttStart, pttStop: capture.pttStop,
    clearError: () => { setError(null); speech.clearError() },
  }
}
