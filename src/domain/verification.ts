import type { Citation, Claim, ClaimStatus } from './types'

export const STATUS_LABEL: Record<ClaimStatus, string> = { respaldada: 'Respaldada', parcial: 'Parcial', sin_respaldo: 'Sin respaldo' }
/** Not color-only: every status also has its own glyph. */
export const STATUS_ICON: Record<ClaimStatus, string> = { respaldada: '✓', parcial: '~', sin_respaldo: '✕' }

const SEVERITY: ClaimStatus[] = ['respaldada', 'parcial', 'sin_respaldo']

/** The weakest status of a sentence's claims decides how it is flagged. */
export function worstStatus(claims: Claim[]): ClaimStatus | null {
  return claims.reduce<ClaimStatus | null>((w, c) => (w == null || SEVERITY.indexOf(c.status) > SEVERITY.indexOf(w) ? c.status : w), null)
}

export const claimsOf = (claims: Claim[], sentence: number) => claims.filter((c) => c.sentence_index === sentence)

/** "5 respaldadas · 1 parcial · 1 sin respaldo" (zeros omitted); "Sin afirmaciones" when there are none. */
export function summaryLabel(claims: Claim[]): string {
  const n = (s: ClaimStatus) => claims.filter((c) => c.status === s).length
  const parts = [
    n('respaldada') && `${n('respaldada')} ${n('respaldada') === 1 ? 'respaldada' : 'respaldadas'}`,
    n('parcial') && `${n('parcial')} ${n('parcial') === 1 ? 'parcial' : 'parciales'}`,
    n('sin_respaldo') && `${n('sin_respaldo')} sin respaldo`,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Sin afirmaciones verificables'
}

/** The citation to open in the viewer for a claim: its first source, narrowed to the quoted text when known. */
export function claimCitation(claim: Claim, citations: Citation[]): Citation | null {
  const source = citations.find((c) => claim.source_ns.includes(c.n))
  if (!source) return null
  return claim.quote ? { ...source, content: claim.quote, rects: null } : source
}
