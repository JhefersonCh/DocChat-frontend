import { BBoxLocator } from './BBoxLocator'
import { RectsLocator } from './RectsLocator'
import { TextMatchLocator } from './TextMatchLocator'
import { TimeLocator } from './TimeLocator'
import type { HighlightLocator, HighlightTarget } from './types'

/** The ONLY place that knows which strategies exist (plan §7.3). */
export function chooseLocator(target: HighlightTarget): HighlightLocator {
  if (target.kind === 'image' && target.bbox) return new BBoxLocator()
  if (target.kind === 'audio' || target.kind === 'video') return new TimeLocator()
  return target.rects?.length ? new RectsLocator() : new TextMatchLocator()
}
