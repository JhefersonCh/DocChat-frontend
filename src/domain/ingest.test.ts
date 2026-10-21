import { describe, expect, it } from 'vitest'
import type { Document } from './types'
import { ACCEPT_ATTR, ACCEPT_LEGEND, asAudioWebm, AUDIO_EXT, finishedIngest, isVideoFile, VIDEO_EXT, isAudioFile, isImageFile, isDocBusy, pollInterval, prepareUpload, progressInfo, SLOW_AFTER_MS } from './ingest'

describe('pollInterval', () => {
  it('polls while in flight, stops at ready/failed', () => {
    expect(pollInterval('pending', 0)).toBe(1500)
    expect(pollInterval('processing', 10_000)).toBe(1500)
    expect(pollInterval('ready', 0)).toBe(false)
    expect(pollInterval('failed', 0)).toBe(false)
  })
  it('backs off (does not stop) after the 5 min cap', () => {
    expect(pollInterval('processing', SLOW_AFTER_MS)).toBe(5000)
  })
})

describe('finishedIngest', () => {
  it('fires only on in-flight -> terminal', () => {
    expect(finishedIngest('pending', 'ready')).toBe(true)
    expect(finishedIngest('processing', 'failed')).toBe(true)
    expect(finishedIngest('ready', 'ready')).toBe(false)
    expect(finishedIngest(undefined, 'ready')).toBe(false)
    expect(finishedIngest('processing', 'processing')).toBe(false)
    expect(finishedIngest('processing', undefined)).toBe(false)
  })
})

describe('prepareUpload', () => {
  it('forces markdown MIME when the browser sends none', () => {
    const r = prepareUpload(new File(['# hi'], 'notes.MD', { type: '' }))
    expect(r.ok && r.file.type).toBe('text/markdown')
  })
  it('keeps a pdf untouched', () => {
    const f = new File(['x'], 'a.pdf', { type: 'application/pdf' })
    const r = prepareUpload(f)
    expect(r.ok && r.file).toBe(f)
  })
  it('accepts jpg / png / webp / gif and fixes a missing image MIME', () => {
    for (const name of ['a.jpg', 'A.JPEG', 'b.png', 'c.webp', 'd.gif']) {
      expect(prepareUpload(new File(['x'], name, { type: 'image/x' })).ok).toBe(true)
    }
    const r = prepareUpload(new File(['x'], 'cat.JPG', { type: '' }))
    expect(r.ok && r.file.type).toBe('image/jpeg')
    expect(isImageFile(new File(['x'], 'cat.png'))).toBe(true)
    expect(isImageFile(new File(['x'], 'a.pdf'))).toBe(false)
  })
  it('the input accepts what the validator accepts', () => {
    for (const e of ['.pdf', '.txt', '.md', '.jpg', '.png', '.webp', '.gif']) expect(ACCEPT_ATTR).toContain(e)
  })
  it('rejects other extensions', () => {
    expect(prepareUpload(new File(['x'], 'a.docx'))).toEqual({ ok: false, code: 'unsupported_file_type' })
  })
})

describe('isDocBusy', () => {
  const d = (status: Document['status'], summary_status: Document['summary_status']) => ({ status, summary_status })
  it('is busy while ingesting or while the summary of a ready document is pending', () => {
    expect(isDocBusy(d('processing', 'skipped'))).toBe(true)
    expect(isDocBusy(d('ready', 'pending'))).toBe(true)
    expect(isDocBusy(d('ready', 'ready'))).toBe(false)
    expect(isDocBusy(d('failed', 'pending'))).toBe(false)
    expect(isDocBusy(undefined)).toBe(false)
  })
  it('keeps polling while the image descriptions are pending / running, stops when they end', () => {
    const e = (enrich_status: Document['enrich_status']) => ({ status: 'ready' as const, summary_status: 'ready' as const, enrich_status })
    expect(isDocBusy(e('pending'))).toBe(true)
    expect(isDocBusy(e('running'))).toBe(true)
    for (const s of ['ready', 'partial', 'failed', 'skipped', undefined] as const) expect(isDocBusy(e(s))).toBe(false)
  })
})

describe('progressInfo', () => {
  it('labels embedded/total chunks and gives the bar fraction', () => {
    expect(progressInfo({ done: 120, total: 680 })).toEqual({ label: 'Indexando 120/680', fraction: 120 / 680 })
  })
  it('names the stage: "Describiendo imágenes 3/12"', () => {
    expect(progressInfo({ done: 3, total: 12 }, 'describing')?.label).toBe('Describiendo imágenes 3/12')
    expect(progressInfo({ done: 1, total: 4 }, 'transcribing')?.label).toBe('Transcribiendo audio 1/4')
  })
  it('is null without progress or without chunks', () => {
    expect(progressInfo(null)).toBeNull()
    expect(progressInfo(undefined)).toBeNull()
    expect(progressInfo({ done: 0, total: 0 })).toBeNull()
  })
  it('clamps the fraction to 1', () => {
    expect(progressInfo({ done: 9, total: 4 })?.fraction).toBe(1)
  })
})

describe('audio upload', () => {
  it('accepts mp3, wav, m4a, ogg/opus, webm and flac; the file input and legend list them', () => {
    for (const ext of ['mp3', 'wav', 'm4a', 'ogg', 'opus', 'webm', 'flac']) {
      expect(AUDIO_EXT).toContain(`.${ext}`)
      expect(ACCEPT_ATTR).toContain(`.${ext}`)
      expect(ACCEPT_LEGEND).toContain(`.${ext}`)
      expect(prepareUpload(new File(['x'], `voz.${ext.toUpperCase()}`, { type: 'audio/x-whatever' })).ok).toBe(true)
    }
    expect(ACCEPT_ATTR).toContain('audio/*')
    expect(isAudioFile(new File(['x'], 'a.M4A'))).toBe(true)
    expect(isAudioFile(new File(['x'], 'a.pdf'))).toBe(false)
  })
  it('fixes the MIME the browser reports wrong (.m4a empty); keeps a correct one; .webm is left to the video-track probe', () => {
    const webm = prepareUpload(new File(['x'], 'voz.webm', { type: 'video/webm' }))
    expect(webm.ok && webm.file.type).toBe('video/webm')
    expect(asAudioWebm(new File(['x'], 'voz.webm', { type: 'video/webm' })).type).toBe('audio/webm')
    const m4a = prepareUpload(new File(['x'], 'voz.m4a', { type: '' }))
    expect(m4a.ok && m4a.file.type).toBe('audio/mp4')
    const kept = prepareUpload(new File(['x'], 'voz.mp3', { type: 'audio/mpeg' }))
    expect(kept.ok && kept.file.type).toBe('audio/mpeg')
  })
  it('still rejects what is not supported; names the transcribing stage', () => {
    expect(prepareUpload(new File(['x'], 'clip.avi', { type: 'video/x-msvideo' }))).toEqual({ ok: false, code: 'unsupported_file_type' })
    expect(progressInfo({ done: 3, total: 12 }, 'transcribing')?.label).toBe('Transcribiendo audio 3/12')
  })
})

describe('video upload', () => {
  it('accepts mp4, webm, mov and mkv; the file input and legend list them', () => {
    for (const ext of ['mp4', 'mov', 'mkv', 'webm']) {
      expect(VIDEO_EXT).toContain(`.${ext}`)
      expect(ACCEPT_ATTR).toContain(`.${ext}`)
      expect(ACCEPT_LEGEND).toContain(`.${ext}`)
      expect(prepareUpload(new File(['x'], `clase.${ext.toUpperCase()}`, { type: 'video/whatever' })).ok).toBe(true)
    }
    expect(ACCEPT_ATTR).toContain('video/*')
  })
  it('retypes the MIME browsers leave empty or generic (.mov, .mkv); keeps a correct one', () => {
    const mkv = prepareUpload(new File(['x'], 'clase.mkv', { type: '' }))
    expect(mkv.ok && mkv.file.type).toBe('video/x-matroska')
    const mov = prepareUpload(new File(['x'], 'clase.mov', { type: 'application/octet-stream' }))
    expect(mov.ok && mov.file.type).toBe('video/quicktime')
    const mp4 = prepareUpload(new File(['x'], 'clase.mp4', { type: 'video/mp4' }))
    expect(mp4.ok && mp4.file.type).toBe('video/mp4')
  })
  it('tells video from audio by MIME / extension; .webm goes by its type', () => {
    expect(isVideoFile(new File(['x'], 'a.mp4', { type: 'video/mp4' }))).toBe(true)
    expect(isVideoFile(new File(['x'], 'a.webm', { type: 'video/webm' }))).toBe(true)
    expect(isAudioFile(new File(['x'], 'a.webm', { type: 'audio/webm' }))).toBe(true)
    expect(isAudioFile(new File(['x'], 'a.mp4', { type: 'video/mp4' }))).toBe(false)
  })
  it('names the frame description stage of a video', () => {
    expect(progressInfo({ done: 3, total: 40 }, 'describing', 'video')?.label).toBe('Describiendo fotogramas 3/40')
    expect(progressInfo({ done: 3, total: 12 }, 'describing', 'image')?.label).toBe('Describiendo imágenes 3/12')
  })
})
