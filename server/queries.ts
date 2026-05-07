import { eq, and, desc, like, sql } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { vectorStorePath } from "./rag/faissFlat";
import {
  users,
  documents,
  chatMessages,
  documentSummaries,
  flashcards,
  quizzes,
  quizQuestions,
  progressTracking,
  studySessions,
  User,
  Document,
  ChatMessage,
  DocumentSummary,
  Flashcard,
  Quiz,
  QuizQuestion,
  ProgressTracking,
  StudySession,
  InsertUser,
  InsertDocument,
  InsertChatMessage,
  InsertDocumentSummary,
  InsertFlashcard,
  InsertQuiz,
  InsertQuizQuestion,
  InsertProgressTracking,
  InsertStudySession,
} from "../drizzle/schema";
import { getDb } from "./db";

// ============ DOCUMENTS ============

export async function createDocument(data: InsertDocument): Promise<Document> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(documents).values(data).returning();
  if (!result[0]) throw new Error("Failed to create document");
  return result[0];
}

export async function getDocumentById(id: number): Promise<Document | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return result[0];
}

export async function getUserDocuments(userId: number): Promise<Document[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(documents)
    .where(sql`${documents.userId} = ${userId} OR ${documents.isPublic} = true`)
    .orderBy(desc(documents.createdAt));
}

export async function listPublicDocuments(): Promise<Document[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(documents)
    .where(eq(documents.isPublic, true))
    .orderBy(desc(documents.createdAt));
}

export async function deleteDocument(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const doc = await getDocumentById(id);
  if (!doc) return;

  // 1. Delete database row
  await db.delete(documents).where(eq(documents.id, id));

  // 2. Delete physical file if it exists in local storage
  if (doc.fileUrl.startsWith("/uploads/")) {
    try {
      const relativePath = doc.fileUrl.replace("/uploads/", "");
      const fullPath = path.resolve(process.cwd(), "data", "uploads", relativePath);
      await fs.unlink(fullPath);
    } catch (err) {
      console.warn(`Failed to delete physical file for doc ${id}:`, err);
    }
  }

  // 3. Delete vector store file
  try {
    const vPath = vectorStorePath(id);
    await fs.unlink(vPath);
  } catch (err) {
    // Ignore if file doesn't exist
  }
}

export async function searchUserDocuments(userId: number, query: string): Promise<Document[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(documents)
    .where(and(eq(documents.userId, userId), like(documents.title, `%${query}%`)))
    .orderBy(desc(documents.createdAt));
}

export async function updateDocument(id: number, data: Partial<Document>): Promise<Document | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  await db.update(documents).set(data).where(eq(documents.id, id));
  return getDocumentById(id);
}

export async function toggleDocumentFavorite(id: number): Promise<Document | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const doc = await getDocumentById(id);
  if (!doc) return undefined;

  return updateDocument(id, { isFavorite: !doc.isFavorite });
}

export async function getUserFavoriteDocuments(userId: number): Promise<Document[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(documents)
    .where(and(eq(documents.userId, userId), eq(documents.isFavorite, true)))
    .orderBy(desc(documents.createdAt));
}

// ============ CHAT MESSAGES ============

export async function createChatMessage(data: InsertChatMessage): Promise<ChatMessage> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(chatMessages).values(data);
  
  // Get the last inserted message
  const msgs = await db.select().from(chatMessages).orderBy(desc(chatMessages.id)).limit(1);
  if (!msgs[0]) throw new Error("Failed to create chat message");
  return msgs[0];
}

export async function getDocumentChatHistory(
  documentId: number,
  limit: number = 50
): Promise<ChatMessage[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.documentId, documentId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
}

// ============ DOCUMENT SUMMARIES ============

export async function createDocumentSummary(data: InsertDocumentSummary): Promise<DocumentSummary> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(documentSummaries).values(data);
  
  // Get the last inserted summary
  const summaries = await db.select().from(documentSummaries).orderBy(desc(documentSummaries.id)).limit(1);
  if (!summaries[0]) throw new Error("Failed to create summary");
  return summaries[0];
}

/**
 * Replace any existing summary row for this document (one summary per doc for AI regeneration).
 */
export async function replaceDocumentSummary(data: InsertDocumentSummary): Promise<DocumentSummary> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");

  await database.delete(documentSummaries).where(eq(documentSummaries.documentId, data.documentId));
  const now = new Date();
  await database.insert(documentSummaries).values({
    ...data,
    createdAt: data.createdAt ?? now,
    updatedAt: now,
  });
  const row = await database
    .select()
    .from(documentSummaries)
    .where(eq(documentSummaries.documentId, data.documentId))
    .orderBy(desc(documentSummaries.id))
    .limit(1);
  if (!row[0]) throw new Error("Failed to save summary");
  return row[0];
}

export async function getDocumentSummary(documentId: number): Promise<DocumentSummary | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(documentSummaries)
    .where(eq(documentSummaries.documentId, documentId))
    .orderBy(desc(documentSummaries.id))
    .limit(1);
  return result[0];
}

// ============ FLASHCARDS ============

export async function createFlashcard(data: InsertFlashcard): Promise<Flashcard> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(flashcards).values(data);
  
  // Get the last inserted flashcard
  const cards = await db.select().from(flashcards).orderBy(desc(flashcards.id)).limit(1);
  if (!cards[0]) throw new Error("Failed to create flashcard");
  return cards[0];
}

export async function getDocumentFlashcards(documentId: number): Promise<Flashcard[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(flashcards)
    .where(eq(flashcards.documentId, documentId))
    .orderBy(desc(flashcards.createdAt));
}

export async function toggleFlashcardFavorite(id: number): Promise<Flashcard | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const card = await db.select().from(flashcards).where(eq(flashcards.id, id)).limit(1);
  if (!card[0]) return undefined;

  const updated = !card[0].isFavorite;
  await db.update(flashcards).set({ isFavorite: updated }).where(eq(flashcards.id, id));

  return db.select().from(flashcards).where(eq(flashcards.id, id)).limit(1).then((r) => r[0]);
}

export async function updateFlashcardReview(id: number): Promise<Flashcard | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const card = await db.select().from(flashcards).where(eq(flashcards.id, id)).limit(1);
  if (!card[0]) return undefined;

  await db
    .update(flashcards)
    .set({
      reviewCount: (card[0].reviewCount || 0) + 1,
      lastReviewedAt: new Date(),
    })
    .where(eq(flashcards.id, id));

  return db.select().from(flashcards).where(eq(flashcards.id, id)).limit(1).then((r) => r[0]);
}

export async function getUserFavoriteFlashcards(userId: number): Promise<Flashcard[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(flashcards)
    .where(and(eq(flashcards.userId, userId), eq(flashcards.isFavorite, true)))
    .orderBy(desc(flashcards.createdAt));
}

// ============ QUIZZES ============

export async function createQuiz(data: InsertQuiz): Promise<Quiz> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(quizzes).values(data);
  
  // Get the last inserted quiz
  const quizList = await db.select().from(quizzes).orderBy(desc(quizzes.id)).limit(1);
  if (!quizList[0]) throw new Error("Failed to create quiz");
  return quizList[0];
}

export async function getDocumentQuizzes(documentId: number): Promise<Quiz[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(quizzes)
    .where(eq(quizzes.documentId, documentId))
    .orderBy(desc(quizzes.createdAt));
}

export async function getQuizById(quizId: number): Promise<Quiz | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  return result[0];
}

export async function updateQuizScore(
  quizId: number,
  score: number,
  completedAt: Date
): Promise<Quiz | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  await db
    .update(quizzes)
    .set({ score: score.toString(), completedAt })
    .where(eq(quizzes.id, quizId));

  return db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1).then((r) => r[0]);
}

// ============ QUIZ QUESTIONS ============

export async function createQuizQuestion(data: InsertQuizQuestion): Promise<QuizQuestion> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(quizQuestions).values(data);
  
  // Get the last inserted question
  const questions = await db.select().from(quizQuestions).orderBy(desc(quizQuestions.id)).limit(1);
  if (!questions[0]) throw new Error("Failed to create quiz question");
  return questions[0];
}

export async function getQuizQuestions(quizId: number): Promise<QuizQuestion[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(quizQuestions).where(eq(quizQuestions.quizId, quizId));
}

export async function updateQuizQuestionAnswer(
  questionId: number,
  userAnswer: string,
  isCorrect: boolean
): Promise<QuizQuestion | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  await db
    .update(quizQuestions)
    .set({ userAnswer, isCorrect })
    .where(eq(quizQuestions.id, questionId));

  return db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.id, questionId))
    .limit(1)
    .then((r) => r[0]);
}

// ============ PROGRESS TRACKING ============

export async function getOrCreateProgress(
  documentId: number,
  userId: number
): Promise<ProgressTracking> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(progressTracking)
    .where(and(eq(progressTracking.documentId, documentId), eq(progressTracking.userId, userId)))
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  await db.insert(progressTracking).values({
    documentId,
    userId,
  });

  // Get the newly created progress by querying with the same document and user
  const progresses = await db
    .select()
    .from(progressTracking)
    .where(and(eq(progressTracking.documentId, documentId), eq(progressTracking.userId, userId)))
    .limit(1);
  if (!progresses[0]) throw new Error("Failed to create progress tracking");
  return progresses[0];
}

export async function updateProgressActivity(
  documentId: number,
  userId: number,
  updates: Partial<ProgressTracking>
): Promise<ProgressTracking> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const progress = await getOrCreateProgress(documentId, userId);

  // Calculate streak updates
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const lastStudyDate = progress.lastStudyDate ? new Date(progress.lastStudyDate).toISOString().split('T')[0] : null;

  let streakUpdates: Partial<ProgressTracking> = {};

  if (lastStudyDate !== todayStr) {
    // New study day
    if (lastStudyDate) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (lastStudyDate === yesterdayStr) {
        // Consecutive day - increment streak
        const newStreak = (progress.currentStreak || 0) + 1;
        streakUpdates = {
          currentStreak: newStreak,
          longestStreak: Math.max(progress.longestStreak || 0, newStreak),
        };
      } else {
        // Streak broken - reset to 1
        streakUpdates = {
          currentStreak: 1,
          longestStreak: Math.max(progress.longestStreak || 0, 1),
        };
      }
    } else {
      // First study day
      streakUpdates = {
        currentStreak: 1,
        longestStreak: 1,
      };
    }
  }

  await db
    .update(progressTracking)
    .set({
      ...updates,
      ...streakUpdates,
      lastStudyDate: today,
      lastActivityAt: new Date(),
    })
    .where(eq(progressTracking.id, progress.id));

  return db
    .select()
    .from(progressTracking)
    .where(eq(progressTracking.id, progress.id))
    .limit(1)
    .then((r) => r[0]!);
}

export async function getUserProgress(userId: number): Promise<ProgressTracking[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(progressTracking)
    .where(eq(progressTracking.userId, userId))
    .orderBy(desc(progressTracking.lastActivityAt));
}

// ============ STUDY SESSIONS ============

export async function createStudySession(data: InsertStudySession): Promise<StudySession> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(studySessions).values(data);
  
  const sessions = await db
    .select()
    .from(studySessions)
    .orderBy(desc(studySessions.id))
    .limit(1);
  
  if (!sessions[0]) throw new Error("Failed to create study session");
  return sessions[0];
}

export async function updateStudySession(id: number, endTime: Date, durationMinutes: number): Promise<StudySession | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  await db
    .update(studySessions)
    .set({ endTime, durationMinutes })
    .where(eq(studySessions.id, id));

  const sessions = await db
    .select()
    .from(studySessions)
    .where(eq(studySessions.id, id))
    .limit(1);

  return sessions[0];
}

export async function getUserStudySessions(userId: number, limit = 50): Promise<StudySession[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(studySessions)
    .where(eq(studySessions.userId, userId))
    .orderBy(desc(studySessions.createdAt))
    .limit(limit);
}

export async function getTotalStudyTime(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .select({ total: sql<number>`cast(sum(coalesce(${studySessions.durationMinutes}, 0)) as integer)` })
    .from(studySessions)
    .where(eq(studySessions.userId, userId));

  return result[0]?.total || 0;
}

// ============ ANALYTICS ============

export async function getSubjectPerformance(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      subject: documents.subject,
      avgScore: sql<number>`avg(${progressTracking.averageQuizScore})`,
      totalQuizzes: sql<number>`sum(${progressTracking.quizzesAttempted})`,
      totalFlashcards: sql<number>`sum(${progressTracking.flashcardsReviewed})`,
      documentCount: sql<number>`count(distinct ${documents.id})`,
    })
    .from(progressTracking)
    .innerJoin(documents, eq(progressTracking.documentId, documents.id))
    .where(and(eq(progressTracking.userId, userId), sql`${documents.subject} IS NOT NULL`))
    .groupBy(documents.subject)
    .orderBy(sql`avg(${progressTracking.averageQuizScore}) DESC`);
}

export async function getWeeklyStudyData(userId: number) {
  const db = await getDb();
  if (!db) return [];

  // Get data for the last 12 weeks
  const twelveWeeksAgo = new Date();
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

  return db
    .select({
      week: sql<string>`strftime('%Y-%W', ${studySessions.createdAt})`,
      totalMinutes: sql<number>`sum(${studySessions.durationMinutes})`,
      sessionsCount: sql<number>`count(${studySessions.id})`,
      quizAttempts: sql<number>`sum(case when ${studySessions.activityType} = 'quiz' then 1 else 0 end)`,
      flashcardReviews: sql<number>`sum(case when ${studySessions.activityType} = 'flashcard' then 1 else 0 end)`,
    })
    .from(studySessions)
    .where(and(
      eq(studySessions.userId, userId),
      sql`${studySessions.createdAt} >= ${twelveWeeksAgo}`
    ))
    .groupBy(sql`strftime('%Y-%W', ${studySessions.createdAt})`)
    .orderBy(sql`strftime('%Y-%W', ${studySessions.createdAt})`);
}

export async function getMonthlyStudyData(userId: number) {
  const db = await getDb();
  if (!db) return [];

  // Get data for the last 12 months
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  return db
    .select({
      month: sql<string>`strftime('%Y-%m', ${studySessions.createdAt})`,
      totalMinutes: sql<number>`sum(${studySessions.durationMinutes})`,
      sessionsCount: sql<number>`count(${studySessions.id})`,
    })
    .from(studySessions)
    .where(and(
      eq(studySessions.userId, userId),
      sql`${studySessions.createdAt} >= ${twelveMonthsAgo}`
    ))
    .groupBy(sql`strftime('%Y-%m', ${studySessions.createdAt})`)
    .orderBy(sql`strftime('%Y-%m', ${studySessions.createdAt})`);
}

export async function getCurrentStudyStreak(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  // Get all study dates for the user in the last 60 days
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const studyDates = await db
    .select({
      date: sql<string>`date(${studySessions.createdAt})`,
    })
    .from(studySessions)
    .where(and(
      eq(studySessions.userId, userId),
      sql`${studySessions.createdAt} >= ${sixtyDaysAgo}`
    ))
    .groupBy(sql`date(${studySessions.createdAt})`)
    .orderBy(desc(sql`date(${studySessions.createdAt})`));

  if (studyDates.length === 0) return 0;

  const uniqueDates = [...new Set(studyDates.map(d => d.date))];
  let streak = 0;
  const today = new Date().toISOString().split('T')[0];

  // Check if studied today
  if (!uniqueDates.includes(today)) {
    return 0; // No streak if didn't study today
  }

  // Count consecutive days
  for (let i = 0; i < uniqueDates.length; i++) {
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() - i);
    const expectedDateStr = expectedDate.toISOString().split('T')[0];

    if (uniqueDates.includes(expectedDateStr)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export async function getRecommendedRevision(userId: number) {
  const db = await getDb();
  if (!db) return [];

  // Get documents with low performance (score < 70%) or not studied recently
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return db
    .select({
      documentId: documents.id,
      title: documents.title,
      subject: documents.subject,
      avgScore: progressTracking.averageQuizScore,
      lastActivity: progressTracking.lastActivityAt,
      quizzesAttempted: progressTracking.quizzesAttempted,
    })
    .from(progressTracking)
    .innerJoin(documents, eq(progressTracking.documentId, documents.id))
    .where(and(
      eq(progressTracking.userId, userId),
      sql`(${progressTracking.averageQuizScore} < 70 OR ${progressTracking.lastActivityAt} < ${thirtyDaysAgo})`
    ))
    .orderBy(sql`${progressTracking.averageQuizScore} ASC, ${progressTracking.lastActivityAt} ASC`)
    .limit(10);
}

export async function createOrUpdateSummary(
  documentId: number,
  summary: string,
  keyPoints: string[]
): Promise<DocumentSummary> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(documentSummaries)
    .where(eq(documentSummaries.documentId, documentId))
    .limit(1);

  if (existing[0]) {
    await db
      .update(documentSummaries)
      .set({ summary, keyPoints, updatedAt: new Date() })
      .where(eq(documentSummaries.documentId, documentId));
    return existing[0];
  }

  return createDocumentSummary({ documentId, summary, keyPoints });
}
// ============ ADMIN / USERS ============

export async function deleteUser(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Cleanup user data - most will be handled by cascade if set up, 
  // but for SQLite with drizzle we often do it manually or via schema
  await Promise.all([
    db.delete(users).where(eq(users.id, userId)),
    db.delete(documents).where(eq(documents.userId, userId)),
    db.delete(flashcards).where(eq(flashcards.userId, userId)),
    db.delete(quizzes).where(eq(quizzes.userId, userId)),
    db.delete(progressTracking).where(eq(progressTracking.userId, userId)),
    db.delete(studySessions).where(eq(studySessions.userId, userId)),
  ]);
}

export async function toggleUserBan(userId: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1).then(r => r[0]);
  if (!user) return undefined;

  await db.update(users).set({ isBanned: !user.isBanned }).where(eq(users.id, userId));
  return db.select().from(users).where(eq(users.id, userId)).limit(1).then(r => r[0]);
}
