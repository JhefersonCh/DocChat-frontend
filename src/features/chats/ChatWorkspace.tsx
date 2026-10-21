import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useNavigate } from 'react-router'
import type { ApiClientError } from '@/api/client'
import { readable, resolveTab, sourcesOf, tabForCitation } from '@/domain/sources'
import type { ChatDetail, Document } from '@/domain/types'
import { Conversation } from '@/features/conversation/Conversation'
import { useTrace } from '@/features/conversation/TraceContext'
import { useOpenFromLink } from '@/features/library/useOpenFromLink'
import { ProjectCrumb } from '@/features/projects/ProjectCrumb'
import { IngestPanel } from '@/features/ingest/IngestPanel'
import { ReindexButton } from '@/features/ingest/ReindexButton'
import { UploadDropzone } from '@/features/ingest/UploadDropzone'
import { DropToAdd } from '@/features/sources/DropToAdd'
import { useChatCompat } from '@/features/sources/useCompat'
import { useSourcesPolling } from '@/features/sources/hooks'
import { SourcesBar } from '@/features/sources/SourcesBar'
import { SourcesContext } from '@/features/sources/SourcesContext'
import { ChatColumn } from '@/features/studio/ChatColumn'
import { DocumentViewer } from '@/features/viewer/DocumentViewer'
import { ErrorNote } from '@/ui/ErrorNote'
import { ease } from '@/ui/motion'
import { ChatSettings } from './ChatSettings'
import { useCreateChat } from './hooks'
import styles from './ChatView.module.css'

const when = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' })

/**
 * The open chat once its data is here: head, sources bar (chips = viewer tabs), viewer of the selected source
 * and the conversation. Selecting a citation switches to ITS source's tab (the trace seam carries `document_id`).
 */
export function ChatWorkspace({ chat }: { chat: ChatDetail }) {
  const navigate = useNavigate()
  const create = useCreateChat()
  const { activeCitation, seq } = useTrace()
  const polling = useSourcesPolling(chat.id, sourcesOf(chat))
  const sources = polling.sources
  const compat = useChatCompat(chat.id, sources)
  useOpenFromLink(sources) // library results arrive as ?doc=…&page=…
  const [selected, setSelected] = useState<string | null>(null)
  const [fromCitation, setFromCitation] = useState(false) // the tab changed because of a citation: phones open the sheet
  const tab = resolveTab(sources, selected)
  const [seen, setSeen] = useState(seq)
  if (seen !== seq) { // during render, like the viewer: the new tab must already be mounted when its effects look for the citation
    setSeen(seq)
    const next = tabForCitation(sources, tab, activeCitation)
    if (next) { setSelected(next); setFromCitation(true) }
  }
  const doc: Document | null = sources.find((s) => s.id === tab) ?? null
  const reading = readable(sources)
  const primary = reading[0] ?? doc // what the doc-level panels (Estudio, tutor, notes) gate on

  const newChat = () => create.mutate(undefined, { onSuccess: (c) => navigate(`/chats/${c.id}`) })
  const handlers = { newChat, goToSettings: () => navigate('/settings'), backToList: () => navigate('/') }
  const stage = !doc ? 'upload' : `${doc.id}:${doc.status}`
  const only = sources.length === 1

  return (
    <SourcesContext.Provider value={sources}>
      <div className={styles.view}>
        <header className={styles.head}>
          <ProjectCrumb projectId={chat.project_id} />
          <h1 className={`${styles.title} ${chat.title ? '' : styles.untitled}`}>{chat.title || 'Nuevo chat'}</h1>
          <p className={styles.meta}>
            <time dateTime={chat.created_at}>{when.format(new Date(chat.created_at))}</time>
            {sources.length > 1 && <> · {sources.length} fuentes</>}
            {doc?.page_count != null && <> · {doc.page_count} {doc.page_count === 1 ? 'pág.' : 'págs.'}</>}
          </p>
          {reading.length > 0 && <ChatSettings chat={chat} overview={chat.overview?.summary ?? primary?.summary ?? null} />}
          {doc && doc.status !== 'pending' && <ReindexButton chatId={chat.id} doc={doc} />}
        </header>
        {sources.length > 0 && (
          <div className={styles.sources}>
            <SourcesBar chatId={chat.id} sources={sources} selectedId={tab} compat={compat} onSelect={(id) => { setSelected(id); setFromCitation(false) }} />
          </div>
        )}
        <DropToAdd chatId={chat.id} className={styles.dropArea}>
          <main className={styles.viewer} data-viewer data-fill={doc?.status === 'ready'} aria-label="Visor">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={stage} className={styles.stage}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease }}
              >
                {!doc && <UploadDropzone chatId={chat.id} handlers={handlers} />}
                {doc && (doc.status === 'pending' || doc.status === 'processing') && (
                  <>
                    <IngestPanel chatId={chat.id} doc={doc} />
                    {polling.error && <ErrorNote error={polling.error as ApiClientError} handlers={{ retry: polling.refetch }} />}
                  </>
                )}
                {doc?.status === 'failed' && (
                  <>
                    <IngestPanel chatId={chat.id} doc={doc} />
                    {only && <UploadDropzone chatId={chat.id} replacing handlers={handlers} />}
                  </>
                )}
                {doc?.status === 'ready' && <DocumentViewer key={doc.id} doc={doc} autoOpen={fromCitation} />}
              </motion.div>
            </AnimatePresence>
          </main>
        </DropToAdd>
        <section className={styles.chat} aria-label="Conversación y estudio">
          <ChatColumn chatId={chat.id} chatTitle={chat.title} doc={primary ?? null} goToSettings={handlers.goToSettings}>
            <Conversation
              chatId={chat.id} chatTitle={chat.title} persona={chat.persona ?? null} doc={primary ?? null}
              overview={chat.overview ?? null} readableCount={reading.length}
              handlers={{ newChat, backToList: handlers.backToList }}
            />
          </ChatColumn>
        </section>
      </div>
    </SourcesContext.Provider>
  )
}
