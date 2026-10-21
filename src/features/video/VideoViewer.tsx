import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listChunks } from '@/api/documents'
import { segmentAssetUrl, videoSrc } from '@/api/media'
import { keys } from '@/api/queryKeys'
import { citedSegment, currentSegment, toSegments } from '@/domain/audio'
import type { Citation, Document as Doc } from '@/domain/types'
import { citedFrame, frameAt, mergeTimeline } from '@/domain/video'
import { AudioControls } from '@/features/audio/AudioControls'
import { Transcript } from '@/features/audio/Transcript'
import { useAudioPlayer, useTimeSelector } from '@/features/audio/useAudioPlayer'
import { useCitationPlayback } from '@/features/audio/useCitationPlayback'
import { useWaveform } from '@/features/audio/useWaveform'
import { Waveform } from '@/features/audio/Waveform'
import type { HighlightResult, TextSurface } from '@/features/viewer/highlight/types'
import { isTyping } from '@/ui/typing'
import { Filmstrip } from './Filmstrip'
import { useFrames } from './useFrames'
import styles from './VideoViewer.module.css'

interface Props {
  doc: Doc
  citation: Citation | null
  seq: number
  onTrace: (seq: number, result: HighlightResult) => void
  /** Under the waveform, on the same time axis (the X-ray time strip). */
  footer?: ReactNode
}

const read = (key: string, fallback: boolean) => { try { const v = localStorage.getItem(key); return v == null ? fallback : v !== '0' } catch { return fallback } }
const save = (key: string, v: boolean) => { try { localStorage.setItem(key, v ? '1' : '0') } catch { /* private mode */ } }
const AUTO_KEY = 'chatpdf.audio.autoplay'
const CAPS_KEY = 'chatpdf.video.captions'

/**
 * Center column for a video: the picture with its transport, the filmstrip, the waveform of the audio track and
 * the X-ray strip on ONE time axis, then the synchronized transcript with the frame captions interleaved (collapsible).
 * A citation (a frame, or what is said at that moment) seeks the video, draws its range on the lanes and plays it.
 */
export function VideoViewer({ doc, citation, seq, onTrace, footer }: Props) {
  const player = useAudioPlayer()
  const { store, playing, rate, toggle, skip, play, playRange, setRate, setLoop: armLoop, range, duration: elDuration, failed, attach, seek } = player
  const wave = useWaveform(doc.id)
  const chunks = useQuery({ queryKey: keys.documentChunks(doc.id), queryFn: () => listChunks(doc.id), staleTime: 60_000, retry: false })
  const duration = doc.duration_s ?? wave.duration ?? elDuration
  const segments = useMemo(() => toSegments(chunks.data ?? []), [chunks.data])
  const frames = useFrames(doc.id, chunks.data, duration)
  const [auto, setAuto] = useState(() => read(AUTO_KEY, true))
  const [loop, setLoop] = useState(false)
  const [caps, setCaps] = useState(() => read(CAPS_KEY, true))
  const [full, setFull] = useState(false)
  const deck = useRef<HTMLElement>(null)

  const heard = useTimeSelector(store, (t) => currentSegment(segments, t))
  const shown = useTimeSelector(store, (t) => frameAt(frames, t))
  const surface = useMemo<TextSurface>(() => ({ pageText: async () => null, rects: () => [], pageSize: () => null, duration: () => duration }), [duration])
  const { cit, t0, t1 } = useCitationPlayback({ docId: doc.id, citation, seq, player: { playRange, seek, play }, surface, auto, loop, onTrace })

  const line = useMemo(() => mergeTimeline(segments, frames, caps), [segments, frames, caps])
  const frameCited = citedFrame(frames, cit)
  const speechCited = cit?.kind === 'audio' ? citedSegment(segments, cit) : -1
  const citedRow = frameCited >= 0 ? line.frameAt[frameCited] ?? -1 : speechCited >= 0 ? line.audioAt[speechCited] ?? -1 : -1

  useEffect(() => {
    const sync = () => setFull(document.fullscreenElement === deck.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])
  const fullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void deck.current?.requestFullscreen?.()
  }, [])

  const onKey = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return
    const t = e.target as HTMLElement
    if (e.key === ' ' && !t.closest('button, a')) toggle()
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') skip(e.key === 'ArrowRight' ? 5 : -5)
    else if (e.key === 'f' || e.key === 'F') fullscreen()
    else return
    e.preventDefault()
  }, [toggle, skip, fullscreen])

  const poster = frames[0]?.thumb ? segmentAssetUrl(frames[0].id) : undefined
  const ratio = doc.width && doc.height ? `${doc.width} / ${doc.height}` : '16 / 9'
  return (
    <div className={styles.root} aria-label={`Documento ${doc.filename}`} tabIndex={-1} onKeyDown={onKey}>
      <section ref={deck} className={styles.deck} aria-label="Reproductor de video" data-full={full}>
        <div className={styles.stage}>
          {failed
            ? <p className={styles.state} role="alert">El navegador no pudo reproducir este video. Las citas siguen mostrando su fotograma y su transcripción.</p>
            : (
              <>
                <video ref={attach} className={styles.video} style={{ aspectRatio: ratio }} src={videoSrc(doc.id)} poster={poster} preload="metadata" playsInline onClick={toggle} onDoubleClick={fullscreen} />
                <button type="button" className={styles.big} data-playing={playing} tabIndex={-1} aria-hidden="true" onClick={toggle}>
                  <svg viewBox="0 0 24 24" width="28" height="28"><path d="M8 5.2v13.6a.6.6 0 0 0 .9.5l11-6.8a.6.6 0 0 0 0-1L8.9 4.7a.6.6 0 0 0-.9.5z" /></svg>
                </button>
              </>
            )}
        </div>
        <Filmstrip frames={frames} duration={duration} store={store} cite={t0 != null ? { start: t0, end: t1 } : null} citedFrame={frameCited} seq={seq} onSeek={seek} />
        <Waveform
          peaks={wave.peaks} flat={wave.flat} duration={duration} store={store} segments={segments} current={heard} compact
          cite={t0 != null ? { start: t0, end: t1 } : null} seq={seq} label={`Posición en ${doc.filename}`} onSeek={seek}
        />
        {footer}
        <AudioControls
          store={store} playing={playing} rate={rate} onToggle={toggle} onSkip={skip} onRate={setRate}
          duration={duration} auto={auto} loop={loop}
          onAuto={(v) => { setAuto(v); save(AUTO_KEY, v) }} onLoop={(v) => { setLoop(v); armLoop(v) }}
          extra={<button type="button" className={styles.fs} aria-pressed={full} onClick={fullscreen} aria-keyshortcuts="F" title="Pantalla completa (F)">{full ? 'Salir' : 'Pantalla'}</button>}
        />
        {range && <p className={styles.range} role="status">Tramo citado: {loop ? 'se repite' : 'se detiene al final'}</p>}
      </section>
      <div className={styles.lower}>
        <div className={styles.tbar}>
          <span>Transcripción</span>
          {frames.some((f) => f.caption) && (
            <button type="button" className={styles.cap} aria-pressed={caps} onClick={() => { setCaps(!caps); save(CAPS_KEY, !caps) }}>Descripciones de fotogramas</button>
          )}
        </div>
        <Transcript
          segments={line.items} current={heard >= 0 ? line.audioAt[heard] ?? -1 : -1} currentAlt={shown >= 0 ? line.frameAt[shown] ?? -1 : -1}
          cited={citedRow} citedN={cit && cit.n > 0 ? cit.n : null} seq={seq} onSeek={(s) => seek(s.start)}
        />
      </div>
    </div>
  )
}
