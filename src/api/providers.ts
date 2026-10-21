import { api } from './client'
import type { ActiveSettings, ProbeResult, Provider, ProviderIn, ProviderPatch } from '@/domain/types'

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

export const listProviders = () => api<Provider[]>('/providers')
export const createProvider = (body: ProviderIn) => api<Provider>('/providers', json('POST', body))
export const patchProvider = (id: string, body: ProviderPatch) => api<Provider>(`/providers/${id}`, json('PATCH', body))
export const deleteProvider = (id: string) => api<void>(`/providers/${id}`, { method: 'DELETE' })
export const testProvider = (id: string) => api<ProbeResult>(`/providers/${id}/test`, { method: 'POST' })
export const getActive = () => api<ActiveSettings>('/settings/active')
/** Send ONLY the field of the kind being changed so the other one isn't overwritten. */
export const setActive = (body: Partial<ActiveSettings>) => api<ActiveSettings>('/settings/active', json('PUT', body))
