import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { buildPastedFile, byteLength, isOverLimit, wordCount } from '@/domain/pasteText'
import { Button } from '@/ui/Button'
import { fade, spring } from '@/ui/motion'
import { useModal } from '@/ui/useModal'
import styles from './PasteTextModal.module.css'

interface Props {
  open: boolean
  onClose: () => void
  /** Receives the built `.md` / `.txt` file; the host uploads it through its add-source flow. */
  onSubmit: (file: File) => void
  busy?: boolean
  initialText?: string
}

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

function Panel({ onClose, onSubmit, busy, initialText = '' }: Omit<Props, 'open'>) {
  const ref = useRef<HTMLDivElement>(null)
  const calm = useReducedMotion()
  const heading = useId()
  const [title, setTitle] = useState('')
  const [text, setText] = useState(initialText)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  useModal(true, ref, onClose)

  const bytes = byteLength(text)
  const over = isOverLimit(text)

  const paste = async () => {
    setNote(null)
    try {
      const clip = await navigator.clipboard.readText()
      if (!clip) { setNote('El portapapeles está vacío.'); return }
      setText((t) => (t ? `${t}\n${clip}` : clip)); setError(null)
    } catch {
      setNote('No hay permiso para leer el portapapeles: pegá con Ctrl/Cmd+V dentro del cuadro.')
    }
  }
  const submit = () => {
    const built = buildPastedFile(text, title)
    if (!built.ok) { setError('Pegá o escribí algo de texto antes de agregarlo.'); return }
    onSubmit(built.file)
  }

  return (
    <>
      <motion.div className={styles.scrim} aria-hidden="true" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={calm ? { duration: 0.1 } : fade} />
      <div className={styles.center}>
        <motion.div
          ref={ref} role="dialog" aria-modal="true" aria-labelledby={heading} tabIndex={-1} className={styles.panel}
          initial={calm ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={calm ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }} transition={calm ? { duration: 0.1 } : spring}
        >
          <p className={styles.kicker}>Nueva fuente</p>
          <h2 id={heading} className={styles.title}>Pegar texto</h2>
          <label className={styles.label} htmlFor={`${heading}-t`}>Título <span>(opcional)</span></label>
          <input id={`${heading}-t`} className={styles.input} value={title} maxLength={120} placeholder="Si lo dejás vacío, uso la primera línea" autoComplete="off" onChange={(e) => setTitle(e.target.value)} />
          <label className={styles.label} htmlFor={`${heading}-x`}>Texto</label>
          <textarea
            id={`${heading}-x`} className={styles.area} data-autofocus value={text} spellCheck={false}
            aria-invalid={error ? true : undefined} placeholder="Pegá acá el texto (admite Markdown)…"
            onChange={(e) => { setText(e.target.value); setError(null) }}
          />
          <div className={styles.meta}>
            <span>{text.length.toLocaleString('es')} caracteres · {wordCount(text).toLocaleString('es')} palabras · {kb(bytes)}</span>
            <button type="button" className={styles.link} onClick={() => void paste()}>Pegar del portapapeles</button>
          </div>
          {over && <p className={styles.warn} role="status">El texto pesa más de 2 MB: puede tardar en indexarse. Considerá dividirlo en varias fuentes.</p>}
          {note && <p className={styles.warn} role="status">{note}</p>}
          {error && <p className={styles.err} role="alert">{error}</p>}
          <div className={styles.actions}>
            <Button onClick={onClose}>Cancelar</Button>
            <Button variant="solid" disabled={busy} onClick={submit}>{busy ? 'Agregando…' : 'Agregar como fuente'}</Button>
          </div>
        </motion.div>
      </div>
    </>
  )
}

/** Modal to paste text and add it as a source (portaled; Esc closes, focus trapped via useModal). */
export function PasteTextModal({ open, ...rest }: Props) {
  return createPortal(<AnimatePresence>{open && <Panel key="paste" {...rest} />}</AnimatePresence>, document.body)
}
