import { useCallback, useMemo, useRef, type ReactNode } from 'react'
import { AskBridgeContext } from './askBridgeContext'

/** Holds the registered `ask` of the conversation; see `askBridgeContext`. */
export function AskBridgeProvider({ children }: { children: ReactNode }) {
  const target = useRef<((question: string) => void) | null>(null)
  const register = useCallback((fn: ((question: string) => void) | null) => { target.current = fn }, [])
  const ask = useCallback((question: string) => { target.current?.(question); return target.current != null }, [])
  const value = useMemo(() => ({ ask, register }), [ask, register])
  return <AskBridgeContext.Provider value={value}>{children}</AskBridgeContext.Provider>
}
