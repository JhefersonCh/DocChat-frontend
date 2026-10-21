import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { artifactKeys, createArtifact, deleteArtifact, expandArtifact, listArtifacts } from '@/api/artifacts'
import { isPending, type Artifact, type ArtifactKind } from '@/domain/artifacts'

const POLL_MS = 2000

/** Polls only while something is generating. */
export function useArtifacts(chatId: string) {
  return useQuery({
    queryKey: artifactKeys.list(chatId),
    queryFn: () => listArtifacts(chatId),
    refetchInterval: (q) => (isPending(q.state.data) ? POLL_MS : false),
  })
}

export function useCreateArtifact(chatId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ kind, options }: { kind: ArtifactKind; options?: Artifact['options'] }) => createArtifact(chatId, kind, options),
    onSuccess: (created) => qc.setQueryData<Artifact[]>(artifactKeys.list(chatId), (old) => [created, ...(old ?? [])]),
  })
}

export function useDeleteArtifact(chatId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteArtifact(chatId, id),
    onSuccess: (_, id) => qc.setQueryData<Artifact[]>(artifactKeys.list(chatId), (old) => old?.filter((a) => a.id !== id)),
  })
}

/** Expands a concept-map node; the grown artifact replaces the cached one. */
export function useExpandNode(chatId: string, artifactId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (nodeId: string) => expandArtifact(chatId, artifactId, nodeId),
    onSuccess: ({ artifact }) =>
      qc.setQueryData<Artifact[]>(artifactKeys.list(chatId), (old) => old?.map((a) => (a.id === artifact.id ? artifact : a))),
  })
}
