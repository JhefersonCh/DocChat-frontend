import { memo, useMemo, useRef, useState, type ReactNode } from 'react'
import { parseCitedRefs } from '@/domain/citations'
import { isExplainQuestion } from '@/domain/selection'
import { readability, readabilityLabel } from '@/domain/readability'
import type { Citation, Message } from '@/domain/types'
import { Paper } from '@/ui/Paper'
import { AssistantText } from './AssistantText'
import { MarginNotes } from './MarginNotes'
import { PersonaBadge } from './PersonaBadge'
import { VerifiedText } from './VerifiedText'
import { VerifyBar } from './VerifyBar'
import verifyStyles from './Verify.module.css'
import { SaveNoteButton } from '@/features/notes/SaveNoteButton'
import { SpeakButton } from '@/features/voice/SpeakButton'
import { SpokenHighlight } from '@/features/voice/SpokenHighlight'
import { XrayReplay } from '@/features/viewer/xray/XrayReplay'
import { LiveTrace, TraceSummary, type TraceSearch } from './ThinkingTrace'
import styles from './Messages.module.css'

interface Props {
  text: string
  citations: Citation[]
  cited: number[]
  searches: TraceSearch[]
  /** Between send and the first token: the lab trace is showing. */
  tracing?: boolean
  /** Tokens still arriving (word reveal on, notes unfolded). */
  streaming?: boolean
  /** Freshly arrived over SSE (plays stagger) vs history. */
  live?: boolean
  /** Mid-stream failure: partial text is tinted. */
  failed?: boolean
  /** The best source was a weak match: show the "Evidencia débil" badge. */
  weak?: boolean
  startedAt?: number
  /** Voice the answer is written in. */
  persona?: string | null
  /** Who the speech engine calls this text (`live` or the message id): the sentence being read is highlighted. */
  speechOwner?: string
  /** Replaces the rendered text (e.g. the claim-checked view). */
  body?: ReactNode
  /** Actions under the answer (e.g. save as note). */
  footer?: ReactNode
  /** Persisted message id: where a search result jumps to. */
  messageId?: string
}

const NO_CITATIONS: Citation[] = []
const NO_SEARCHES: TraceSearch[] = []

export const AssistantMessage = memo(function AssistantMessage({
  text, citations, cited, searches, tracing = false, streaming = false, live = false, failed = false, weak = false, startedAt = 0, persona = null, speechOwner, body, footer, messageId,
}: Props) {
  const root = useRef<HTMLElement>(null)
  const hasPaper = text.length > 0 || citations.length > 0
  return (
    <article ref={root} className={styles.assistant} aria-label="Respuesta" data-message-id={messageId}>
      {speechOwner && <SpokenHighlight root={root} owner={speechOwner} />}
      {tracing
        ? <LiveTrace searches={searches} startedAt={startedAt} thinking={citations.length > 0} />
        : <TraceSummary searches={searches} />}
      {hasPaper && (
        <Paper className={`${styles.paper} ${failed ? styles.failedPaper : ''}`}>
          {weak && (
            <p className={styles.weak} title="Las fuentes recuperadas parecen poco relacionadas con la pregunta">Evidencia débil</p>
          )}
          {persona && <PersonaBadge persona={persona} />}
          {body ?? (text && <AssistantText text={text} citations={citations} reveal={streaming} />)}
          <MarginNotes citations={citations} cited={cited} settled={!tracing && !streaming} live={live} />
          {footer}
        </Paper>
      )}
    </article>
  )
})

/** A persisted answer: memoized on the message so streaming tokens of the live turn never re-render it. */
/** `chatId` enables "Guardar nota" and "Verificar"; `question` (what was asked) enables the readability of explain answers. */
export const HistoryAssistant = memo(function HistoryAssistant({ message: m, chatId, question }: { message: Message; chatId?: string; question?: string }) {
  const citations = m.citations ?? NO_CITATIONS
  const cited = useMemo(() => parseCitedRefs(m.content, citations.length), [m.content, citations.length])
  const [verified, setVerified] = useState(true)
  const level = useMemo(() => (question && isExplainQuestion(question) ? readability(m.content) : null), [question, m.content])
  const showVerified = !!m.verification && verified
  const footer = chatId ? (
    <div className={verifyStyles.actions}>
      <SaveNoteButton chatId={chatId} messageId={m.id} />
      <SpeakButton messageId={m.id} text={m.content} />
      <XrayReplay message={m} />
      <VerifyBar chatId={chatId} messageId={m.id} verification={m.verification} shown={verified} onToggle={() => setVerified((v) => !v)} />
      {level && <p className={verifyStyles.legibility} title="Índice Szigriszt-Pazos (escala INFLESZ)">{readabilityLabel(level)}</p>}
    </div>
  ) : level ? <p className={verifyStyles.legibility}>{readabilityLabel(level)}</p> : undefined
  return <AssistantMessage text={m.content} citations={citations} cited={cited} searches={m.searches ?? NO_SEARCHES} weak={m.weak_evidence}
    persona={m.persona} speechOwner={m.id} messageId={m.id} body={showVerified ? <VerifiedText verification={m.verification!} citations={citations} /> : undefined} footer={footer} />
})
