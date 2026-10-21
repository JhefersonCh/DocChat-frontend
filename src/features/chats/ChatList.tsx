import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMatch, useNavigate } from 'react-router'
import type { ApiClientError } from '@/api/client'
import { ChatIcon, MoreToggle, SidebarSection } from '@/app/SidebarSection'
import { PinMark } from '@/app/pinMarks'
import { pickVisible, pinMarkBefore } from '@/app/sidebarSection'
import { ErrorNote } from '@/ui/ErrorNote'
import { spring, fade } from '@/ui/motion'
import { ChatListItem } from './ChatListItem'
import { useChats, useCreateChat, useDeleteChat, usePinChat } from './hooks'
import styles from './ChatList.module.css'

const LIMIT = 5

export function ChatList() {
  const chats = useChats()
  const del = useDeleteChat()
  const navigate = useNavigate()
  const activeId = useMatch('/chats/:id')?.params.id
  const calm = useReducedMotion()
  const create = useCreateChat()
  const pin = usePinChat()
  const [expanded, setExpanded] = useState(false)
  // project chats live on their project's page
  const loose = useMemo(() => chats.data?.filter((c) => !c.project_id), [chats.data])
  const shown = pickVisible(loose ?? [], LIMIT, expanded, activeId)

  return (
    <SidebarSection
      storageKey="chats" title="Chats" icon={<ChatIcon />} count={loose?.length} addLabel="Nuevo chat" addDisabled={create.isPending}
      onAdd={() => create.mutate(undefined, { onSuccess: (c) => navigate(`/chats/${c.id}`) })}
    >
      {create.isError && <p className={styles.err} role="alert">No se pudo crear el chat.</p>}
      {chats.error && <ErrorNote error={chats.error as ApiClientError} handlers={{ retry: () => void chats.refetch() }} />}
      {del.error && <ErrorNote error={del.error as ApiClientError} />}
      <ul className={styles.list} aria-label="Lista de chats">
        <AnimatePresence initial={false}>
          {shown.flatMap((c, i) => [
            ...((m) => (m ? [<PinMark key={m} kind={m} />] : []))(pinMarkBefore(shown[i - 1], c, i)),
            <motion.li key={c.id} layout={calm ? false : 'position'} initial={{ opacity: 0, x: calm ? 0 : -12 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: calm ? 0 : -16 }} transition={calm ? { duration: 0.12 } : { ...spring, opacity: fade }}>
              <ChatListItem
                chat={c} active={c.id === activeId} deleting={del.isPending}
                onTogglePin={() => pin.mutate({ id: c.id, pinned: !c.pinned_at })}
                onDelete={() => del.mutate(c.id, { onSuccess: () => { if (c.id === activeId) navigate('/') } })}
              />
            </motion.li>,
          ])}
        </AnimatePresence>
      </ul>
      {loose && loose.length > LIMIT && <MoreToggle expanded={expanded} hidden={loose.length - LIMIT} onClick={() => setExpanded((e) => !e)} />}
      {loose?.length === 0 && <p className={styles.empty}>Ningún expediente todavía.</p>}
    </SidebarSection>
  )
}
