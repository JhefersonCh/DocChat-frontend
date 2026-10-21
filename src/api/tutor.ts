import { api } from './client'
import type { TutorGrade, TutorQuestion } from '@/domain/tutor'

export const tutorKeys = { list: (chatId: string) => ['tutor', chatId] as const }

const json = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

/** In review order: due ones first (failed before the rest). The rubric stays hidden until answered. */
export const listTutorQuestions = (chatId: string) => api<TutorQuestion[]>(`/chats/${chatId}/tutor/questions`)

/** 201 the NEW questions; 409 no_chat_profile / document_not_ready; 502 invalid_provider_response. */
export const generateTutorQuestions = (chatId: string, count = 5) =>
  api<TutorQuestion[]>(`/chats/${chatId}/tutor/questions`, json({ count }))

/** 200 per-point grade; 404 tutor_question_not_found; 422 invalid_answer; 502 invalid_provider_response. */
export const answerTutorQuestion = (chatId: string, id: string, text: string) =>
  api<TutorGrade>(`/chats/${chatId}/tutor/questions/${id}/answer`, json({ text }))
