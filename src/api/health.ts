import { api } from './client'
import type { Health } from '@/domain/types'

export const getHealth = () => api<Health>('/health')
