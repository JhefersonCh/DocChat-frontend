import { createContext, useContext } from 'react'
import type { Source } from '@/domain/types'

/** The chat's sources, for anything that labels or opens one (citations, Estudio links, exports). */
export const SourcesContext = createContext<readonly Source[]>([])
export const useSources = () => useContext(SourcesContext)
