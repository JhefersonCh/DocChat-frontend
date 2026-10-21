import { useState, type ReactNode } from 'react'
import { createReadingStore, ReadingContext } from './reading'

const key = (chatId: string) => `chatpdf:spoiler:${chatId}`

function remembered(chatId: string): boolean {
  try { return localStorage.getItem(key(chatId)) === '1' } catch { return false }
}

/** One reading store per chat; the spoiler-safe choice survives a reload (storage may be unavailable). */
export function ReadingProvider({ chatId, children }: { chatId: string; children: ReactNode }) {
  const [store] = useState(() => createReadingStore({ spoilerSafe: remembered(chatId) }, (on) => {
    try { localStorage.setItem(key(chatId), on ? '1' : '0') } catch { /* private mode: not remembered */ }
  }))
  return <ReadingContext.Provider value={store}>{children}</ReadingContext.Provider>
}
