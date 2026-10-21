import type { RubricData, RubricStatus } from '@/domain/artifacts'
import { PageLink } from './PageLink'
import styles from './views2.module.css'

const STATUS: Record<RubricStatus, string> = { cumple: 'Cumple', parcial: 'Parcial', no_encontrado: 'No encontrado' }
const ORDER: RubricStatus[] = ['cumple', 'parcial', 'no_encontrado']

export function RubricView({ data }: { data: RubricData }) {
  const total = data.criteria.length || 1
  return (
    <div className={styles.rubric}>
      <p className={styles.h}>{data.preset_label}</p>
      <div className={styles.bar} role="img" aria-label={ORDER.map((s) => `${data.summary[s]} ${STATUS[s].toLowerCase()}`).join(', ')}>
        {ORDER.map((s) => data.summary[s] > 0 && <span key={s} data-tone={s} style={{ flexGrow: data.summary[s] / total }} />)}
      </div>
      <ul className={styles.legend}>
        {ORDER.map((s) => <li key={s}><i data-tone={s} />{data.summary[s]} {STATUS[s].toLowerCase()}</li>)}
      </ul>
      <ul className={styles.criteria}>
        {data.criteria.map((c) => (
          <li key={c.id} className={styles.criterion}>
            <p className={styles.cHead}><strong>{c.label}</strong><span className={styles.chip} data-tone={c.status}>{STATUS[c.status]}</span></p>
            <p className={styles.text}>{c.justification}</p>
            {c.quote && <p><q className={styles.quote}>{c.quote}</q> <PageLink pageRef={c} quote={c.quote} /></p>}
            {c.suggestion && <p className={styles.suggest}>Sugerencia: {c.suggestion}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}
