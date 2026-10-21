import { useNavigate } from 'react-router'
import type { ApiClientError } from '@/api/client'
import { AskBridgeProvider } from '@/features/conversation/AskBridge'
import { TraceProvider } from '@/features/conversation/TraceProvider'
import { XrayProvider } from '@/features/viewer/xray/XrayProvider'
import { ReadingProvider } from '@/features/viewer/ReadingProvider'
import { ErrorNote } from '@/ui/ErrorNote'
import { ChatWorkspace } from './ChatWorkspace'
import { useChat, useCreateChat } from './hooks'
import styles from './ChatView.module.css'

export function ChatView({ id }: { id: string }) {
  const navigate = useNavigate()
  const chat = useChat(id)
  const create = useCreateChat()
  const handlers = {
    newChat: () => create.mutate(undefined, { onSuccess: (c) => navigate(`/chats/${c.id}`) }),
    goToSettings: () => navigate('/settings'),
    backToList: () => navigate('/'),
  }

  if (chat.error) {
    return (
      <div className={styles.fallback}>
        <ErrorNote error={chat.error as ApiClientError} handlers={{ ...handlers, retry: () => void chat.refetch() }} />
      </div>
    )
  }
  if (!chat.data) return <p className={styles.loading} role="status">Leyendo expediente…</p>

  return (
    <TraceProvider key={id}>
      <XrayProvider>
        <AskBridgeProvider>
          <ReadingProvider chatId={id}>
            <ChatWorkspace chat={chat.data} />
          </ReadingProvider>
        </AskBridgeProvider>
      </XrayProvider>
    </TraceProvider>
  )
}
