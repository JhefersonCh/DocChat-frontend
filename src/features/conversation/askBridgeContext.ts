import { createContext, useContext } from 'react'

/**
 * Lets the viewer ask the chat a question (select -> explain) without owning the ask stream:
 * `Conversation` registers its `ask`, anything under the provider calls `ask(question)`.
 */
export interface AskBridge {
  /** False when nobody can take it now (no chat mounted, or an answer is still streaming). */
  ask: (question: string) => boolean
  register: (fn: ((question: string) => void) | null) => void
}

export const AskBridgeContext = createContext<AskBridge>({ ask: () => false, register: () => {} })

export const useAskBridge = () => useContext(AskBridgeContext)
