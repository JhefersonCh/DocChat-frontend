import { useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import styles from './Composer.module.css'

interface Props {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  onCancel: () => void
  busy: boolean
  /** Why the composer is locked (document not ready); shown, not hidden. */
  lockedReason: string | null
  /** Voice mode: the mic button toggles it. */
  voice?: { on: boolean; onToggle: () => void }
}

export function Composer({ value, onChange, onSend, onCancel, busy, lockedReason, voice }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const locked = lockedReason != null
  const canSend = !locked && !busy && value.trim().length > 0

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`
  }, [value])

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (canSend) onSend()
    }
  }

  return (
    <form className={styles.composer} onSubmit={(e) => { e.preventDefault(); if (canSend) onSend() }}>
      {locked && <p className={styles.reason} role="status">{lockedReason}</p>}
      <div className={styles.row}>
        <textarea
          ref={ref} className={styles.input} rows={1} value={value} disabled={locked}
          aria-label="Pregunta" placeholder="Preguntale al documento…"
          onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown}
        />
        {voice && (
          <button
            type="button" className={`${styles.mic} ${voice.on ? styles.micOn : ''}`} disabled={locked}
            aria-pressed={voice.on} aria-label={voice.on ? 'Terminar el modo voz' : 'Activar el modo voz'}
            title={voice.on ? 'Terminar el modo voz' : 'Modo voz: hablá con el documento'} onClick={voice.onToggle}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="5.5" y="1.5" width="5" height="8" rx="2.5" /><path d="M3 7.5a5 5 0 0 0 10 0M8 12.5v2" />
            </svg>
          </button>
        )}
        {busy ? (
          <button type="button" className={`${styles.send} ${styles.stop}`} aria-label="Cancelar respuesta" onClick={onCancel}>■</button>
        ) : (
          <button type="submit" className={styles.send} disabled={!canSend} aria-label="Enviar">⏎</button>
        )}
      </div>
      {!locked && <p className={styles.hint}>Enter envía · Shift+Enter nueva línea{busy && ' · Esc cancela'}</p>}
    </form>
  )
}
