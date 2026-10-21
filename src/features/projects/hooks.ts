import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addProjectSource, adoptChat, createProject, createProjectChat, deleteProject, getProject, listProjects, removeProjectSource, setProjectPinned, updateProject,
} from '@/api/library'
import { keys } from '@/api/queryKeys'
import { isDocBusy } from '@/domain/ingest'
import { optimisticPin } from '@/app/sidebarSection'
import type { Project, ProjectDetail, ProjectIn } from '@/domain/library'

export const useProjects = () => useQuery({ queryKey: keys.projects, queryFn: listProjects })

/** The project page's data; polls while any source is still ingesting / summarizing. */
export const useProject = (id: string) =>
  useQuery({
    queryKey: keys.project(id), queryFn: () => getProject(id), retry: false,
    refetchInterval: (q) => (q.state.data?.sources.some(isDocBusy) ? 2000 : false),
  })

function useRefreshProject(id: string) {
  const qc = useQueryClient()
  return () => Promise.all([
    qc.invalidateQueries({ queryKey: keys.project(id) }),
    qc.invalidateQueries({ queryKey: keys.projects }),
    qc.invalidateQueries({ queryKey: keys.chats }),
    qc.invalidateQueries({ queryKey: ['library'] }),
  ])
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (b: ProjectIn) => createProject(b), onSuccess: () => qc.invalidateQueries({ queryKey: keys.projects }) })
}

export function useUpdateProject(id: string) {
  const refresh = useRefreshProject(id)
  return useMutation({ mutationFn: (b: Partial<ProjectIn>) => updateProject(id, b), onSuccess: refresh })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteProject,
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: keys.project(id) })
      return Promise.all([
        qc.invalidateQueries({ queryKey: keys.projects }), qc.invalidateQueries({ queryKey: keys.chats }), qc.invalidateQueries({ queryKey: ['library'] }),
      ])
    },
  })
}

/** Uploads one after the other (the backend orders them by arrival: S1, S2…). */
export function useAddProjectSources(id: string) {
  const refresh = useRefreshProject(id)
  return useMutation({
    mutationFn: async (files: File[]) => { for (const f of files) await addProjectSource(id, f) },
    onSuccess: refresh,
    onError: refresh, // some of the files may have gone through
  })
}

export function useRemoveProjectSource(id: string) {
  const refresh = useRefreshProject(id)
  return useMutation({ mutationFn: (documentId: string) => removeProjectSource(id, documentId), onSuccess: refresh })
}

export function useCreateProjectChat(id: string) {
  const refresh = useRefreshProject(id)
  return useMutation({ mutationFn: () => createProjectChat(id), onSuccess: refresh })
}

export function useAdoptChat(id: string) {
  const qc = useQueryClient()
  const refresh = useRefreshProject(id)
  return useMutation({
    mutationFn: (chatId: string) => adoptChat(id, chatId),
    onSuccess: (detail: ProjectDetail) => { qc.setQueryData(keys.project(id), detail); return refresh() },
  })
}

/** Pin / unpin a project in the sidebar: the list reorders at once and rolls back on error. */
export function usePinProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; pinned: boolean }) => setProjectPinned(v.id, v.pinned),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: keys.projects })
      const prev = qc.getQueryData<Project[]>(keys.projects)
      qc.setQueryData<Project[]>(keys.projects, (old) => old && optimisticPin(old, v.id, v.pinned))
      return { prev }
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(keys.projects, ctx.prev) },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.projects }),
  })
}
