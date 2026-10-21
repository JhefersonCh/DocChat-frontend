import { api } from './client'
import type { Artifact, ArtifactKind, ExpandResult, SlidesAssessment } from '@/domain/artifacts'

export const artifactKeys = { list: (chatId: string) => ['artifacts', chatId] as const }

export const listArtifacts = (chatId: string) => api<Artifact[]>(`/chats/${chatId}/artifacts`)

/** 202 pending artifact; 409 no_chat_profile / document_not_ready; 422 columns_required / invalid_artifact_kind. */
export const createArtifact = (chatId: string, kind: ArtifactKind, options?: Artifact['options']) =>
  api<Artifact>(`/chats/${chatId}/artifacts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind, options }),
  })

export const deleteArtifact = (chatId: string, id: string) =>
  api<void>(`/chats/${chatId}/artifacts/${id}`, { method: 'DELETE' })

/** Is the material worth a deck? 409 document_not_ready / no_chat_profile; 502 provider errors. */
export const assessSlides = (chatId: string) => api<SlidesAssessment>(`/chats/${chatId}/artifacts/slides/assess`, { method: 'POST' })

/** Grow a concept map around a node (1 LLM call). 404 artifact_not_found; 409 not_expandable; 422 node_not_found; 502 provider errors. */
export const expandArtifact = (chatId: string, id: string, nodeId: string) =>
  api<ExpandResult>(`/chats/${chatId}/artifacts/${id}/expand`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ node_id: nodeId }),
  })
