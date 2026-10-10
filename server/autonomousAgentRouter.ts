import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { adminAuditLogs, autonomousAgentRuns, userPreferences, users } from "../drizzle/schema";
import { adminProcedure, router } from "./_core/trpc";
import {
  STUDENT_OPT_OUT_KEY,
  getAutonomousSweepStatus,
  normalizeAutonomousSettings,
  runAutonomousAgentForStudent,
  runAutonomousSweep,
} from "./agent/autonomous";
import { getDb } from "./db";
import { getSystemSettings, userHasPermission } from "./settings";

async function assertAiAdmin(user: Parameters<typeof userHasPermission>[0]) {
  if (!(await userHasPermission(user, "ai.configure"))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to manage the AI agent." });
  }
}

async function audit(adminId: number, action: string, targetId: number, metadata?: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  await db.insert(adminAuditLogs).values({
    adminId,
    action,
    targetType: "autonomous_agent",
    targetId,
    metadata: metadata ?? null,
  });
}

export const autonomousAgentRouter = router({
  overview: adminProcedure.query(async ({ ctx }) => {
    await assertAiAdmin(ctx.user);
    const settings = normalizeAutonomousSettings((await getSystemSettings()).autonomousAgent);
    const db = await getDb();
    const status = getAutonomousSweepStatus();
    if (!db) return { settings, status, stats: null, runs: [] };

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekRuns = await db
      .select({ status: autonomousAgentRuns.status, actions: autonomousAgentRuns.actions, userId: autonomousAgentRuns.userId })
      .from(autonomousAgentRuns)
      .where(gte(autonomousAgentRuns.createdAt, since));
    let notifications = 0;
    let materials = 0;
    for (const run of weekRuns) {
      for (const action of run.actions ?? []) {
        if (!action.ok) continue;
        if (action.type === "notification") notifications += 1;
        else materials += 1;
      }
    }

    const prefs = await db.select({ notifications: userPreferences.notifications }).from(userPreferences);
    const optedOut = prefs.filter((p) => p.notifications?.[STUDENT_OPT_OUT_KEY] === false).length;
    const [studentCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(eq(users.role, "user"), eq(users.isBanned, false)));

    const runs = await db
      .select({
        id: autonomousAgentRuns.id,
        userId: autonomousAgentRuns.userId,
        userName: users.name,
        userEmail: users.email,
        status: autonomousAgentRuns.status,
        trigger: autonomousAgentRuns.trigger,
        signals: autonomousAgentRuns.signals,
        actions: autonomousAgentRuns.actions,
        summary: autonomousAgentRuns.summary,
        error: autonomousAgentRuns.error,
        usedLlm: autonomousAgentRuns.usedLlm,
        durationMs: autonomousAgentRuns.durationMs,
        createdAt: autonomousAgentRuns.createdAt,
      })
      .from(autonomousAgentRuns)
      .leftJoin(users, eq(users.id, autonomousAgentRuns.userId))
      .orderBy(desc(autonomousAgentRuns.createdAt))
      .limit(60);

    return {
      settings,
      status,
      stats: {
        runsThisWeek: weekRuns.length,
        actedThisWeek: weekRuns.filter((r) => r.status === "acted").length,
        failedThisWeek: weekRuns.filter((r) => r.status === "failed").length,
        studentsReached: new Set(weekRuns.filter((r) => r.status === "acted").map((r) => r.userId)).size,
        notifications,
        materials,
        students: Number(studentCount?.count ?? 0),
        optedOut,
      },
      runs,
    };
  }),

  /** Starts a sweep in the background; the overview shows progress and results. */
  runNow: adminProcedure.mutation(async ({ ctx }) => {
    await assertAiAdmin(ctx.user);
    if (getAutonomousSweepStatus().running) {
      throw new TRPCError({ code: "CONFLICT", message: "A sweep is already running." });
    }
    await audit(ctx.user.id, "AUTONOMOUS_AGENT_RUN_NOW", 0);
    void runAutonomousSweep({ trigger: "manual", force: true }).catch((error) =>
      console.error("[autonomous-agent] Manual sweep failed", error)
    );
    return { started: true };
  }),

  runForStudent: adminProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertAiAdmin(ctx.user);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const [student] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      if (!student || student.role !== "user") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Student not found." });
      }
      await audit(ctx.user.id, "AUTONOMOUS_AGENT_RUN_STUDENT", student.id);
      const status = await runAutonomousAgentForStudent(student, { trigger: "manual" });
      return { status };
    }),
});
