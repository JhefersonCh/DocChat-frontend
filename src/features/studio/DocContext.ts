import { createContext, useContext } from 'react'
import type { Document } from '@/domain/types'

/** The chat's document, so page links can open it in the viewer. */
export const DocContext = createContext<Document | null>(null)
export const useDoc = () => useContext(DocContext)
