import { getDb } from "../db";
import { agentSessions, agentToolRuns } from "../../drizzle/schema";
import { desc, eq } from "drizzle-orm";

export async function upsertAgentSession(input: {
  userId: number;
  documentId?: number;
  courseId?: number;
  intent: string;
  learningGoal?: string;
}): Promise<number | undefined> {
  try {
    const db = await getDb();
    if (!db) return undefined;
    const existing = await db
      .select()
      .from(agentSessions)
      .where(eq(agentSessions.userId, input.userId))
      .orderBy(desc(agentSessions.updatedAt))
      .limit(1);
    const row = existing[0];
    const sameContext =
      row &&
      row.documentId === (input.documentId ?? null) &&
      row.courseId === (input.courseId ?? null);
    if (sameContext && row) {
      await db
        .update(agentSessions)
        .set({ intent: input.intent, learningGoal: input.learningGoal ?? row.learningGoal, updatedAt: new Date() })
        .where(eq(agentSessions.id, row.id));
      return row.id;
    }
    const inserted = await db
      .insert(agentSessions)
      .values({
        userId: input.userId,
        documentId: input.documentId,
        courseId: input.courseId,
        intent: input.intent,
        learningGoal: input.learningGoal,
      })
      .returning();
    return inserted[0]?.id;
  } catch (error) {
    console.warn("[agent] session persist skipped:", error);
    return undefined;
  }
}

export async function logAgentToolRun(input: {
  sessionId?: number;
  requestId: string;
  userId: number;
  toolName: string;
  workflow?: string;
  provider?: string;
  success: boolean;
  durationMs: number;
  retrievalCount?: number;
  error?: string;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(agentToolRuns).values({
      sessionId: input.sessionId,
      requestId: input.requestId,
      userId: input.userId,
      toolName: input.toolName,
      workflow: input.workflow,
      provider: input.provider,
      success: input.success,
      durationMs: input.durationMs,
      retrievalCount: input.retrievalCount,
      error: input.error?.slice(0, 300),
    });
  } catch (error) {
    console.warn("[agent] tool-run log skipped:", error);
  }
}
