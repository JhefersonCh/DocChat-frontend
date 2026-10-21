import { useId } from 'react'
import type { Citation, Verification } from '@/domain/types'
import { claimCitation, claimsOf, STATUS_ICON, STATUS_LABEL, worstStatus } from '@/domain/verification'
import { useTrace } from './TraceContext'
import styles from './Verify.module.css'

/**
 * The answer sentence by sentence, each flagged by its weakest claim: colored underline AND a glyph AND a
 * tooltip with the reason and the quote (never color alone). Clicking opens the quote in the document.
 */
export function VerifiedText({ verification, citations }: { verification: Verification; citations: Citation[] }) {
  const { onCiteSelect } = useTrace()
  const base = useId()
  return (
    <p className={styles.text}>
      {verification.sentences.map((sentence, i) => {
        const claims = claimsOf(verification.claims, i)
        const status = worstStatus(claims)
        if (!status) return <span key={i}>{sentence} </span>
        const tip = `${base}-${i}`
        const target = claims.map((c) => claimCitation(c, citations)).find(Boolean) ?? null
        return (
          <span key={i} className={styles.sentence} data-status={status}>
            <button
              type="button" className={styles.claim} aria-describedby={tip} data-status={status}
              data-openable={target != null}
              onClick={(e) => { if (target) onCiteSelect(target, { origin: e.currentTarget, group: citations }) }}
            >
              <span className={styles.icon} aria-hidden="true">{STATUS_ICON[status]}</span>
              <span className={styles.srOnly}>{STATUS_LABEL[status]}: </span>
              {sentence}
            </button>
            <span id={tip} role="tooltip" className={styles.tip}>
              {claims.map((c, j) => (
                <span key={j} className={styles.tipClaim} data-status={c.status}>
                  <span className={styles.tipHead}>{STATUS_ICON[c.status]} {STATUS_LABEL[c.status]}{c.source_ns.length > 0 && ` · fuente ${c.source_ns.map((n) => `[${n}]`).join('')}`}</span>
                  {c.reason && <span>{c.reason}</span>}
                  {c.quote && <q className={styles.quote}>{c.quote}</q>}
                </span>
              ))}
            </span>{' '}
          </span>
        )
      })}
    </p>
  )
}
