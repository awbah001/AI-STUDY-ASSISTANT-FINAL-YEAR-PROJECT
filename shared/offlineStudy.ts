import { z } from "zod";

export const offlineStudyEventSchema = z.object({
  eventId: z.string().regex(/^[a-zA-Z0-9-]{8,80}$/),
  documentId: z.number().int().positive(),
  occurredAt: z.number().int().nonnegative(),
  minutes: z.number().int().min(1).max(240),
  kind: z.enum(["reading", "flashcards", "quiz"]),
  cardIds: z.array(z.number().int().positive()).max(500).optional(),
  quizId: z.number().int().positive().optional(),
  answers: z.record(z.string().max(40), z.string().max(2000)).optional(),
});
export type OfflineStudyEvent = z.infer<typeof offlineStudyEventSchema>;
export type OfflineStudyPack = {
  version: 1;
  ownerId: number;
  savedAt: number;
  document: { id: number; title: string; fileName: string };
  html: string;
  cards: Array<{ id: number; question: string; answer: string }>;
  quizzes: Array<{ id: number; title: string; questions: Array<{ id: number; question: string; options: string[]; correctAnswer: string; explanation: string | null }> }>;
};

export function gradeOfflineQuiz(questions: OfflineStudyPack["quizzes"][number]["questions"], answers: Record<string, string>): number {
  if (!questions.length) return 0;
  return Math.round(100 * questions.filter(question => answers[String(question.id)] === question.correctAnswer).length / questions.length);
}

/** Acknowledgement only removes delivered events; newly queued events survive a sync. */
export function acknowledgeOfflineEvents(events: OfflineStudyEvent[], accepted: string[]): OfflineStudyEvent[] {
  const ids = new Set(accepted);
  return events.filter(event => !ids.has(event.eventId));
}
