import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ApiClientError } from '@/api/client'
import { speak } from '@/api/voice'
import { joinFocus, takeFocus } from '@/domain/audioFocus'
import { SentenceSplitter, stripForSpeech } from '@/domain/speech'
import { SpeechQueue } from '@/domain/speechQueue'
import { AudioScheduler } from './audioPlayer'
import { SpeechContext, type SpeechApi, type SpeechJob, type SpeechState } from './speechContext'

const CACHE_SIZE = 40
const SPEAKABLE = /[\p{L}\p{N}]/u
const FATAL = new Set(['no_tts_profile'])

/** Owns the single audio output of the app: Web Audio scheduler + the per-answer speech queue. */
export function SpeechProvider({ children }: { children: ReactNode }) {
  const scheduler = useRef<AudioScheduler | null>(null)
  const queue = useRef<SpeechQueue<AudioBuffer> | null>(null)
  const cache = useRef(new Map<string, ArrayBuffer>())
  const [state, setState] = useState<SpeechState>({ owner: null, sentence: null, speaking: false, error: null })

  const audio = () => (scheduler.current ??= new AudioScheduler())

  const synth = useCallback(async (text: string, signal: AbortSignal) => {
    let bytes = cache.current.get(text)
    if (!bytes) {
      bytes = await speak(text, signal)
      cache.current.set(text, bytes)
      if (cache.current.size > CACHE_SIZE) cache.current.delete(cache.current.keys().next().value!)
    }
    return audio().decode(bytes.slice(0)) // decodeAudioData detaches its input
  }, [])

  const stop = useCallback(() => {
    queue.current?.stop()
    queue.current = null
    setState((s) => ({ ...s, owner: null, sentence: null, speaking: false }))
  }, [])

  // Shared audio focus: a recording playing in the viewer yields to the voice, and the voice yields to a recording.
  useEffect(() => joinFocus('tts', stop), [stop])

  const begin = useCallback((owner: string): SpeechJob => {
    takeFocus('tts')
    queue.current?.stop()
    void audio().unlock() // inside the user gesture that started the answer, when there is one
    setState({ owner, sentence: null, speaking: true, error: null })
    const q: SpeechQueue<AudioBuffer> = new SpeechQueue<AudioBuffer>({
      synth,
      player: audio(),
      onChange: (s) => {
        if (queue.current !== q) return
        setState((prev) => ({ ...prev, sentence: s.current, speaking: !s.idle }))
      },
      onError: (e) => {
        if (queue.current !== q) return
        const error = e instanceof ApiClientError ? e : new ApiClientError('network_error', String(e), 0)
        setState((prev) => ({ ...prev, error }))
        if (FATAL.has(error.code)) q.stop()
      },
    })
    queue.current = q
    const splitter = new SentenceSplitter()
    const feed = (sentences: string[]) => {
      for (const s of sentences) {
        const clean = stripForSpeech(s)
        if (SPEAKABLE.test(clean)) q.enqueue(clean)
      }
    }
    return {
      push: (text) => feed(splitter.push(text)),
      end: () => { feed(splitter.flush()); q.finish() },
    }
  }, [synth])

  const api = useMemo<SpeechApi>(() => ({
    ...state,
    begin,
    speakText: (owner, text) => { const job = begin(owner); job.push(text); job.end() },
    stop,
    retarget: (from, to) => setState((s) => (s.owner === from ? { ...s, owner: to } : s)),
    unlock: async () => { await audio().unlock() },
    clearError: () => setState((s) => ({ ...s, error: null })),
    level: () => scheduler.current?.level() ?? 0,
  }), [state, begin, stop])

  return <SpeechContext.Provider value={api}>{children}</SpeechContext.Provider>
}
