import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAskBridge } from '@/features/conversation/askBridgeContext'
import { buildSelectionQuestion, DEFAULT_LEVEL, EXPLAIN_LEVELS, SELECTION_ACTIONS, type SelectionAction } from '@/domain/selection'
import type { TextSelection } from './useTextSelection'
import styles from './SelectionMenu.module.css'

interface Props {
  selection: TextSelection | null
  onDone: () => void
}

const GAP = 8
const MENU_W = 300

/** Floating Explicar / Simplificar / Definir / Traducir over the selected passage; sends a normal chat question. */
export function SelectionMenu({ selection, onDone }: Props) {
  const { ask } = useAskBridge()
  const [level, setLevel] = useState(DEFAULT_LEVEL)
  const [blockedFor, setBlockedFor] = useState<TextSelection | null>(null) // the selection the chat refused

  useEffect(() => {
    if (!selection) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDone() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selection, onDone])

  if (!selection) return null
  const { rect } = selection
  const above = rect.top > 56
  const left = Math.max(8, Math.min(rect.left + rect.width / 2 - MENU_W / 2, window.innerWidth - MENU_W - 8))
  const pick = (action: SelectionAction) => {
    if (ask(buildSelectionQuestion(action, selection.text, selection.page, level))) onDone()
    else setBlockedFor(selection)
  }
  return createPortal(
    <div
      role="toolbar"
      aria-label="Acciones sobre el texto seleccionado"
      className={styles.menu}
      style={{ left, top: above ? rect.top - GAP : rect.bottom + GAP, transform: above ? 'translateY(-100%)' : undefined }}
      onMouseDown={(e) => e.preventDefault() /* keep the selection alive while clicking */}
    >
      <div className={styles.row}>
        {blockedFor === selection
          ? <span className={styles.note} role="status">Esperá a que termine la respuesta.</span>
          : SELECTION_ACTIONS.map((a) => (
            <button key={a.id} type="button" className={styles.btn} onClick={() => pick(a.id)}>{a.label}</button>
          ))}
      </div>
      {blockedFor !== selection && (
        <label className={styles.level}>
          <span className={styles.levelLabel}>Nivel</span>
          <input
            type="range" min={0} max={EXPLAIN_LEVELS.length - 1} step={1} value={level} className={styles.slider}
            aria-label="Nivel de la explicación" aria-valuetext={EXPLAIN_LEVELS[level]!.label}
            onChange={(e) => setLevel(Number(e.target.value))}
          />
          <output className={styles.levelValue}>{EXPLAIN_LEVELS[level]!.label}</output>
        </label>
      )}
    </div>,
    document.body,
  )
}
