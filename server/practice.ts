import { TRPCError } from "@trpc/server";
import { and, eq, gte, inArray } from "drizzle-orm";
import { calendarEvents, flashcards, quizQuestions, quizzes } from "../drizzle/schema";
import { getDb } from "./db";
import { canAccessDocument } from "./documentAccess";
import * as queries from "./queries";
import { examMistakes, markExamPracticeCreated } from "./mockExams";
import { shuffled } from "./examMarking";

const MAX_CARDS = 20;
const MAX_RETRY_QUIZZES = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export type Mistake = {
  documentId: number;
  question: string;
  correctAnswer: string;
  explanation?: string | null;
  keyPoints?: string[] | null;
  /** Present for multiple-choice questions, which can be retried as a quiz. */
  options?: string[] | null;
};

export type PracticeResult = {
  mistakes: number;
  flashcardsCreated: number;
  retryQuizzes: Array<{ id: number; documentId: number; title: string; questions: number }>;
  reviewAt: number | null;
  requizAt: number | null;
  alreadyCreated?: boolean;
};

function normalizeQuestion(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function flashcardAnswer(m: Mistake): string {
  const parts = [m.correctAnswer.trim()];
  if (m.keyPoints?.length && !(m.keyPoints.length === 1 && m.keyPoints[0] === m.correctAnswer)) {
    parts.push(`Key points: ${m.keyPoints.join("; ")}`);
  }
  if (m.explanation?.trim() && m.explanation.trim() !== "See the document for details.") {
    parts.push(m.explanation.trim());
  }
  return parts.join("\n\n").slice(0, 2000);
}

/** Next evening at 18:00 server time, at least 6 hours away. */
export function defaultReviewTime(now = Date.now()): number {
  const date = new Date(now + DAY_MS);
  date.setHours(18, 0, 0, 0);
  return Math.max(date.getTime(), now + 6 * 60 * 60 * 1000);
}

async function buildPractice(
  userId: number,
  mistakes: Mistake[],
  opts: { label: string; courseId?: number | null; reviewAt?: number }
): Promise<PracticeResult> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available." });
  const now = new Date();
  const docIds = Array.from(new Set(mistakes.map((m) => m.documentId)));

  const existing = docIds.length
    ? await db
        .select({ question: flashcards.question })
        .from(flashcards)
        .where(and(eq(flashcards.userId, userId), inArray(flashcards.documentId, docIds)))
    : [];
  const seen = new Set(existing.map((row) => normalizeQuestion(row.question)));
  let flashcardsCreated = 0;
  for (const m of mistakes) {
    if (flashcardsCreated >= MAX_CARDS) break;
    const key = normalizeQuestion(m.question);
    if (seen.has(key)) continue;
    seen.add(key);
    await db.insert(flashcards).values({
      documentId: m.documentId,
      userId,
      question: m.question.slice(0, 1000),
      answer: flashcardAnswer(m),
      dueDate: null,
      createdAt: now,
      updatedAt: now,
    });
    flashcardsCreated++;
  }

  const retryQuizzes: PracticeResult["retryQuizzes"] = [];
  const byDoc = new Map<number, Mistake[]>();
  for (const m of mistakes) {
    if (!m.options || m.options.length < 2) continue;
    byDoc.set(m.documentId, [...(byDoc.get(m.documentId) ?? []), m]);
  }
  const busiest = Array.from(byDoc.entries()).sort((a, b) => b[1].length - a[1].length).slice(0, MAX_RETRY_QUIZZES);
  const recentCutoff = new Date(now.getTime() - 10 * 60 * 1000);
  for (const [documentId, items] of busiest) {
    const doc = await queries.getDocumentById(documentId);
    const title = `Retry: ${doc?.title ?? "your mistakes"}`.slice(0, 200);
    const [duplicate] = await db
      .select({ id: quizzes.id })
      .from(quizzes)
      .where(and(eq(quizzes.userId, userId), eq(quizzes.documentId, documentId), eq(quizzes.title, title), gte(quizzes.createdAt, recentCutoff)))
      .limit(1);
    if (duplicate) continue;
    const [quiz] = await db
      .insert(quizzes)
      .values({ documentId, userId, title, totalQuestions: items.length, createdAt: now })
      .returning();
    await db.insert(quizQuestions).values(
      shuffled(items).map((m) => ({
        quizId: quiz.id,
        question: m.question,
        options: shuffled(m.options ?? []),
        correctAnswer: m.correctAnswer,
        explanation: m.explanation ?? null,
      }))
    );
    retryQuizzes.push({ id: quiz.id, documentId, title, questions: items.length });
  }

  const reviewAt = opts.reviewAt && opts.reviewAt > now.getTime() ? opts.reviewAt : defaultReviewTime(now.getTime());
  const requizAt = reviewAt + 2 * DAY_MS;
  const label = opts.label.slice(0, 120);
  await db.insert(calendarEvents).values([
    {
      userId,
      title: `Review mistakes: ${label}`.slice(0, 160),
      type: "study",
      startsAt: new Date(reviewAt),
      notes: `${flashcardsCreated || "No new"} flashcard${flashcardsCreated === 1 ? "" : "s"} from your mistakes are waiting in your review queue.`,
      courseId: opts.courseId ?? null,
      reminderMinutes: 60,
      source: "user",
      createdAt: now,
      updatedAt: now,
    },
    {
      userId,
      title: `Re-quiz: ${label}`.slice(0, 160),
      type: "quiz",
      startsAt: new Date(requizAt),
      notes: retryQuizzes.length
        ? `Take ${retryQuizzes.map((q) => `"${q.title}"`).join(", ")} to check the gaps are closed.`
        : "Try the questions you missed again to check the gaps are closed.",
      courseId: opts.courseId ?? null,
      reminderMinutes: 60,
      source: "user",
      createdAt: now,
      updatedAt: now,
    },
  ]);

  return { mistakes: mistakes.length, flashcardsCreated, retryQuizzes, reviewAt, requizAt };
}

const EMPTY: PracticeResult = { mistakes: 0, flashcardsCreated: 0, retryQuizzes: [], reviewAt: null, requizAt: null };

export async function practiceFromQuiz(
  userId: number,
  input: { quizId: number; answers?: Record<string, string>; reviewAt?: number }
): Promise<PracticeResult> {
  const quiz = await queries.getQuizById(input.quizId);
  const doc = quiz ? await queries.getDocumentById(quiz.documentId) : undefined;
  if (!quiz || !doc || !(await canAccessDocument(userId, doc))) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Quiz not found." });
  }
  const questions = await queries.getQuizQuestions(input.quizId);
  const answerFor = (q: (typeof questions)[number]) =>
    input.answers?.[String(q.id)] ?? (quiz.userId === userId ? q.userAnswer ?? undefined : undefined);
  const mistakes: Mistake[] = questions
    .filter((q) => answerFor(q) !== q.correctAnswer)
    .map((q) => ({
      documentId: quiz.documentId,
      question: q.question,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      options: q.options,
    }));
  if (!mistakes.length) return EMPTY;
  return buildPractice(userId, mistakes, { label: doc.title, courseId: doc.courseId, reviewAt: input.reviewAt });
}

export async function practiceFromExam(
  userId: number,
  input: { examId: number; reviewAt?: number }
): Promise<PracticeResult> {
  const { exam, mistakes: missed } = await examMistakes(userId, input.examId);
  if (exam.practiceCreatedAt) return { ...EMPTY, mistakes: missed.length, alreadyCreated: true };
  const mistakes: Mistake[] = missed
    .filter((q): q is typeof q & { documentId: number } => q.documentId !== null)
    .map((q) => ({
      documentId: q.documentId,
      question: q.question,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      keyPoints: q.keyPoints,
      options: q.type === "mcq" ? q.options : null,
    }));
  if (!mistakes.length) return EMPTY;
  const result = await buildPractice(userId, mistakes, {
    label: exam.title.replace(/ mock exam$/, ""),
    courseId: exam.courseId,
    reviewAt: input.reviewAt,
  });
  await markExamPracticeCreated(exam.id);
  return result;
}
