// Pure geometry of the standalone image viewer: fit, zoom around a point, pan limits. Origin = container centre.
import { bboxToRect } from './media'
import type { BBox } from './types'

export interface Size { w: number; h: number }
export interface View { zoom: number; x: number; y: number }

export const MIN_ZOOM = 1
export const MAX_ZOOM = 8
export const FIT: View = { zoom: 1, x: 0, y: 0 }

/** Size of the image when it exactly fits the container (zoom 1). Never upscales a small image past 2x. */
export function fitSize(box: Size, img: Size): Size {
  if (box.w <= 0 || box.h <= 0 || img.w <= 0 || img.h <= 0) return { w: 0, h: 0 }
  const s = Math.min(box.w / img.w, box.h / img.h, 2)
  return { w: img.w * s, h: img.h * s }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Keeps the image covering the container: smaller than it on an axis -> centred on that axis. */
export function clampView(v: View, box: Size, fit: Size): View {
  const zoom = clamp(v.zoom, MIN_ZOOM, MAX_ZOOM)
  const lim = (boxN: number, fitN: number) => Math.max(0, (fitN * zoom - boxN) / 2)
  const lx = lim(box.w, fit.w), ly = lim(box.h, fit.h)
  return { zoom, x: clamp(v.x, -lx, lx), y: clamp(v.y, -ly, ly) }
}

/** Zoom by `factor` keeping the content under `point` (px from the container centre) where it is. */
export function zoomAt(v: View, factor: number, point: { x: number; y: number }, box: Size, fit: Size): View {
  const zoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM)
  const k = zoom / v.zoom
  return clampView({ zoom, x: point.x - (point.x - v.x) * k, y: point.y - (point.y - v.y) * k }, box, fit)
}

/** View that frames a bbox (0-1 over the image) with some air around it; zoom 1 when it is nearly the whole image. */
export function frameBBox(bbox: BBox, box: Size, fit: Size, air = 0.7): View {
  const r = bboxToRect(bbox)
  if (!r || fit.w <= 0 || r.w * r.h >= 0.8) return FIT
  const zoom = clamp(Math.min(box.w / (r.w * fit.w), box.h / (r.h * fit.h)) * air, 1, 4)
  const cx = (r.x + r.w / 2 - 0.5) * fit.w, cy = (r.y + r.h / 2 - 0.5) * fit.h
  return clampView({ zoom, x: -cx * zoom, y: -cy * zoom }, box, fit)
}
