import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { answerTutorQuestion, generateTutorQuestions, listTutorQuestions, tutorKeys } from '@/api/tutor'

export const useTutorQuestions = (chatId: string, enabled = true) =>
  useQuery({ queryKey: tutorKeys.list(chatId), queryFn: () => listTutorQuestions(chatId), enabled })

export function useGenerateQuestions(chatId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (count: number) => generateTutorQuestions(chatId, count),
    onSuccess: () => qc.invalidateQueries({ queryKey: tutorKeys.list(chatId) }),
  })
}

/** The list is refetched afterwards: score, schedule and mastery chips follow the attempt. */
export function useAnswerQuestion(chatId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => answerTutorQuestion(chatId, id, text),
    onSuccess: () => qc.invalidateQueries({ queryKey: tutorKeys.list(chatId) }),
  })
}
