import { useEffect, useRef } from 'react'
import type { Citation } from '@/domain/types'
import { chooseLocator } from '@/features/viewer/highlight/chooseLocator'
import { toTarget, type HighlightResult, type TextSurface } from '@/features/viewer/highlight/types'
import type { AudioPlayer } from './useAudioPlayer'

/** Last citation click already acted on per document: a remount (phone sheet reopened) must not replay it. */
const handled = new Map<string, number>()

interface Opts {
  docId: string
  citation: Citation | null
  seq: number
  player: Pick<AudioPlayer, 'playRange' | 'seek' | 'play'>
  surface: TextSurface
  auto: boolean
  loop: boolean
  onTrace: (seq: number, result: HighlightResult) => void
}

/**
 * Timed viewers (audio, video): a new citation click seeks to its `t_start`, plays the range (stopping or looping at
 * `t_end`) unless Auto is off or the browser blocks the autoplay, and locates its band on the time axis.
 * Citations of timed sources always go through the time locator, whatever kind they carry.
 */
export function useCitationPlayback({ docId, citation, seq, player, surface, auto, loop, onTrace }: Opts) {
  const run = useRef(0)
  const mine = !!citation && citation.document_id === docId
  const t0 = mine ? citation.t_start ?? null : null
  const t1 = mine ? citation.t_end ?? null : null

  // New click: seek + play the range. Acts once per (document, seq).
  useEffect(() => {
    if (!mine || t0 == null) return
    const fresh = handled.get(docId) !== seq
    handled.set(docId, seq)
    if (t1 != null && t1 > t0) player.playRange(t0, t1, { loop, play: auto && fresh })
    else { player.seek(t0); if (auto && fresh) player.play() }
    // eslint-disable-next-line -- only a new click (seq) re-runs: auto / loop are read as of that click
  }, [seq, mine, t0, t1])

  // Locate (band geometry) as soon as the duration is known.
  useEffect(() => {
    if (!citation || !mine) return
    const id = ++run.current
    const target = { ...toTarget(citation), kind: 'audio' as const }
    void chooseLocator(target).locate(target, surface).then((res) => { if (id === run.current) onTrace(seq, res) })
    // eslint-disable-next-line -- a new click (seq) or the measured duration re-runs the trace
  }, [seq, surface])

  /** The citation when it belongs to this document, else null. */
  return { cit: mine ? citation : null, t0, t1 }
}
