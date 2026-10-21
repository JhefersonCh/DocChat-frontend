import { API_BASE, api } from './client'
import { cleanWaveform, type Waveform } from '@/domain/audio'
import type { EnrichStatus } from '@/domain/types'
import type { StoryboardEntry } from '@/domain/video'

/** 256 px webp of a segment (404 when `has_thumb` is false). Immutable: safe to cache forever. */
export const segmentThumbUrl = (chunkId: string) => `${API_BASE}/segments/${chunkId}/thumb`

/** Crop / frame of a segment, <= 1024 px webp (lightbox). */
export const segmentAssetUrl = (chunkId: string) => `${API_BASE}/segments/${chunkId}/asset`

/** 202; 404 document_not_found; 409 document_busy / no_vision_profile. Retries or resumes the descriptions stage. */
export const enrichDocument = (id: string) =>
  api<{ document_id: string; enrich_status: EnrichStatus }>(`/documents/${id}/enrich`, { method: 'POST' })

/** Original audio (HTTP Range: the browser seeks natively). Same endpoint as any original file. */
export const audioSrc = (docId: string) => `${API_BASE}/documents/${docId}/file`

/**
 * Peaks of an audio document, or null when there are none to draw (404 while the backend is still computing
 * them, or an unusable body): the viewer then falls back to a flat line instead of failing.
 */
export async function getWaveform(docId: string): Promise<Waveform | null> {
  try {
    return cleanWaveform(await api<unknown>(`/documents/${docId}/waveform`))
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    return null
  }
}

/**
 * Playable video, with HTTP Range. The backend serves the browser-playable transcode when the original is a
 * codec/container browsers refuse (`variant=playable` is also its default): the player never asks for the original.
 */
export const videoSrc = (docId: string) => `${API_BASE}/documents/${docId}/file?variant=playable`

/** Frames of a video with their second; 404 `storyboard_not_found` for any other kind -> null (the chunk list still draws the strip). */
export async function getStoryboard(docId: string): Promise<StoryboardEntry[] | null> {
  try {
    const rows = await api<unknown>(`/documents/${docId}/storyboard`)
    return Array.isArray(rows) ? (rows as StoryboardEntry[]).filter((r) => r && typeof r.segment_id === 'string' && Number.isFinite(r.t)) : null
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    return null
  }
}
