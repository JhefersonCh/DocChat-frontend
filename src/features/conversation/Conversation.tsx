import { useEffect, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router'
import type { ApiClientError } from '@/api/client'
import { parseCitedRefs } from '@/domain/citations'
import { describeError, type ErrorAction } from '@/domain/errors'
import type { CollectionOverview as Collection, Document, Message } from '@/domain/types'
import { chatToMarkdown, exportFilename } from '@/domain/exportMd'
import { Button } from '@/ui/Button'
import { downloadText } from '@/ui/download'
import { ErrorNote } from '@/ui/ErrorNote'
import { AssistantMessage, HistoryAssistant } from './AssistantMessage'
import { Composer } from './Composer'
import { MessageList } from './MessageList'
import { UserMessage } from './UserMessage'
import { DocumentOverview } from '@/features/overview/DocumentOverview'
import { CollectionOverview } from '@/features/overview/CollectionOverview'
import { useSources } from '@/features/sources/SourcesContext'
import { useRegenerateSummary } from '@/features/ingest/hooks'
import { suggestionTarget } from '@/domain/suggestions'
import { useReadingStore } from '@/features/viewer/reading'
import { useAskBridge } from './askBridgeContext'
import { useXrayActions } from '@/features/viewer/xray/XrayContext'
import { LastSuggestions } from './LastSuggestions'
import { PersonaBadge } from './PersonaBadge'
import { SpoilerToggle } from './SpoilerToggle'
import { isActive } from './askReducer'
import { useJumpToMessage } from '@/features/search/useJumpToMessage'
import { useMessages } from './hooks'
import { useAskStream } from './useAskStream'
import { VoicePanel } from '@/features/voice/VoicePanel'
import { useVoiceMode } from '@/features/voice/useVoiceMode'
import styles from './Conversation.module.css'

/** The user question an answer replies to (the message right before it). */
function askedBefore(messages: Message[], id: string): string | undefined {
  const i = messages.findIndex((m) => m.id === id)
  return i > 0 && messages[i - 1]!.role === 'user' ? messages[i - 1]!.content : undefined
}

function lockedReason(doc: Document | null, readableCount: number): string | null {
  if (!doc) return 'Subí un documento para empezar a conversar.'
  if (doc.status === 'ready') return readableCount > 0 ? null : 'Activá al menos una fuente para conversar.'
  if (doc.status === 'failed') return 'La ingesta falló. Subí otro archivo para continuar.'
  return 'Esperando a que termine la ingesta del documento…'
}

interface Props {
  chatId: string
  doc: Document | null
  chatTitle?: string
  /** Voice the answers are written in, if the chat has one. */
  persona?: string | null
  /** Aggregate of the sources' overviews (chats with 2+ sources). */
  overview?: Collection | null
  /** Sources a question would read (ready and active); defaults to 1 when `doc` is ready. */
  readableCount?: number
  /** Extra error actions the parent owns (new chat, back to the list). */
  handlers?: Partial<Record<ErrorAction, () => void>>
}

export function Conversation({ chatId, doc, chatTitle = '', persona = null, overview = null, readableCount, handlers: parent = {} }: Props) {
  const sources = useSources()
  const readable = readableCount ?? (doc?.status === 'ready' ? 1 : 0)
  const navigate = useNavigate()
  const history = useMessages(chatId)
  const { state, send, cancel, reset } = useAskStream(chatId)
  const [draft, setDraft] = useState('')
  const regenerate = useRegenerateSummary(chatId)
  const reading = useReadingStore()

  const messages = history.data ?? []
  useJumpToMessage(chatId, messages.map((m) => m.id), history.isSuccess)
  const active = isActive(state)
  const persisted = state.messageId != null && messages.some((m) => m.id === state.messageId)
  const noProfile = state.phase === 'failed' && state.error?.code === 'no_chat_profile'
  const turn = state.phase !== 'idle' && state.phase !== 'cancelled' && !persisted

  useEffect(() => { if (persisted) reset() }, [persisted, reset])
  // No chat model: nothing was persisted and the question goes back to the composer.
  const ask = (q: string) => void send(q, reading.maxPage()).then((err) => { if (err?.code === 'no_chat_profile') setDraft((d) => d || q) })
  const target = suggestionTarget(messages, turn)
  const { register } = useAskBridge()
  const xray = useXrayActions()
  // X-ray: the strip follows the turn in flight (hits light up per `search`, cited ones lock in as the text references them).
  const refsKey = (state.phase === 'complete' ? state.cited : parseCitedRefs(state.text, state.citations.length)).join(',')
  useEffect(() => {
    if (!turn || state.searches.length === 0) return
    xray.publishLive({
      id: 'live', searches: state.searches, citations: state.citations, live: true,
      cited: refsKey ? refsKey.split(',').map(Number) : [], locked: state.citations.length > 0,
    })
  }, [turn, state.searches, state.citations, refsKey, xray])
  useEffect(() => { register(active ? null : ask); return () => register(null) })
  const submit = () => { const q = draft.trim(); if (q) { setDraft(''); ask(q) } }
  const stop = () => { setDraft((d) => d || state.question); cancel() }
  const voice = useVoiceMode({
    ask, cancelAsk: cancel, ready: lockedReason(doc, readable) == null,
    turn: { phase: state.phase, text: state.text, messageId: state.messageId, active },
  })
  const failed = state.phase === 'failed' && !noProfile
  const tracing = state.phase === 'connecting' || state.phase === 'retrieving' || state.phase === 'thinking'
  const exportChat = () => downloadText(
    exportFilename(sources.length > 1 ? chatTitle : doc?.filename || chatTitle, 'md'),
    chatToMarkdown({ title: chatTitle || doc?.filename || '', doc, messages, date: new Date(), sources }),
  )
  const announce = active ? 'Respondiendo…' : state.phase === 'complete' ? state.text : ''

  return (
    <div className={styles.col} onKeyDown={(e) => { if (e.key === 'Escape' && active) stop() }}>
      <div className={styles.kickerRow}>
        <p className={styles.kicker}>Conversación</p>
        <div className={styles.tools}>
          {persona && <PersonaBadge persona={persona} />}
          {doc?.status === 'ready' && <SpoilerToggle />}
          <Button className={styles.export} disabled={messages.length === 0} onClick={exportChat}>Exportar .md</Button>
        </div>
      </div>
      <MessageList tick={messages.length * 1e6 + state.text.length + state.searches.length + state.phase.length}>
        {doc?.status === 'ready' && overview && (
          <CollectionOverview overview={overview} compact={messages.length > 0 || turn} onAsk={ask} />
        )}
        {doc?.status === 'ready' && !overview && (
          <DocumentOverview
            doc={doc} compact={messages.length > 0 || turn} onAsk={ask}
            onGenerate={() => regenerate.mutate(doc.id)} generating={regenerate.isPending}
            error={regenerate.error as ApiClientError | null} goToSettings={() => navigate('/settings')}
          />
        )}
        {messages.length === 0 && !turn && (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>{doc?.status === 'ready' ? 'Preguntale al documento.' : 'Todavía no hay nada que preguntar.'}</p>
            <p className={styles.emptyHint}>Cada respuesta cita los fragmentos en los que se apoya.</p>
          </div>
        )}
        {messages.map((m) => m.role === 'user' ? (
          <UserMessage key={m.id} id={m.id} text={m.content} />
        ) : (
          <HistoryAssistant key={m.id} message={m} chatId={chatId} question={askedBefore(messages, m.id)} />
        ))}
        {target && <LastSuggestions chatId={chatId} message={target} pending={turn || active} onPick={ask} />}
        {turn && noProfile && state.error && (
          <ErrorNote error={state.error} handlers={{ goToSettings: () => navigate('/settings') }} />
        )}
        {turn && !noProfile && (
          <>
            <UserMessage text={state.question} unsent={failed} />
            <AssistantMessage
              key="live" text={state.text} citations={state.citations} searches={state.searches}
              cited={state.phase === 'complete' ? state.cited : parseCitedRefs(state.text, state.citations.length)}
              speechOwner="live" persona={persona} tracing={tracing} streaming={state.phase === 'streaming'} live failed={failed} weak={state.weak} startedAt={state.startedAt}
            />
            {failed && state.error && (
              <div className={styles.failure}>
                <ErrorNote error={state.error as ApiClientError} handlers={{ ...parent, goToSettings: () => navigate('/settings') }} />
                <div className={styles.failureActions}>
                  {describeError(state.error).actions.includes('retry') && (
                    <Button variant="solid" onClick={() => ask(state.question)}>Reintentar</Button>
                  )}
                  <Button onClick={reset}>Descartar</Button>
                </div>
              </div>
            )}
          </>
        )}
      </MessageList>
      <p className={styles.sr} aria-live="polite">{announce}</p>
      <AnimatePresence initial={false}>
        {voice.enabled && <VoicePanel key="voice" voice={voice} onSettings={() => navigate('/settings')} />}
      </AnimatePresence>
      <Composer
        value={draft} onChange={setDraft} onSend={submit} onCancel={stop} busy={active} lockedReason={lockedReason(doc, readable)}
        voice={{ on: voice.enabled, onToggle: voice.toggle }}
      />
    </div>
  )
}
