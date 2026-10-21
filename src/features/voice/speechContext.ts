import { createContext, useContext } from 'react'
import type { ApiClientError } from '@/api/client'

/** One spoken answer being fed to the speech engine: push streamed text, then `end()`. */
export interface SpeechJob {
  push: (text: string) => void
  end: () => void
}

export interface SpeechState {
  /** Whose text is being read (message id, or `live` for the turn in flight). */
  owner: string | null
  /** The sentence being heard right now (as spoken: markdown and [n] removed). */
  sentence: string | null
  /** Audio is queued or playing. */
  speaking: boolean
  error: ApiClientError | null
}

export interface SpeechApi extends SpeechState {
  /** Start reading a new answer (anything playing is cut). Call from a user gesture the first time. */
  begin: (owner: string) => SpeechJob
  /** Read a whole text (e.g. a persisted answer). */
  speakText: (owner: string, text: string) => void
  stop: () => void
  /** Re-label what is being read (the live turn gets its message id once persisted). */
  retarget: (from: string, to: string) => void
  /** Browsers only start audio after a gesture: call this from the click that enables voice. */
  unlock: () => Promise<void>
  clearError: () => void
  /** 0..1 loudness of the audio playing now. */
  level: () => number
}

const NOOP_JOB: SpeechJob = { push: () => {}, end: () => {} }

export const SpeechContext = createContext<SpeechApi>({
  owner: null, sentence: null, speaking: false, error: null,
  begin: () => NOOP_JOB, speakText: () => {}, stop: () => {}, retarget: () => {},
  unlock: async () => {}, clearError: () => {}, level: () => 0,
})

export const useSpeech = () => useContext(SpeechContext)
