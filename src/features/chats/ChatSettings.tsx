import { useEffect, useId, useRef, useState } from 'react'
import { MAX_PERSONA, personaSuggestions } from '@/domain/persona'
import type { Chat, ChatLength, ChatSettings as Settings, ChatStyle } from '@/domain/types'
import { useUpdateChatSettings } from './hooks'
import styles from './ChatSettings.module.css'

const STYLES: { id: ChatStyle; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'simple', label: 'Explicame simple' },
  { id: 'conciso', label: 'Conciso' },
  { id: 'custom', label: 'Personalizado' },
]
const LENGTHS: { id: ChatLength; label: string }[] = [
  { id: 'corta', label: 'Corta' },
  { id: 'normal', label: 'Normal' },
  { id: 'larga', label: 'Larga' },
]

interface GroupProps<T extends string> {
  label: string
  name: string
  value: T
  options: { id: T; label: string }[]
  onPick: (id: T) => void
}

function Group<T extends string>({ label, name, value, options, onPick }: GroupProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={styles.group}>
      <p className={styles.legend} aria-hidden="true">{label}</p>
      <div className={styles.options}>
        {options.map((o) => (
          <label key={o.id} className={styles.option}>
            <input type="radio" name={name} className={styles.radio} checked={value === o.id} onChange={() => onPick(o.id)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

/** Per-chat answer style + length, in a popover of the conversation header. Each change saves right away. */
export function ChatSettings({ chat, overview = null }: { chat: Chat; overview?: string | null }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const save = useUpdateChatSettings(chat.id)
  const style = chat.style ?? 'normal'
  const length = chat.length ?? 'normal'
  const [custom, setCustom] = useState(chat.custom_instructions ?? '')
  const [persona, setPersona] = useState(chat.persona ?? '')
  const savePersona = (value: string) => { const v = value.trim(); if (v !== (chat.persona ?? '')) change({ persona: v || null }) }
  const change = (changes: Partial<Settings>) => save.mutate(changes)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const summary = [STYLES.find((s) => s.id === style)?.label, length !== 'normal' && LENGTHS.find((l) => l.id === length)?.label.toLowerCase()].concat(chat.persona ? [`Voz: ${chat.persona}`] : []).filter(Boolean).join(' · ')
  return (
    <div ref={root} className={styles.root} onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false) } }}>
      <button type="button" className={styles.trigger} aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setOpen((o) => !o)}>
        Respuesta: {summary}
      </button>
      {open && (
        <div id={panelId} className={styles.panel} role="group" aria-label="Estilo y longitud de las respuestas">
          <Group label="Estilo" name="style" value={style} options={STYLES} onPick={(id) => change({ style: id })} />
          {style === 'custom' && (
            <label className={styles.custom}>
              <span className={styles.legend}>Instrucciones</span>
              <textarea
                className={styles.textarea} rows={3} maxLength={1000} value={custom} placeholder="Ej.: respondé con viñetas y ejemplos"
                aria-label="Instrucciones personalizadas"
                onChange={(e) => setCustom(e.target.value)}
                onBlur={() => { if (custom.trim() !== (chat.custom_instructions ?? '')) change({ custom_instructions: custom.trim() || null }) }}
              />
            </label>
          )}
          <Group label="Longitud" name="length" value={length} options={LENGTHS} onPick={(id) => change({ length: id })} />
          <div className={styles.custom}>
            <label className={styles.legend} htmlFor={`${panelId}-persona`}>Voz (hablar con…)</label>
            <input
              id={`${panelId}-persona`} className={styles.input} maxLength={MAX_PERSONA} value={persona}
              placeholder="el autor, el zorro, Úrsula Iguarán…"
              onChange={(e) => setPersona(e.target.value)}
              onBlur={() => savePersona(persona)}
              onKeyDown={(e) => { if (e.key === 'Enter') savePersona(persona) }}
            />
            <div className={styles.options}>
              {personaSuggestions(overview).map((s) => (
                <button key={s} type="button" className={styles.chipBtn} aria-pressed={persona === s} onClick={() => { setPersona(s); savePersona(s) }}>{s}</button>
              ))}
              {persona && <button type="button" className={styles.chipBtn} onClick={() => { setPersona(''); savePersona('') }}>Quitar voz</button>}
            </div>
          </div>
          {save.isError && <p className={styles.error} role="alert">No se pudo guardar.</p>}
        </div>
      )}
    </div>
  )
}
