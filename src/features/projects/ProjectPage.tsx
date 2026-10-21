import { useRef, useState, type DragEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Link, useNavigate, useParams } from 'react-router'
import type { ApiClientError } from '@/api/client'
import { keys } from '@/api/queryKeys'
import { ACCEPT_ATTR, prepareUpload } from '@/domain/ingest'
import { KIND_ICON, MAX_SOURCES, kindOf } from '@/domain/sources'
import type { ProjectDetail } from '@/domain/library'
import { compatById } from '@/domain/compat'
import { PasteTextModal } from '@/features/sources/PasteTextModal'
import { CompatBanner } from '@/features/sources/compat'
import { useProjectCompat } from '@/features/sources/useCompat'
import { useChats, useDeleteChat } from '@/features/chats/hooks'
import { Button } from '@/ui/Button'
import { ErrorNote } from '@/ui/ErrorNote'
import { spring, fade } from '@/ui/motion'
import { useAddProjectSources, useAdoptChat, useCreateProjectChat, useDeleteProject, useProject, useRemoveProjectSource, useUpdateProject } from './hooks'
import { SourceCard } from './SourceCard'
import styles from './ProjectPage.module.css'

const when = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

function Header({ project }: { project: ProjectDetail }) {
  const navigate = useNavigate()
  const update = useUpdateProject(project.id)
  const del = useDeleteProject()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(project.name)
  const [confirming, setConfirming] = useState(false)
  const save = () => {
    const next = name.trim()
    setEditing(false)
    if (next && next !== project.name) update.mutate({ name: next })
    else setName(project.name)
  }
  return (
    <header className={styles.head}>
      <p className={styles.kicker}>
        <span className={styles.dot} style={{ background: project.color ?? 'var(--amber)' }} aria-hidden="true" />
        Proyecto · {project.source_count} {project.source_count === 1 ? 'fuente' : 'fuentes'} · {project.chat_count} {project.chat_count === 1 ? 'chat' : 'chats'}
      </p>
      {editing ? (
        <form className={styles.rename} onSubmit={(e) => { e.preventDefault(); save() }}>
          <input className={styles.nameInput} value={name} maxLength={80} autoFocus aria-label="Nombre del proyecto" onChange={(e) => setName(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === 'Escape') { setEditing(false); setName(project.name) } }} />
        </form>
      ) : (
        <h1 className={styles.title}>
          {project.name}
          <button type="button" className={styles.edit} aria-label="Renombrar proyecto" onClick={() => setEditing(true)}>✎</button>
        </h1>
      )}
      {project.description && <p className={styles.desc}>{project.description}</p>}
      <div className={styles.actions}>
        {confirming ? (
          <div className={styles.confirm} role="group" aria-label="Borrar proyecto">
            <span>¿Borrar «{project.name}», sus {project.chat_count} chats y {project.source_count} fuentes? No se puede deshacer.</span>
            <Button variant="danger" disabled={del.isPending} onClick={() => del.mutate(project.id, { onSuccess: () => navigate('/') })}>Sí, borrar todo</Button>
            <Button onClick={() => setConfirming(false)} autoFocus>No</Button>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setConfirming(true)}>Borrar proyecto</Button>
        )}
      </div>
      {del.error && <ErrorNote error={del.error as ApiClientError} />}
      {update.error && <ErrorNote error={update.error as ApiClientError} />}
    </header>
  )
}

function Sources({ project }: { project: ProjectDetail }) {
  const calm = useReducedMotion()
  const add = useAddProjectSources(project.id)
  const compat = useProjectCompat(project.id, project.sources)
  const flags = compatById(compat)
  const remove = useRemoveProjectSource(project.id)
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [rejected, setRejected] = useState(false)
  const [pasting, setPasting] = useState(false)
  const full = project.sources.length >= MAX_SOURCES
  const take = (list: FileList | File[] | null) => {
    setRejected(false)
    const all = [...(list ?? [])]
    const ok = all.map(prepareUpload).flatMap((p) => (p.ok ? [p.file] : []))
    if (all.length > ok.length) setRejected(true)
    if (ok.length) add.mutate(ok)
  }
  const hasFiles = (e: DragEvent) => [...e.dataTransfer.types].includes('Files')
  return (
    <section
      className={styles.section} data-over={over} aria-labelledby="src-h"
      onDragOver={(e) => { if (hasFiles(e)) { e.preventDefault(); setOver(true) } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false) }}
      onDrop={(e) => { if (!hasFiles(e)) return; e.preventDefault(); setOver(false); take(e.dataTransfer.files) }}
    >
      <div className={styles.sectionHead}>
        <h2 id="src-h" className={styles.h2}>Fuentes</h2>
        <Button variant="solid" disabled={add.isPending || full} onClick={() => input.current?.click()} title={full ? `Máximo ${MAX_SOURCES} fuentes` : 'PDF, texto, imagen, audio o video'}>
          {add.isPending ? 'Subiendo…' : '+ Agregar fuentes'}
        </Button>
        <Button disabled={add.isPending || full} onClick={() => setPasting(true)} title="Pegar texto como fuente">Pegar texto</Button>
        <input ref={input} type="file" multiple hidden accept={ACCEPT_ATTR} onChange={(e) => { take(e.target.files); e.target.value = '' }} />
      </div>
      <CompatBanner compat={compat} />
      {project.sources.length === 0 ? (
        <button type="button" className={styles.drop} onClick={() => input.current?.click()}>
          <span className={styles.dropGlyph} aria-hidden="true">⇪</span>
          <span className={styles.dropTitle}>Arrastrá archivos acá</span>
          <span className={styles.dropHint}>Todos los chats del proyecto leerán estas fuentes.</span>
          <span className={styles.dropHint}>o usá «Pegar texto»</span>
        </button>
      ) : (
        <ul className={styles.grid} aria-label="Fuentes del proyecto">
          <AnimatePresence initial={false}>
            {project.sources.map((s) => <SourceCard key={s.id} source={s} removing={remove.isPending} onRemove={() => remove.mutate(s.id)} compat={flags.get(s.id)} />)}
          </AnimatePresence>
        </ul>
      )}
      <AnimatePresence>
        {over && (
          <motion.p className={styles.overlay} role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={calm ? { duration: 0.1 } : fade}>
            Soltá para agregar al proyecto
          </motion.p>
        )}
      </AnimatePresence>
      <PasteTextModal open={pasting} busy={add.isPending} onClose={() => setPasting(false)} onSubmit={(file) => add.mutate([file], { onSettled: () => setPasting(false) })} />
      {rejected && <p className={styles.hint} role="alert">Algún archivo no es de un tipo admitido y se omitió.</p>}
      {add.error && <ErrorNote error={add.error as ApiClientError} />}
      {remove.error && <ErrorNote error={remove.error as ApiClientError} />}
    </section>
  )
}

function Chats({ project }: { project: ProjectDetail }) {
  const navigate = useNavigate()
  const calm = useReducedMotion()
  const create = useCreateProjectChat(project.id)
  const del = useDeleteChat()
  const qc = useQueryClient()
  const loose = (useChats().data ?? []).filter((c) => !c.project_id && (c.source_count ?? 0) > 0)
  const adopt = useAdoptChat(project.id)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const ready = project.ready_count > 0
  return (
    <section className={styles.section} aria-labelledby="chat-h">
      <div className={styles.sectionHead}>
        <h2 id="chat-h" className={styles.h2}>Chats</h2>
        <Button variant="solid" disabled={create.isPending || !ready} title={ready ? undefined : 'Esperá a que alguna fuente termine de indexarse'} onClick={() => create.mutate(undefined, { onSuccess: (c) => navigate(`/chats/${c.id}`) })}>
          + Nuevo chat en proyecto
        </Button>
      </div>
      {create.error && <ErrorNote error={create.error as ApiClientError} />}
      {project.chats.length === 0 ? (
        <p className={styles.empty}>Todavía no hay chats. Cada uno lee todas las fuentes y puede silenciar las que no le sirvan.</p>
      ) : (
        <ul className={styles.chatList} aria-label="Chats del proyecto">
          <AnimatePresence initial={false}>
            {project.chats.map((c) => (
              <motion.li key={c.id} layout="position" className={styles.chat} initial={{ opacity: 0, x: calm ? 0 : -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={calm ? { duration: 0.12 } : spring}>
                {confirmId === c.id ? (
                  <span className={styles.confirmRow} role="group" aria-label={`Borrar ${c.title}`}>
                    <span>¿Borrar este chat y sus mensajes? Las fuentes se conservan.</span>
                    <Button variant="danger" disabled={del.isPending} onClick={() => del.mutate(c.id, { onSuccess: () => { setConfirmId(null); void qc.invalidateQueries({ queryKey: keys.project(project.id) }); void qc.invalidateQueries({ queryKey: keys.projects }) } })}>Borrar</Button>
                    <Button onClick={() => setConfirmId(null)} autoFocus>No</Button>
                  </span>
                ) : (
                  <>
                    <Link to={`/chats/${c.id}`} className={styles.chatLink}>
                      <span className={styles.chatTitle}>{c.title || 'Chat'}</span>
                      <time className={styles.chatWhen} dateTime={c.created_at}>{when.format(new Date(c.created_at))}</time>
                    </Link>
                    <button type="button" className={styles.x} aria-label="Borrar chat" onClick={() => setConfirmId(c.id)}>×</button>
                  </>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      {loose.length > 0 && (
        <label className={styles.adopt}>
          <span>Traer un chat existente (sus documentos pasan al proyecto)</span>
          <select value="" disabled={adopt.isPending} onChange={(e) => { if (e.target.value) adopt.mutate(e.target.value) }}>
            <option value="">Elegir chat…</option>
            {loose.map((c) => <option key={c.id} value={c.id}>{c.title || 'Chat'} · {c.source_count}</option>)}
          </select>
        </label>
      )}
      {adopt.error && <ErrorNote error={adopt.error as ApiClientError} />}
      {del.error && <ErrorNote error={del.error as ApiClientError} />}
    </section>
  )
}

function Overview({ project }: { project: ProjectDetail }) {
  const withSummary = (project.overview?.sources ?? []).filter((s) => s.summary)
  if (withSummary.length === 0) return null
  return (
    <section className={styles.section} aria-labelledby="ov-h">
      <h2 id="ov-h" className={styles.h2}>Visión general</h2>
      <ul className={styles.overview}>
        {withSummary.map((s) => (
          <li key={s.document_id}>
            <span className={styles.ovHead}><span className={styles.alias}>{s.alias}</span><span aria-hidden="true">{KIND_ICON[kindOf(s)]}</span><span className={styles.ovName}>{s.filename}</span></span>
            <p className={styles.ovText}>{s.summary}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ProjectPage() {
  const { id = '' } = useParams()
  const project = useProject(id)
  const navigate = useNavigate()
  if (project.error) {
    return (
      <div className={styles.page}>
        <ErrorNote error={project.error as ApiClientError} handlers={{ retry: () => void project.refetch(), backToList: () => navigate('/') }} />
      </div>
    )
  }
  if (!project.data) return <p className={styles.loading} role="status">Abriendo proyecto…</p>
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <Header key={project.data.id} project={project.data} />
        <Sources project={project.data} />
        <Chats project={project.data} />
        <Overview project={project.data} />
      </div>
    </div>
  )
}
