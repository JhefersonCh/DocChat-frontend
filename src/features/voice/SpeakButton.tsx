import { useSpeech } from './speechContext'
import styles from './voice.module.css'

/** "Escuchar" under a persisted answer: reads it aloud sentence by sentence; again to stop. */
export function SpeakButton({ messageId, text }: { messageId: string; text: string }) {
  const speech = useSpeech()
  const playing = speech.owner === messageId && speech.speaking
  return (
    <button
      type="button" className={styles.listen} data-playing={playing} aria-pressed={playing}
      aria-label={playing ? 'Detener la lectura' : 'Escuchar esta respuesta'}
      onClick={() => (playing ? speech.stop() : speech.speakText(messageId, text))}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 6h2.5L8 3v10L4.5 10H2z" fill="currentColor" stroke="none" />
        {playing ? <path d="M10.5 5.5v5M13 4v8" /> : <path d="M10.5 5.8a3 3 0 0 1 0 4.4M12.5 4a5.5 5.5 0 0 1 0 8" />}
      </svg>
      <span>{playing ? 'Detener' : 'Escuchar'}</span>
    </button>
  )
}
