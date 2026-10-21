import type { Message } from '@/domain/types'

/** The only answer that offers follow-ups: the last message, if it is an assistant answer and no turn is running. */
export function suggestionTarget(messages: Message[], turnRunning: boolean): Message | undefined {
  const last = messages.at(-1)
  return !turnRunning && last?.role === 'assistant' ? last : undefined
}
