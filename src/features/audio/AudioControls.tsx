import { memo, type ReactNode } from 'react'
import { nextRate, rateLabel } from '@/domain/audio'
import { formatTime } from '@/domain/time'
import { useTimeSelector, type TimeStore } from './useAudioPlayer'
import styles from './AudioControls.module.css'

const Time = memo(function Time({ store, duration }: { store: TimeStore; duration: number | null }) {
  const t = useTimeSelector(store, (x) => Math.floor(x))
  return <p className={styles.time} aria-hidden="true"><b>{formatTime(t)}</b><span> / {duration ? formatTime(duration) : '--:--'}</span></p>
})

interface Props {
  store: TimeStore
  playing: boolean
  rate: number
  onToggle: () => void
  onSkip: (delta: number) => void
  onRate: (rate: number) => void
  duration: number | null
  auto: boolean
  loop: boolean
  onAuto: (v: boolean) => void
  onLoop: (v: boolean) => void
  /** Extra buttons at the end of the bar (video: fullscreen). */
  extra?: ReactNode
}

/** Transport: ∓10 s, play / pause, time readout, speed, "reproducir al citar" and "repetir tramo". */
export function AudioControls({ store, playing, rate, onToggle, onSkip, onRate, duration, auto, loop, onAuto, onLoop, extra }: Props) {
  return (
    <div className={styles.bar} role="group" aria-label="Reproductor">
      <button type="button" className={styles.skip} onClick={() => onSkip(-10)} aria-label="Retroceder 10 segundos" title="Retroceder 10 s">−10</button>
      <button type="button" className={styles.play} data-playing={playing} onClick={onToggle} aria-label={playing ? 'Pausar' : 'Reproducir'} aria-keyshortcuts="Space" title="Espacio">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          {playing ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /> : <path d="M8 5.2v13.6a.6.6 0 0 0 .9.5l11-6.8a.6.6 0 0 0 0-1L8.9 4.7a.6.6 0 0 0-.9.5z" />}
        </svg>
      </button>
      <button type="button" className={styles.skip} onClick={() => onSkip(10)} aria-label="Adelantar 10 segundos" title="Adelantar 10 s">+10</button>
      <Time store={store} duration={duration} />
      <span className={styles.gap} />
      <button type="button" className={styles.opt} onClick={() => onRate(nextRate(rate))} aria-label={`Velocidad ${rateLabel(rate)}`} title="Velocidad de reproducción">{rateLabel(rate)}</button>
      <button type="button" className={styles.opt} aria-pressed={auto} onClick={() => onAuto(!auto)} title="Reproducir desde el inicio del tramo al tocar una cita">Auto</button>
      <button type="button" className={styles.opt} aria-pressed={loop} onClick={() => onLoop(!loop)} title="Repetir el tramo citado en lugar de detenerse al final">Repetir</button>
      {extra}
    </div>
  )
}
