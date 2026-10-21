import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/providers'
import { getHealth } from '@/api/health'
import { keys } from '@/api/queryKeys'
import type { ProviderIn, ProviderPatch } from '@/domain/types'

export const useHealth = () =>
  useQuery({ queryKey: keys.health, queryFn: getHealth, refetchInterval: 30_000, retry: false })

export const useProviders = () => useQuery({ queryKey: keys.providers, queryFn: api.listProviders })
export const useActive = () => useQuery({ queryKey: keys.active, queryFn: api.getActive })

function useInvalidating<V, R>(fn: (v: V) => Promise<R>, ...which: (readonly string[])[]) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all(which.map((queryKey) => qc.invalidateQueries({ queryKey }))),
  })
}

export const useCreateProvider = () =>
  useInvalidating((b: ProviderIn) => api.createProvider(b), keys.providers)

export const usePatchProvider = () =>
  useInvalidating((v: { id: string; body: ProviderPatch }) => api.patchProvider(v.id, v.body), keys.providers, keys.health)

export const useDeleteProvider = () =>
  useInvalidating((id: string) => api.deleteProvider(id), keys.providers, keys.active)

/** The probe persists `supports_tools`/`dimensions` server-side, so refresh the list. */
export const useProbe = () =>
  useInvalidating((id: string) => api.testProvider(id), keys.providers, keys.health)

export const useSetActive = () =>
  useInvalidating((b: Parameters<typeof api.setActive>[0]) => api.setActive(b), keys.active, keys.health)
