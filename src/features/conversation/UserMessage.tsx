import { memo } from 'react'
import styles from './Messages.module.css'

export const UserMessage = memo(function UserMessage({ text, unsent = false, id }: { text: string; unsent?: boolean; id?: string }) {
  return (
    <div className={`${styles.user} ${unsent ? styles.unsent : ''}`} data-message-id={id}>
      <p className={styles.userText}>{text}</p>
      {unsent && <p className={styles.unsentLabel}>No enviada</p>}
    </div>
  )
})
