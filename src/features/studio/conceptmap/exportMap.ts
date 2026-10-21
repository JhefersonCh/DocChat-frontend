import type { ConceptMapData } from '@/domain/artifacts'
import { mapFileName, mapToSvg, type MapLayout } from '@/domain/conceptMap'
import { downloadText } from '@/ui/download'

type Colors = ReadonlyMap<string, string>
const titleOf = (data: ConceptMapData) => data.nodes.find((n) => n.id === data.root_id)?.label ?? 'mapa conceptual'

export function exportSvg(data: ConceptMapData, layout: MapLayout, colors: Colors) {
  downloadText(mapFileName(titleOf(data), 'svg'), mapToSvg(data, layout, colors).svg, 'image/svg+xml;charset=utf-8')
}

export function exportJson(data: ConceptMapData) {
  downloadText(mapFileName(titleOf(data), 'json'), JSON.stringify(data, null, 2), 'application/json;charset=utf-8')
}

/** Rasterizes the SVG export at 2x through a canvas. Resolves false when the browser cannot decode it. */
export async function exportPng(data: ConceptMapData, layout: MapLayout, colors: Colors): Promise<boolean> {
  const { svg, width, height } = mapToSvg(data, layout, colors)
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const scale = Math.min(2, 8000 / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return false
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
    if (!blob) return false
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = mapFileName(titleOf(data), 'png')
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(href), 0)
    return true
  } catch {
    return false
  } finally {
    URL.revokeObjectURL(url)
  }
}
