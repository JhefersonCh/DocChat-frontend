import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getWaveform } from '@/api/media'
import { keys } from '@/api/queryKeys'

const FLAT = Array.from({ length: 200 }, () => 0)

/**
 * Peaks of an audio document (shared by the viewer and every mini waveform: one request per document).
 * No waveform (404 / still computing / malformed) -> `flat: true` with a silent line to draw instead.
 */
export function useWaveform(docId: string) {
  const q = useQuery({ queryKey: keys.documentWaveform(docId), queryFn: () => getWaveform(docId), staleTime: 60_000, retry: false })
  return useMemo(() => ({
    peaks: q.data?.peaks ?? FLAT,
    flat: !q.data,
    duration: q.data?.duration_s ?? null,
    pending: q.isPending,
  }), [q.data, q.isPending])
}
