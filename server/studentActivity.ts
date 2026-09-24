import { studentActivities, studentProfiles } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { getDb } from "./db";

export const ACTIVITY_TYPES = [
  "LOGIN",
  "COURSE_OPENED",
  "DOCUMENT_OPENED",
  "AI_QUESTION_ASKED",
  "FLASHCARD_SESSION_COMPLETED",
  "QUIZ_COMPLETED",
  "ASSIGNMENT_OPENED",
  "ASSIGNMENT_SUBMITTED",
  "STUDY_SESSION_COMPLETED",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export async function recordStudentActivity(input: {
  userId: number;
  type: ActivityType;
  courseId?: number | null;
  documentId?: number | null;
  metadata?: Record<string, unknown>;
}) {
  const dbConn = await getDb();
  if (!dbConn) return;
  await dbConn.insert(studentActivities).values({
    userId: input.userId,
    type: input.type,
    courseId: input.courseId ?? null,
    documentId: input.documentId ?? null,
    metadata: input.metadata ?? null,
  });
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.courseId) patch.lastCourseId = input.courseId;
  if (input.documentId) patch.lastDocumentId = input.documentId;
  if (input.type === "QUIZ_COMPLETED" && typeof input.metadata?.quizId === "number") {
    patch.lastQuizId = input.metadata.quizId;
  }
  const existing = await dbConn.select({ userId: studentProfiles.userId }).from(studentProfiles).where(eq(studentProfiles.userId, input.userId)).limit(1);
  if (existing[0]) {
    await dbConn.update(studentProfiles).set(patch).where(eq(studentProfiles.userId, input.userId));
  }
}
