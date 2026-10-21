import { useCallback, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listChunks } from '@/api/documents'
import { audioSrc } from '@/api/media'
import { keys } from '@/api/queryKeys'
import { citedSegment, currentSegment, toSegments } from '@/domain/audio'
import type { Citation, Document as Doc } from '@/domain/types'
import type { HighlightResult, TextSurface } from '@/features/viewer/highlight/types'
import { isTyping } from '@/ui/typing'
import { AudioControls } from './AudioControls'
import { Transcript } from './Transcript'
import { useCitationPlayback } from './useCitationPlayback'
import { useAudioPlayer, useTimeSelector } from './useAudioPlayer'
import { useWaveform } from './useWaveform'
import { Waveform } from './Waveform'
import styles from './AudioViewer.module.css'

interface Props {
  doc: Doc
  citation: Citation | null
  seq: number
  onTrace: (seq: number, result: HighlightResult) => void
  /** Sits right under the waveform, sharing its time axis (the X-ray time strip). */
  footer?: ReactNode
}

const AUTO_KEY = 'chatpdf.audio.autoplay'
const readAuto = () => { try { return localStorage.getItem(AUTO_KEY) !== '0' } catch { return true } }
const saveAuto = (v: boolean) => { try { localStorage.setItem(AUTO_KEY, v ? '1' : '0') } catch { /* private mode */ } }

/**
 * Center column for an audio source: waveform + transport on top, the synchronized transcript below. A single
 * `<audio>` (Range-capable original). A citation seeks to its `t_start`, draws its range on the waveform and
 * plays it (stopping or looping at `t_end`), unless the browser blocks the autoplay: then it only seeks.
 */
export function AudioViewer({ doc, citation, seq, onTrace, footer }: Props) {
  const player = useAudioPlayer()
  const { store, playing, rate, toggle, skip, play, playRange, setRate, setLoop: armLoop, range, duration: elDuration, failed, attach, seek } = player
  const wave = useWaveform(doc.id)
  const chunks = useQuery({ queryKey: keys.documentChunks(doc.id), queryFn: () => listChunks(doc.id), staleTime: 60_000, retry: false })
  const segments = useMemo(() => toSegments(chunks.data ?? []), [chunks.data])
  const duration = doc.duration_s ?? wave.duration ?? elDuration
  const current = useTimeSelector(store, (t) => currentSegment(segments, t))
  const [auto, setAuto] = useState(readAuto)
  const [loop, setLoop] = useState(false)

  const surface = useMemo<TextSurface>(() => ({ pageText: async () => null, rects: () => [], pageSize: () => null, duration: () => duration }), [duration])
  const { cit, t0, t1 } = useCitationPlayback({ docId: doc.id, citation, seq, player: { playRange, seek, play }, surface, auto, loop, onTrace })
  const cited = cit ? citedSegment(segments, cit) : -1

  const onKey = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return
    const t = e.target as HTMLElement
    if (e.key === ' ' && !t.closest('button, a')) player.toggle()
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') player.skip(e.key === 'ArrowRight' ? 5 : -5)
    else return
    e.preventDefault()
  // eslint-disable-next-line -- `player` is a fresh object each render; its methods only read refs
  }, [player.toggle, player.skip])

  if (failed) {
    return <p className={styles.state} role="alert">Audio no disponible. Las citas siguen mostrando su fragmento.</p>
  }
  const seekTo = seek
  return (
    <div className={styles.root} aria-label={`Documento ${doc.filename}`} tabIndex={-1} onKeyDown={onKey}>
      <audio ref={attach} src={audioSrc(doc.id)} preload="metadata" />
      <section className={styles.deck} aria-label="Reproductor de audio">
        <Waveform
          peaks={wave.peaks} flat={wave.flat} duration={duration} store={store} segments={segments} current={current}
          cite={t0 != null ? { start: t0, end: t1 } : null} seq={seq} label={`Posición en ${doc.filename}`} onSeek={seekTo}
        />
        {footer}
        <AudioControls
          store={store} playing={playing} rate={rate} onToggle={toggle} onSkip={skip} onRate={setRate}
          duration={duration} auto={auto} loop={loop}
          onAuto={(v) => { setAuto(v); saveAuto(v) }} onLoop={(v) => { setLoop(v); armLoop(v) }}
        />
        {range && <p className={styles.range} role="status">Tramo citado: {loop ? 'se repite' : 'se detiene al final'}</p>}
      </section>
      <Transcript
        segments={segments} current={current} cited={cited} citedN={cit && cit.n > 0 ? cit.n : null} seq={seq}
        onSeek={(s) => seekTo(s.start)}
      />
    </div>
  )
}
