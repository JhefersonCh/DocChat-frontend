import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { XrayActionsContext, XrayStateContext, type XrayActions, type XraySource, type XrayState } from './XrayContext'

/** Separate state/actions contexts: the conversation publishes on every change without re-rendering from it. */
export function XrayProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<XrayState>({ source: null, replay: 0 })
  const publishLive = useCallback((source: XraySource) => setState((s) => ({ ...s, source })), [])
  const show = useCallback((source: XraySource) => setState((s) => ({ source, replay: s.replay + 1 })), [])
  const actions = useMemo<XrayActions>(() => ({ publishLive, show }), [publishLive, show])
  return (
    <XrayActionsContext.Provider value={actions}>
      <XrayStateContext.Provider value={state}>{children}</XrayStateContext.Provider>
    </XrayActionsContext.Provider>
  )
}
