import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getStoryboard } from '@/api/media'
import { keys } from '@/api/queryKeys'
import type { ChunkInfo } from '@/domain/types'
import { toFrames, type Frame } from '@/domain/video'

/**
 * Frames of a video: captions come from the chunk list, the storyboard is the lightweight fallback that still
 * draws the filmstrip when the chunk list is not there (one request per document, shared by every consumer).
 */
export function useFrames(docId: string, chunks: readonly ChunkInfo[] | undefined, duration: number | null): Frame[] {
  const board = useQuery({ queryKey: keys.documentStoryboard(docId), queryFn: () => getStoryboard(docId), staleTime: 60_000, retry: false })
  return useMemo(() => toFrames(chunks, board.data, duration), [chunks, board.data, duration])
}
