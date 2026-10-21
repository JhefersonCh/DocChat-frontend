import type { AuditData } from '@/domain/artifacts'
import { formatNumber } from '@/domain/studio'
import { PageLink } from './PageLink'
import styles from './views2.module.css'

const SEVERITY = { high: 'Alta', medium: 'Media', low: 'Baja' } as const

export function AuditView({ data }: { data: AuditData }) {
  const { findings } = data
  return (
    <div className={styles.audit}>
      <p className={styles.verdict} data-ok={findings.length === 0}>{data.message}</p>
      {findings.length > 0 && (
        <ul className={styles.findings}>
          {findings.map((f, i) => (
            <li key={i} className={styles.finding} data-severity={f.severity}>
              <p className={styles.fHead}>
                <span className={styles.chip} data-tone={f.severity}>{SEVERITY[f.severity]}</span>
                {f.message}
              </p>
              {f.expected != null && f.actual != null && (
                <p className={styles.delta}>Esperado {formatNumber(f.expected)} · figura {formatNumber(f.actual)}</p>
              )}
              <ul className={styles.evidence}>
                {f.evidence.map((e, j) => (
                  <li key={j}>
                    <q className={styles.quote}>{e.quote}</q> <PageLink pageRef={e} quote={e.quote} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
