import { useState } from 'react'
import { motion } from 'motion/react'
import type { ApiClientError } from '@/api/client'
import { Button } from '@/ui/Button'
import { ErrorNote } from '@/ui/ErrorNote'
import { fade } from '@/ui/motion'
import { useSpeech } from './speechContext'
import { VoiceOrb } from './VoiceOrb'
import type { useVoiceMode, VoicePhase } from './useVoiceMode'
import styles from './VoicePanel.module.css'

const LABEL: Record<VoicePhase, string> = {
  off: '',
  loading: 'Preparando el micrófono…',
  listening: 'Escuchando',
  hearing: 'Te escucho',
  transcribing: 'Transcribiendo…',
  thinking: 'Pensando…',
  speaking: 'Hablando',
  error: 'Sin voz',
}

const HINT: Partial<Record<VoicePhase, string>> = {
  loading: 'La primera vez descarga el detector de voz (~17 MB).',
  listening: 'Hablá cuando quieras: detecto cuándo terminás.',
  speaking: 'Hablá para interrumpir.',
}

type Voice = ReturnType<typeof useVoiceMode>

export function VoicePanel({ voice, onSettings }: { voice: Voice; onSettings: () => void }) {
  const speech = useSpeech()
  const [down, setDown] = useState(false)
  const { phase, error } = voice
  const ptt = voice.mode === 'ptt' && phase !== 'error'

  const release = () => { setDown(false); voice.pttStop() }
  return (
    <motion.section
      className={styles.panel} aria-label="Modo voz"
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={fade}
    >
      <div className={styles.row}>
        <VoiceOrb phase={phase} level={voice.level} />
        <div className={styles.text}>
          <p className={styles.label} role="status" aria-live="polite">{ptt && phase === 'listening' ? 'Pulsar para hablar' : LABEL[phase]}</p>
          {voice.heard && phase !== 'error' ? <p className={styles.heard} title={voice.heard}>“{voice.heard}”</p> : HINT[phase] && <p className={styles.hint}>{ptt && phase === 'listening' ? 'No se pudo cargar el detector automático.' : HINT[phase]}</p>}
        </div>
        <div className={styles.actions}>
          {speech.speaking && <Button onClick={speech.stop}>Callar</Button>}
          <Button onClick={voice.disable}>Terminar</Button>
        </div>
      </div>
      {ptt && (
        <button
          type="button" className={styles.ptt} data-down={down}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDown(true); void voice.pttStart() }}
          onPointerUp={release} onPointerCancel={release}
          onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { setDown(true); void voice.pttStart() } }}
          onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') release() }}
        >
          {down ? 'Grabando… soltá para enviar' : 'Mantené para hablar'}
        </button>
      )}
      {error && (
        <ErrorNote
          error={error as ApiClientError}
          handlers={{ goToSettings: onSettings, retry: () => { voice.clearError(); voice.disable(); setTimeout(voice.toggle, 0) } }}
        />
      )}
    </motion.section>
  )
}
