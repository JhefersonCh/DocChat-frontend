import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react'
import { useNavigate } from 'react-router'
import { searchAll } from '@/api/search'
import { keys } from '@/api/queryKeys'
import {
  flattenResults, hitKey, hitLink, loadRecent, pushRecent, relativeDate, saveRecent, splitHighlights, type Hit, type Span,
} from '@/domain/globalSearch'
import { useIsPhone } from '@/ui/useMediaQuery'
import { useModal } from '@/ui/useModal'
import { MagnifierIcon } from './SearchButton'
import styles from './SearchPalette.module.css'

const ease = [0.2, 0.8, 0.2, 1] as const

function Marked({ text, spans }: { text: string; spans: Span[] }) {
  return <>{splitHighlights(text, spans).map((p, i) => (p.mark ? <mark key={i} className={styles.mark}>{p.text}</mark> : p.text))}</>
}

function ProjectBadge({ name }: { name: string | null }) {
  return <span className={styles.badge}><span className={styles.dot} aria-hidden="true" />{name ?? 'Proyecto'}</span>
}

function Row({ h, id, active, onPick, onHover }: { h: Hit; id: string; active: boolean; onPick: () => void; onHover: () => void }) {
  const ref = useRef<HTMLLIElement>(null)
  useEffect(() => { if (active) ref.current?.scrollIntoView({ block: 'nearest' }) }, [active])
  let body
  switch (h.kind) {
    case 'message': {
      const m = h.hit
      body = (
        <>
          <p className={styles.meta}>
            <span className={styles.title}>{m.chat_title || 'Nuevo chat'}</span>
            {m.project_id && <ProjectBadge name={m.project_name} />}
            <span className={styles.role} data-role={m.role}>{m.role === 'user' ? 'Vos' : 'Asistente'}</span>
            <time className={styles.when} dateTime={m.created_at}>{relativeDate(m.created_at)}</time>
          </p>
          <p className={styles.snippet}><Marked text={m.snippet} spans={m.highlights} /></p>
        </>
      )
      break
    }
    case 'chat':
      body = (
        <p className={styles.meta}>
          <span className={styles.title}><Marked text={h.hit.title} spans={h.hit.highlights} /></span>
          {h.hit.project_id && <ProjectBadge name={h.hit.project_name} />}
          <time className={styles.when} dateTime={h.hit.created_at}>{relativeDate(h.hit.created_at)}</time>
        </p>
      )
      break
    case 'project':
      body = <p className={styles.meta}><span className={styles.title}><Marked text={h.hit.name} spans={h.hit.highlights} /></span><ProjectBadge name="Proyecto" /></p>
      break
    case 'source':
      body = <p className={styles.meta}><span className={styles.title}><Marked text={h.hit.filename} spans={h.hit.highlights} /></span></p>
      break
  }
  return (
    <li ref={ref} id={id} role="option" aria-selected={active} className={styles.row} data-active={active} onMouseMove={onHover} onClick={onPick}>
      {body}
    </li>
  )
}

function Panel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const phone = useIsPhone()
  const calm = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const present = useIsPresent()
  useModal(present, ref, onClose)

  const [input, setInput] = useState('')
  const [debounced, setDebounced] = useState('')
  const [recent, setRecent] = useState(loadRecent)
  const [active, setActive] = useState(0)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(input.trim()), 200)
    return () => window.clearTimeout(t)
  }, [input])

  const search = useQuery({
    queryKey: keys.globalSearch(debounced),
    queryFn: ({ signal }) => searchAll(debounced, 20, signal),
    enabled: debounced.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  })
  const querying = input.trim().length > 0
  const groups = useMemo(() => (querying ? flattenResults(search.data) : []), [querying, search.data])
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])
  const count = querying ? flat.length : recent.length
  const idx = count === 0 ? -1 : Math.min(active, count - 1)
  const busy = querying && (search.isFetching || input.trim() !== debounced)

  const remember = () => { const next = pushRecent(recent, input); setRecent(next); saveRecent(next) }
  const open = (h: Hit) => { remember(); navigate(hitLink(h, input)); onClose() }
  const pickRecent = (q: string) => { setInput(q); setDebounced(q); setActive(0) }
  const clearRecent = () => { setRecent([]); saveRecent([]) }
  const optionId = (i: number) => `search-opt-${i}`

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (count > 0) setActive(((idx < 0 ? 0 : idx) + (e.key === 'ArrowDown' ? 1 : -1) + count) % count)
    } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (idx < 0) return
      if (querying) open(flat[idx]!)
      else pickRecent(recent[idx]!)
    }
  }

  const enter = phone
    ? { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 12 } }
    : calm
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
      : { initial: { opacity: 0, scaleX: 0.86, scaleY: 0.94, y: -10 }, animate: { opacity: 1, scaleX: 1, scaleY: 1, y: 0 }, exit: { opacity: 0, scaleX: 0.96, y: -6 } }

  return (
    <>
      <motion.div
        className={styles.backdrop} aria-hidden="true" onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: calm ? 0.1 : 0.2, ease }}
      />
      <div className={styles.stage} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
        <motion.div
          ref={ref} role="dialog" aria-modal="true" aria-label="Buscar en todos los chats" tabIndex={-1} className={styles.panel}
          style={{ transformOrigin: 'top center' }} {...enter}
          transition={calm ? { duration: 0.1 } : { type: 'spring', stiffness: 420, damping: 34 }}
        >
          <div className={styles.inputRow}>
            <span className={styles.icon}><MagnifierIcon size={18} /></span>
            <input
              data-autofocus className={styles.input} value={input} autoComplete="off" autoCorrect="off" spellCheck={false}
              placeholder="Buscar mensajes, chats, proyectos y fuentes…" enterKeyHint="search"
              role="combobox" aria-expanded={count > 0} aria-controls="search-list" aria-autocomplete="list"
              aria-activedescendant={idx >= 0 ? optionId(idx) : undefined} aria-label="Buscar"
              onChange={(e) => { setInput(e.target.value); setActive(0) }} onKeyDown={onKey}
            />
            <button type="button" className={styles.esc} onClick={onClose} aria-label="Cerrar búsqueda"><kbd>Esc</kbd></button>
            <span className={styles.bar} data-busy={busy} aria-hidden="true" />
          </div>
          <div className={styles.body}>
            <ul id="search-list" role="listbox" aria-label="Resultados" className={styles.list}>
              {!querying && recent.length > 0 && (
                <>
                  <li role="presentation" className={styles.group}>
                    <span>Búsquedas recientes</span>
                    <button type="button" className={styles.clear} onClick={clearRecent}>Borrar</button>
                  </li>
                  {recent.map((q, i) => (
                    <li
                      key={q} id={optionId(i)} role="option" aria-selected={idx === i} className={`${styles.row} ${styles.recent}`} data-active={idx === i}
                      onMouseMove={() => setActive(i)} onClick={() => pickRecent(q)}
                    >
                      <span className={styles.clock} aria-hidden="true">↺</span>{q}
                    </li>
                  ))}
                </>
              )}
              {groups.map((g, gi) => (
                <li key={g.label} role="presentation">
                  <p className={styles.group}><span>{g.label}</span><span className={styles.count}>{g.items.length}</span></p>
                  <ul role="presentation" className={styles.inner}>
                    {g.items.map((h, hi) => {
                      const i = groups.slice(0, gi).reduce((sum, x) => sum + x.items.length, 0) + hi
                      return <Row key={hitKey(h)} h={h} id={optionId(i)} active={idx === i} onHover={() => setActive(i)} onPick={() => open(h)} />
                    })}
                  </ul>
                </li>
              ))}
            </ul>
            {querying && !busy && flat.length === 0 && search.data && (
              <p className={styles.none}>Sin resultados para <strong>«{debounced}»</strong>. Probá con parte de la palabra.</p>
            )}
            {search.isError && <p className={styles.none}>No se pudo buscar. Revisá que el backend esté activo.</p>}
            {!querying && (
              <div className={styles.tips}>
                <p><code>presu</code> encuentra «presupuesto»</p>
                <p><code>zorro uvas</code> exige las dos palabras</p>
                <p><code>"frase exacta"</code> entre comillas</p>
              </div>
            )}
          </div>
          <p className={styles.foot} aria-hidden="true"><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>↵</kbd> abrir</span><span><kbd>Esc</kbd> cerrar</span></p>
        </motion.div>
      </div>
    </>
  )
}

/** Command-palette search over every chat. Portaled; the whole app behind is blurred and dimmed. */
export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  return createPortal(<AnimatePresence>{open && <Panel key="palette" onClose={onClose} />}</AnimatePresence>, document.body)
}
