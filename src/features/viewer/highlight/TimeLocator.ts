import { rangeBand } from '@/domain/time'
import type { HighlightLocator, HighlightResult, HighlightTarget, TextSurface } from './types'

/**
 * Audio / video citations: the backend ships seconds, so the "highlight" is a band over the time axis: x/w are
 * fractions of the recording's duration (independent of waveform width). No `t_start` -> page-only (nothing
 * to seek to). Unknown duration or end -> still `time` (the viewer seeks) but with no band to draw.
 */
export class TimeLocator implements HighlightLocator {
  async locate(target: HighlightTarget, surface: TextSurface): Promise<HighlightResult> {
    if (target.tStart == null || !Number.isFinite(target.tStart)) return { quality: 'page-only', ranges: [] }
    const band = rangeBand(target.tStart, target.tEnd, surface.duration?.() ?? null)
    if (!band) return { quality: 'time', ranges: [] }
    return { quality: 'time', ranges: [{ page: null, start: 0, end: 0, rects: [{ x: band.x, y: 0, w: band.w, h: 1 }], box: true }] }
  }
}
