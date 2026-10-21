import { api } from './client'
import type {
  AskGroupResult, AutoCategorizeResult, Category, LibraryDoc, LibraryFilters, LibrarySearch, Project, ProjectDetail, ProjectIn,
} from '@/domain/library'
import type { Chat, SourceKind, UploadResult } from '@/domain/types'

const json = (method: string, body?: unknown): RequestInit => ({
  method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
})

// --- Projects ---
export const listProjects = () => api<Project[]>('/projects')
export const getProject = (id: string) => api<ProjectDetail>(`/projects/${id}`)
export const createProject = (body: ProjectIn) => api<Project>('/projects', json('POST', body))
export const updateProject = (id: string, body: Partial<ProjectIn>) => api<Project>(`/projects/${id}`, json('PATCH', body))
export const setProjectPinned = (id: string, pinned: boolean) => api<Project>(`/projects/${id}`, json('PATCH', { pinned }))
export const deleteProject = (id: string) => api<void>(`/projects/${id}`, { method: 'DELETE' })
/** 202; 409 too_many_sources / no_embedding_profile. */
export function addProjectSource(projectId: string, file: File) {
  const fd = new FormData()
  fd.append('file', file)
  return api<UploadResult>(`/projects/${projectId}/sources`, { method: 'POST', body: fd })
}
export const removeProjectSource = (projectId: string, documentId: string) =>
  api<void>(`/projects/${projectId}/sources/${documentId}`, { method: 'DELETE' })
export const createProjectChat = (projectId: string) => api<Chat>(`/projects/${projectId}/chats`, { method: 'POST' })
/** Moves a loose chat into the project (its documents become the project's sources). */
export const adoptChat = (projectId: string, chatId: string) =>
  api<ProjectDetail>(`/projects/${projectId}/adopt`, json('POST', { chat_id: chatId }))

// --- Categories ---
export const listCategories = () => api<Category[]>('/categories')
export const createCategory = (name: string, color?: string | null) => api<Category>('/categories', json('POST', { name, color }))
export const updateCategory = (id: string, body: { name?: string; color?: string | null }) => api<Category>(`/categories/${id}`, json('PATCH', body))
export const deleteCategory = (id: string) => api<void>(`/categories/${id}`, { method: 'DELETE' })
export const assignCategory = (id: string, documentIds: string[]) => api<Category>(`/categories/${id}/assign`, json('POST', { document_ids: documentIds }))
export const unassignCategory = (id: string, documentIds: string[]) => api<Category>(`/categories/${id}/unassign`, json('POST', { document_ids: documentIds }))
export const autoCategorize = () => api<AutoCategorizeResult>('/library/categorize', { method: 'POST' })

// --- Library ---
export function listLibrary(f: LibraryFilters) {
  const q = new URLSearchParams()
  if (f.kind) q.set('kind', f.kind)
  if (f.category_id) q.set('category_id', f.category_id)
  if (f.project_id) q.set('project_id', f.project_id)
  if (f.uncategorized) q.set('uncategorized', 'true')
  const s = q.toString()
  return api<LibraryDoc[]>(`/library/documents${s ? `?${s}` : ''}`)
}
export const searchLibrary = (query: string, f: LibraryFilters & { kind?: SourceKind | null }, limit = 20) =>
  api<LibrarySearch>('/library/search', json('POST', {
    query, limit, kind: f.kind ?? null, category_id: f.category_id ?? null, project_id: f.project_id ?? null,
  }))
/** Copies the documents into a new chat / project (or `projectId`) and opens a chat there. */
export const askDocuments = (documentIds: string[], mode: 'chat' | 'project', name?: string, projectId?: string | null) =>
  api<AskGroupResult>('/library/ask', json('POST', { document_ids: documentIds, mode, name: name ?? null, project_id: projectId ?? null }))
