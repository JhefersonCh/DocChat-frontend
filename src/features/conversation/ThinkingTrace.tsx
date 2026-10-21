import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { ScanBar } from '@/ui/ScanBar'
import { ease } from '@/ui/motion'
import styles from './ThinkingTrace.module.css'

export interface TraceSearch { query: string; k: number; hits?: number }

const MAX_TICKS = 15

/** One search = one pass of the scan: k ticks, `hits` of them light up in sequence. */
function SearchRow({ search }: { search: TraceSearch }) {
  const ticks = Math.min(search.k, MAX_TICKS)
  return (
    <motion.li
      className={styles.row}
      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18, ease }}
    >
      <span className={styles.query}>{search.query}</span>
      <span className={styles.stats}>
        k {search.k}{search.hits != null && <> · <b className={styles.hits}>{search.hits}</b> {search.hits === 1 ? 'hit' : 'hits'}</>}
      </span>
      {search.hits != null && (
        <span className={styles.ticks} aria-hidden="true">
          <span className={styles.pass} />
          {Array.from({ length: ticks }, (_, i) => (
            <span key={i} className={i < search.hits! ? styles.lit : styles.tick} style={{ ['--i' as string]: i }} />
          ))}
        </span>
      )}
    </motion.li>
  )
}

function useElapsed(since: number, running: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [running])
  return Math.max(0, Math.floor((now - since) / 1000))
}

interface LiveProps { searches: TraceSearch[]; startedAt: number; thinking: boolean }

/** Territory B, between send and first token: live searches + indeterminate scan. */
export function LiveTrace({ searches, startedAt, thinking }: LiveProps) {
  const s = useElapsed(startedAt, true)
  return (
    <div className={styles.panel}>
      {/* The only announcement is Conversation's sr-only live region; the ticking clock stays silent. */}
      <p className={styles.kicker}>{thinking ? 'Leyendo los fragmentos' : 'Buscando en el documento'}<span aria-hidden="true"> · {s}s</span></p>
      <ScanBar />
      {searches.length > 0 && <ul className={styles.list}>{searches.map((q, i) => <SearchRow key={i} search={q} />)}</ul>}
    </div>
  )
}

/** After the answer starts (or in history): what the backend looked up, folded. */
export function TraceSummary({ searches }: { searches: TraceSearch[] }) {
  if (searches.length === 0) return null
  return (
    <details className={styles.summary}>
      <summary>Consultó {searches.length} {searches.length === 1 ? 'búsqueda' : 'búsquedas'}</summary>
      <ul className={styles.sumList}>
        {searches.map((q, i) => (
          <li key={i}>{q.query} <span>k {q.k}{q.hits != null && ` · ${q.hits} hits`}</span></li>
        ))}
      </ul>
    </details>
  )
}
