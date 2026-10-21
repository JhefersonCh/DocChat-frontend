import { describe, expect, it } from 'vitest'
import { boxLanding, bboxRegion, boxScrollTop, cleanBBox, enrichInfo, imageLabel, segmentTag, thumbId } from './media'

describe('bbox helpers', () => {
  it('cleanBBox clamps to 0..1 and rejects empty / non-finite boxes', () => {
    expect(cleanBBox([-0.1, 0.2, 1.4, 0.6])).toEqual([0, 0.2, 1, 0.6])
    expect(cleanBBox([0.5, 0.5, 0.5, 0.9])).toBeNull()
    expect(cleanBBox([0, 0, Number.NaN, 1])).toBeNull()
    expect(cleanBBox(null)).toBeNull()
  })
  it('bboxRegion speaks in thirds of the page', () => {
    expect(bboxRegion([0.1, 0.05, 0.9, 0.25])).toBe('zona superior')
    expect(bboxRegion([0.05, 0.05, 0.3, 0.3])).toBe('zona superior izquierda')
    expect(bboxRegion([0.7, 0.7, 0.95, 0.95])).toBe('zona inferior derecha')
    expect(bboxRegion([0.05, 0.4, 0.3, 0.6])).toBe('zona izquierda')
    expect(bboxRegion([0.4, 0.4, 0.6, 0.6])).toBe('zona central')
  })
  it('a (nearly) full-page box has no region', () => {
    expect(bboxRegion([0, 0, 1, 1])).toBeNull()
    expect(bboxRegion(null)).toBeNull()
  })
  it('imageLabel: "Imagen · pág. 3 · zona superior"; standalone image has no page', () => {
    expect(imageLabel({ page: 3, page_end: 3, bbox: [0.1, 0.05, 0.9, 0.25] })).toBe('Imagen · pág. 3 · zona superior')
    expect(imageLabel({ page: null, bbox: [0, 0, 1, 1] })).toBe('Imagen')
    expect(imageLabel({ page: 3, bbox: [0.1, 0.05, 0.3, 0.2], region_label: 'colibrí' })).toBe('Imagen · pág. 3 · colibrí')
    expect(imageLabel({ page: 2, page_end: 4 })).toBe('Imagen · pág. 2–4')
  })
  it('thumbId only when the thumbnail exists', () => {
    expect(thumbId({ chunk_id: 'c1', has_thumb: true })).toBe('c1')
    expect(thumbId({ chunk_id: 'c1', has_thumb: false })).toBeNull()
    expect(thumbId({ chunk_id: null, has_thumb: true })).toBeNull()
    expect(thumbId({ chunk_id: 'c1' })).toBeNull()
  })
  it('segmentTag labels media segments by origin', () => {
    expect(segmentTag({ modality: 'image', origin: 'figure' })).toBe('figura')
    expect(segmentTag({ modality: 'image', origin: 'tile' })).toBe('zona')
    expect(segmentTag({ modality: 'text' })).toBeNull()
    expect(segmentTag({})).toBeNull()
  })
})

describe('box framing', () => {
  it('a small box lands at 30 % of the viewport, a tall one is centred', () => {
    // page at 1000, 1000 px high, viewport 500: box y=0.2 h=0.1 -> top at 1200 - 150
    expect(boxScrollTop(1000, 1000, { y: 0.2, h: 0.1 }, 500)).toBe(1050)
    expect(boxScrollTop(1000, 1000, { y: 0.1, h: 0.6 }, 500)).toBe(1000 + 400 - 250)
  })
  it('the trace thread lands on the right edge of the box', () => {
    const p = boxLanding({ left: 100, width: 600 }, 800, [0.1, 0.2, 0.5, 0.3], { top: 50, height: 500 })!
    expect(p.x).toBe(100 + 0.5 * 600)
    expect(p.y).toBe(50 + 150 + (0.1 * 800) / 2)
    expect(boxLanding({ left: 0, width: 1 }, 1, [0.5, 0.5, 0.5, 0.5], { top: 0, height: 1 })).toBeNull()
  })
})

describe('enrichInfo', () => {
  const base = { kind: 'image' as const, enrich_error: null, stage: null, progress: null }
  it('running shows "Describiendo imágenes 3/12" with the bar fraction', () => {
    const i = enrichInfo({ ...base, enrich_status: 'running', stage: 'describing', progress: { done: 3, total: 12 } })!
    expect(i).toMatchObject({ tone: 'busy', label: 'Describiendo imágenes 3/12', fraction: 0.25, canRetry: false })
  })
  it('pending is queued, running without progress is indeterminate', () => {
    expect(enrichInfo({ ...base, enrich_status: 'pending' })!.label).toBe('Descripciones en cola')
    expect(enrichInfo({ ...base, enrich_status: 'running' })).toMatchObject({ label: 'Describiendo imágenes', fraction: null })
  })
  it('partial / failed offer a retry and carry the error', () => {
    expect(enrichInfo({ ...base, enrich_status: 'partial', enrich_error: ' 3 sin describir ' })).toMatchObject({ tone: 'warn', canRetry: true, detail: '3 sin describir' })
    expect(enrichInfo({ ...base, enrich_status: 'failed' })).toMatchObject({ tone: 'bad', label: 'Descripciones fallidas', canRetry: true })
  })
  it('skipped on an image = no vision profile (link); on a pdf/text it is normal and silent', () => {
    expect(enrichInfo({ ...base, enrich_status: 'skipped' })).toMatchObject({ tone: 'muted', label: 'Sin perfil de visión', needsProfile: true })
    expect(enrichInfo({ ...base, kind: 'pdf', enrich_status: 'skipped' })).toBeNull()
    expect(enrichInfo({ ...base, enrich_status: undefined })).toBeNull()
  })
  it('audio: "Transcribiendo audio 3/12" while running (stage describing or transcribing), its own failure labels', () => {
    const audio = { ...base, kind: 'audio' as const }
    expect(enrichInfo({ ...audio, enrich_status: 'running', stage: 'transcribing', progress: { done: 3, total: 12 } })).toMatchObject({ tone: 'busy', label: 'Transcribiendo audio 3/12', fraction: 0.25, area: 'audio' })
    expect(enrichInfo({ ...audio, enrich_status: 'pending' })!.label).toBe('Transcripción en cola')
    expect(enrichInfo({ ...audio, enrich_status: 'partial' })).toMatchObject({ label: 'Transcripción parcial', canRetry: true })
    expect(enrichInfo({ ...audio, enrich_status: 'skipped' })).toMatchObject({ label: 'Sin perfil de voz a texto', needsProfile: true, area: 'audio' })
  })
  it('labels the parts of a video apart when the backend reports them', () => {
    const video = { kind: 'video' as const }
    expect(enrichInfo({ ...video, enrich_status: 'partial', enrich_error: 'Audio listo · fotogramas fallidos. 1 de 1 descripciones fallaron: sin saldo' })).toMatchObject({
      tone: 'warn', label: 'Audio listo · fotogramas fallidos', detail: '1 de 1 descripciones fallaron: sin saldo', canRetry: true,
    })
    expect(enrichInfo({ ...video, enrich_status: 'failed', enrich_error: 'Fotogramas fallidos' })).toMatchObject({ tone: 'bad', label: 'Fotogramas fallidos', detail: null })
    expect(enrichInfo({ ...video, enrich_status: 'failed', enrich_error: 'boom' })).toMatchObject({ label: 'Fotogramas y audio fallidos' })
  })
})
