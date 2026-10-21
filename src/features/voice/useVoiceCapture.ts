import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiError } from '@/domain/types'
import { encodeWav } from '@/domain/wav'

export type CaptureStatus = 'off' | 'loading' | 'ready' | 'error'
/** `vad`: hands-free voice activity detection. `ptt`: push-to-talk fallback when the VAD cannot load. */
export type CaptureMode = 'vad' | 'ptt'

interface Options {
  enabled: boolean
  /** A finished utterance as an audio file the backend can read (WAV for the VAD, webm/mp4 for PTT). */
  onUtterance: (audio: Blob) => void
  /** The user started talking (real speech, not a click): cut playback / pending answer. */
  onSpeech: () => void
  /** While the app itself is speaking, ask more of the VAD so its own voice leaking into the mic does not trigger it. */
  strict: boolean
}

const MIC_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true,
}
const NORMAL = { positiveSpeechThreshold: 0.5, negativeSpeechThreshold: 0.35, minSpeechMs: 250, redemptionMs: 900 }
const STRICT = { positiveSpeechThreshold: 0.8, negativeSpeechThreshold: 0.5, minSpeechMs: 450, redemptionMs: 900 }

function micError(e: unknown): ApiError {
  const name = e instanceof DOMException ? e.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return { code: 'mic_denied', message: 'permission denied' }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return { code: 'mic_unavailable', message: 'no microphone' }
  return { code: 'mic_unavailable', message: e instanceof Error ? e.message : String(e) }
}

interface VadHandle {
  start: () => Promise<void>
  destroy: () => Promise<void>
  setOptions: (o: Partial<typeof NORMAL>) => void
}

/** Microphone for voice mode: hands-free VAD (lazy-loaded) with push-to-talk as the fallback. */
export function useVoiceCapture({ enabled, onUtterance, onSpeech, strict }: Options) {
  // `null` while the VAD is still loading; set once it is ready or has failed.
  const [outcome, setOutcome] = useState<{ status: 'ready' | 'error'; mode: CaptureMode; error: ApiError | null } | null>(null)
  const [hearing, setHearing] = useState(false)
  const [recording, setRecording] = useState(false)
  const [pttError, setPttError] = useState<ApiError | null>(null)
  const vad = useRef<VadHandle | null>(null)
  const level = useRef(0)
  const recorder = useRef<{ rec: MediaRecorder; stream: MediaStream } | null>(null)
  const cb = useRef({ onUtterance, onSpeech })
  useEffect(() => { cb.current = { onUtterance, onSpeech } })

  function stopRecorder() {
    const r = recorder.current
    recorder.current = null
    if (!r) return
    r.rec.onstop = null
    if (r.rec.state !== 'inactive') r.rec.stop()
    r.stream.getTracks().forEach((t) => t.stop())
    setRecording(false)
  }

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let handle: VadHandle | null = null
    void (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setOutcome({ status: 'error', mode: 'vad', error: { code: 'mic_insecure', message: 'getUserMedia unavailable' } })
        return
      }
      try {
        const { MicVAD } = await import('./vadLoader').then((m) => m.loadVad())
        const created = await MicVAD.new({
          model: 'v5',
          baseAssetPath: '/vad/',
          onnxWASMBasePath: '/vad/',
          ...NORMAL,
          preSpeechPadMs: 300,
          getStream: () => navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS }),
          onFrameProcessed: (p) => { level.current = level.current * 0.6 + p.isSpeech * 0.4 },
          onSpeechRealStart: () => { setHearing(true); cb.current.onSpeech() },
          onVADMisfire: () => setHearing(false),
          onSpeechEnd: (samples) => { setHearing(false); cb.current.onUtterance(new Blob([encodeWav(samples)], { type: 'audio/wav' })) },
        })
        handle = created as unknown as VadHandle
        if (cancelled) { await created.destroy(); return }
        vad.current = handle
        await created.start()
        setOutcome({ status: 'ready', mode: 'vad', error: null })
      } catch (e) {
        if (cancelled) return
        const mic = micError(e)
        // A denied or missing microphone is final; anything else (assets, wasm, worklet) falls back to push-to-talk.
        if (mic.code === 'mic_denied' || (e instanceof DOMException && e.name === 'NotFoundError')) {
          setOutcome({ status: 'error', mode: 'vad', error: mic })
        } else {
          console.warn('VAD unavailable, falling back to push-to-talk', e)
          setOutcome({ status: 'ready', mode: 'ptt', error: null })
        }
      }
    })()
    return () => {
      cancelled = true
      setHearing(false)
      level.current = 0
      vad.current = null
      void handle?.destroy()
      stopRecorder()
      setOutcome(null)
      setPttError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  useEffect(() => { vad.current?.setOptions(strict ? STRICT : NORMAL) }, [strict])

  /** Push-to-talk: start recording (call on pointer/key down). */
  const pttStart = useCallback(async () => {
    if (recorder.current) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS })
      const rec = new MediaRecorder(stream)
      const chunks: Blob[] = []
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        recorder.current = null
        setRecording(false)
        if (chunks.length) cb.current.onUtterance(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }))
      }
      recorder.current = { rec, stream }
      cb.current.onSpeech()
      rec.start()
      setRecording(true)
    } catch (e) {
      setPttError(micError(e))
    }
  }, [])

  /** Push-to-talk: stop and send (call on pointer/key up). */
  const pttStop = useCallback(() => {
    const r = recorder.current
    if (r && r.rec.state !== 'inactive') r.rec.stop()
  }, [])

  const status: CaptureStatus = !enabled ? 'off' : pttError ? 'error' : (outcome?.status ?? 'loading')
  return {
    status, mode: outcome?.mode ?? 'vad', error: pttError ?? outcome?.error ?? null, hearing: hearing || recording, pttStart, pttStop,
    level: () => (recording ? 0.5 : level.current),
  }
}
