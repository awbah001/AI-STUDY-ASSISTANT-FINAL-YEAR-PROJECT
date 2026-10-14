import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { offlineStudyEvents, progressTracking, studySessions, studentActivities } from "../drizzle/schema";
import { getDb } from "./db";
import * as queries from "./queries";
import { canAccessDocument } from "./documentAccess";
import { ensureDocumentText } from "./documentAiService";
import { createDocumentPreview, previewHtml } from "./documentPreview";
import { documentPreviewKind } from "../shared/documentPreview";
import { gradeOfflineQuiz, type OfflineStudyEvent, type OfflineStudyPack } from "../shared/offlineStudy";

async function accessibleDocument(userId: number, id: number) {
  const doc = await queries.getDocumentById(id);
  if (!doc || !await canAccessDocument(userId, doc)) throw new TRPCError({ code: "FORBIDDEN", message: "You no longer have access to this document." });
  return doc;
}

export async function buildOfflineStudyPack(userId: number, documentId: number): Promise<OfflineStudyPack> {
  let doc = await accessibleDocument(userId, documentId);
  let html: string;
  if (documentPreviewKind(doc) === "pdf") {
    doc = await ensureDocumentText(doc.id);
    const text = (doc.extractedText ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
    html = previewHtml(doc.title, `<header>Downloaded text of ${doc.fileName.replace(/[&<>]/g, "")}</header><pre>${text}</pre>`);
  } else {
    const preview = await createDocumentPreview(doc);
    if (!preview.html) throw new TRPCError({ code: "BAD_REQUEST", message: "Offline study currently supports documents with readable text. Download the original image separately." });
    html = preview.html;
  }
  const [cards, quizzes] = await Promise.all([queries.getDocumentFlashcards(documentId, userId), queries.getDocumentQuizzes(documentId, userId)]);
  const savedQuizzes = await Promise.all(quizzes.map(async quiz => ({
    id: quiz.id, title: quiz.title,
    questions: (await queries.getQuizQuestions(quiz.id)).map(q => ({ id: q.id, question: q.question, options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation })),
  })));
  return { version: 1, ownerId: userId, savedAt: Date.now(), document: { id: doc.id, title: doc.title, fileName: doc.fileName }, html, cards: cards.map(c => ({ id: c.id, question: c.question, answer: c.answer })), quizzes: savedQuizzes };
}

/** Receipt and progress commit together, so retrying an interrupted sync cannot double count. */
export async function syncOfflineStudyEvent(userId: number, event: OfflineStudyEvent): Promise<void> {
  const doc = await accessibleDocument(userId, event.documentId);
  if (event.occurredAt > Date.now() + 5 * 60_000) throw new TRPCError({ code: "BAD_REQUEST", message: "The study session is dated in the future. Check your device clock." });
  let score: number | undefined;
  let reviewed = 0;
  if (event.kind === "quiz") {
    const quiz = event.quizId ? await queries.getQuizById(event.quizId) : undefined;
    const allowed = await queries.getDocumentQuizzes(doc.id, userId);
    if (!quiz || quiz.documentId !== doc.id || !allowed.some(q => q.id === quiz.id)) throw new TRPCError({ code: "FORBIDDEN", message: "This practice quiz is no longer available." });
    const questions = await queries.getQuizQuestions(quiz.id);
    if (!questions.length) throw new TRPCError({ code: "BAD_REQUEST", message: "This quiz has no questions." });
    score = gradeOfflineQuiz(questions, event.answers ?? {});
  } else if (event.kind === "flashcards") {
    const available = new Set((await queries.getDocumentFlashcards(doc.id, userId)).map(card => card.id));
    const ids = [...new Set(event.cardIds ?? [])];
    if (!ids.length || ids.some(id => !available.has(id))) throw new TRPCError({ code: "BAD_REQUEST", message: "Some reviewed flashcards are no longer available." });
    reviewed = ids.length;
  }
  await queries.getOrCreateProgress(doc.id, userId);
  const database = await getDb();
  if (!database) throw new Error("Database unavailable.");
  await database.transaction(async tx => {
    const receipt = await tx.insert(offlineStudyEvents).values({ userId, eventId: event.eventId, syncedAt: new Date() }).onConflictDoNothing().returning();
    if (!receipt.length) return;
    const [progress] = await tx.select().from(progressTracking).where(and(eq(progressTracking.userId, userId), eq(progressTracking.documentId, doc.id))).limit(1);
    if (!progress) throw new Error("Progress unavailable.");
    const now = new Date();
    const end = new Date(event.occurredAt);
    const newQuizCount = progress.quizzesAttempted + (score === undefined ? 0 : 1);
    const day = Math.floor(event.occurredAt / 86_400_000);
    const previousDay = progress.lastStudyDate ? Math.floor(progress.lastStudyDate.getTime() / 86_400_000) : -1;
    const streak = day > previousDay ? (day === previousDay + 1 ? progress.currentStreak + 1 : 1) : progress.currentStreak;
    await tx.update(progressTracking).set({
      totalStudyTimeMinutes: progress.totalStudyTimeMinutes + event.minutes,
      flashcardsReviewed: progress.flashcardsReviewed + reviewed,
      quizzesAttempted: newQuizCount,
      averageQuizScore: score === undefined ? progress.averageQuizScore : ((progress.averageQuizScore ?? 0) * progress.quizzesAttempted + score) / newQuizCount,
      currentStreak: streak, longestStreak: Math.max(progress.longestStreak, streak),
      lastStudyDate: day >= previousDay ? end : progress.lastStudyDate,
      lastActivityAt: now, updatedAt: now,
    }).where(eq(progressTracking.id, progress.id));
    await tx.insert(studySessions).values({ userId, documentId: doc.id, activityType: event.kind === "flashcards" ? "flashcard" : event.kind, startTime: new Date(event.occurredAt - event.minutes * 60_000), endTime: end, durationMinutes: event.minutes, createdAt: now });
    await tx.insert(studentActivities).values({ userId, documentId: doc.id, courseId: doc.courseId, type: event.kind === "quiz" ? "QUIZ_COMPLETED" : event.kind === "flashcards" ? "FLASHCARD_SESSION_COMPLETED" : "STUDY_SESSION_COMPLETED", metadata: { offline: true, eventId: event.eventId, ...(score === undefined ? {} : { score, quizId: event.quizId }) }, createdAt: end });
  });
}
