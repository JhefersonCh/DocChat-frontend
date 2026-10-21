/** Source compatibility alerts (informative, never blocking): do the sources talk about related things? */

export type CompatStatus = 'ok' | 'weak' | 'unrelated' | 'duplicate' | 'unknown'

export interface CompatMatch { document_id: string; alias: string; similarity: number }

export interface SourceCompat {
  document_id: string
  alias: string
  filename: string
  status: CompatStatus
  best_match: CompatMatch | null
  reason: string | null
}

export interface Compatibility { coherent: boolean; sources: SourceCompat[] }

/** A source worth flagging with ⚠. */
export const isFlagged = (s: SourceCompat | undefined): s is SourceCompat => s?.status === 'weak' || s?.status === 'unrelated' || s?.status === 'duplicate'

export const compatById = (c: Compatibility | undefined): Map<string, SourceCompat> =>
  new Map((c?.sources ?? []).map((s) => [s.document_id, s]))

export const flaggedOf = (c: Compatibility | undefined): SourceCompat[] => (c?.sources ?? []).filter(isFlagged)

/** Tooltip of the ⚠ mark: what is wrong, how close its best match is, and the model's one-liner. */
export function warningText(s: SourceCompat): string {
  if (s.status === 'duplicate') {
    const copy = s.best_match ? `Parece la misma fuente que ${s.best_match.alias}` : 'Parece una fuente repetida'
    return s.reason && s.reason !== copy ? s.reason : copy
  }
  const lines = ['Poco relacionada con las demás fuentes']
  if (s.best_match) lines.push(`Más parecida: ${s.best_match.alias} (similitud ${Math.round(s.best_match.similarity * 100)} %)`)
  if (s.reason) lines.push(s.reason)
  return lines.join('\n')
}

/** Banner text when `coherent` is false; `label` picks how to name a source (alias in chats, file name in the library). */
export function bannerText(c: Compatibility | undefined, label: (s: SourceCompat) => string = (s) => s.alias): string | null {
  if (!c || c.coherent) return null
  const names = c.sources.filter((s) => s.status === 'unrelated' || s.status === 'weak').map(label)
  const copies = c.sources.filter((s) => s.status === 'duplicate').map(label)
  if (names.length === 0 && copies.length === 0) return null
  const parts = []
  if (names.length > 0) parts.push(`algunas fuentes no se relacionan entre sí (${names.join(', ')})`)
  if (copies.length > 0) parts.push(`${copies.join(', ')} parecen la misma fuente repetida`)
  return `El análisis indica que ${parts.join(' y ')}. Podés seguir igual; las respuestas pueden mezclar temas.`
}

/** Query-key part that changes when the source set (or what is read) changes, so the check is re-run. */
export const sourceSignature = (sources: { id: string; status: string; active?: boolean }[]): string =>
  sources.map((s) => `${s.id}:${s.status}:${s.active === false ? 0 : 1}`).join('|')
