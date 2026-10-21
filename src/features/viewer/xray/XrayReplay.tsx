import { parseCitedRefs } from '@/domain/citations'
import type { Message } from '@/domain/types'
import { useXrayActions } from './XrayContext'
import styles from './xray.module.css'

/** "Rayos X" under a persisted answer: shows where it looked in the document and replays the sweep. */
export function XrayReplay({ message: m }: { message: Message }) {
  const { show } = useXrayActions()
  const searches = m.searches ?? []
  if (!searches.some((s) => s.found?.length)) return null // answered before the X-ray existed
  const citations = m.citations ?? []
  return (
    <button
      type="button" className={styles.replay} aria-label="Ver la recuperación de esta respuesta en el documento (rayos X)"
      onClick={() => show({ id: m.id, searches, citations, cited: parseCitedRefs(m.content, citations.length), locked: true, live: false })}
    >
      <span aria-hidden="true">⟲</span> Rayos X
    </button>
  )
}
