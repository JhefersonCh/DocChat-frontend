import styles from './PersonaBadge.module.css'

/** "Voz: el zorro": the answers (or this answer) are written in a persona, always from the retrieved text. */
export function PersonaBadge({ persona }: { persona: string }) {
  return <span className={styles.badge} title="Responde en primera persona, pero solo con lo que dice el documento"><span aria-hidden="true">❝</span>Voz: {persona}</span>
}
