import { randomUUID } from "crypto";
import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import {
  assignmentSubmissions,
  assignments,
  autonomousAgentRuns,
  courseEnrollments,
  documents,
  flashcards,
  progressTracking,
  quizzes,
  studentActivities,
  userPreferences,
  users,
  type User,
} from "../../drizzle/schema";
import { DEFAULT_SYSTEM_SETTINGS } from "../../shared/adminSettings";
import { getAiService } from "../ai";
import type { AiChatMessage, AiToolDefinition } from "../ai/types";
import { getDb } from "../db";
import { sendPushNotifications } from "../pushNotifications";
import { createNotification } from "../queries";
import { getSystemSettings } from "../settings";
import { executeAgentTool } from "./tools";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Preference key (in userPreferences.notifications) a student sets to false to opt out. */
export const STUDENT_OPT_OUT_KEY = "student.aiCoach";

export type SignalKind =
  | "deadline"
  | "quiz_due"
  | "new_material"
  | "weak_topic"
  | "due_flashcards"
  | "inactive";

export type AutonomousSignal = {
  key: string;
  kind: SignalKind;
  summary: string;
  priority: number;
  documentId?: number;
  documentTitle?: string;
};

export type AutonomousAction = {
  type: "notification" | "flashcards" | "quiz";
  ok: boolean;
  detail: string;
  documentId?: number;
};

export type AutonomousSettings = typeof DEFAULT_SYSTEM_SETTINGS.autonomousAgent;

export type NotificationTarget =
  | "dashboard"
  | "courses"
  | "flashcards"
  | "quizzes"
  | "planner"
  | "progress"
  | "document";

/** How long a signal stays quiet after the agent has seen it, so students are not nagged every run. */
export const SIGNAL_COOLDOWN_HOURS: Record<SignalKind, number> = {
  deadline: 24,
  quiz_due: 24,
  new_material: 24 * 30,
  weak_topic: 24 * 7,
  due_flashcards: 24,
  inactive: 72,
};

const MAX_SIGNALS_PER_RUN = 5;
const MAX_NOTIFICATIONS_PER_RUN = 2;
const MAX_ROUNDS = 4;
const MAX_TOOL_CALLS = 5;

export function normalizeAutonomousSettings(raw: Partial<AutonomousSettings> | undefined): AutonomousSettings {
  const base = DEFAULT_SYSTEM_SETTINGS.autonomousAgent;
  const merged = { ...base, ...(raw ?? {}) };
  return {
    enabled: Boolean(merged.enabled),
    intervalHours: Math.min(24, Math.max(1, Math.round(Number(merged.intervalHours) || base.intervalHours))),
    maxStudentsPerSweep: Math.min(200, Math.max(1, Math.round(Number(merged.maxStudentsPerSweep) || base.maxStudentsPerSweep))),
    allowContentCreation: Boolean(merged.allowContentCreation),
  };
}

function relativeFuture(ms: number, now: number): string {
  const diff = ms - now;
  if (diff < HOUR) return "within the hour";
  if (diff < DAY) {
    const hours = Math.round(diff / HOUR);
    return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  const days = Math.round(diff / DAY);
  return days === 1 ? "tomorrow" : `in ${days} days`;
}

function toMs(value: Date | number | null | undefined): number | null {
  if (value == null) return null;
  return value instanceof Date ? value.getTime() : Number(value);
}

export function notificationLink(target: NotificationTarget, documentId?: number): string {
  if (target === "document" && documentId) return `/document/${documentId}`;
  if (target === "document") return "/student/courses";
  return `/student/${target}`;
}

/** Drops signals the agent already handled recently and keeps the most important few. */
export function filterFreshSignals(
  signals: AutonomousSignal[],
  recentRuns: Array<{ createdAt: number; signals: Array<{ key: string; kind: string }> | null }>,
  now: number
): AutonomousSignal[] {
  const lastSeen = new Map<string, number>();
  for (const run of recentRuns) {
    for (const s of run.signals ?? []) {
      lastSeen.set(s.key, Math.max(lastSeen.get(s.key) ?? 0, run.createdAt));
    }
  }
  return signals
    .filter((s) => {
      const seen = lastSeen.get(s.key);
      return !seen || now - seen >= SIGNAL_COOLDOWN_HOURS[s.kind] * HOUR;
    })
    .sort((a, b) => a.priority - b.priority)
    .slice(0, MAX_SIGNALS_PER_RUN);
}

/** Reads the student's state and turns it into concrete reasons to act. No LLM involved. */
export async function collectStudentSignals(userId: number, now = Date.now()): Promise<AutonomousSignal[]> {
  const db = await getDb();
  if (!db) return [];
  const signals: AutonomousSignal[] = [];

  const enrolled = await db
    .select({ courseId: courseEnrollments.courseId })
    .from(courseEnrollments)
    .where(eq(courseEnrollments.studentId, userId));
  const courseIds = enrolled.map((e) => e.courseId);

  if (courseIds.length) {
    const dueSoon = await db
      .select({ id: assignments.id, title: assignments.title, dueDate: assignments.dueDate })
      .from(assignments)
      .where(
        and(
          inArray(assignments.courseId, courseIds),
          gte(assignments.dueDate, new Date(now)),
          lte(assignments.dueDate, new Date(now + 3 * DAY))
        )
      );
    if (dueSoon.length) {
      const submitted = await db
        .select({ assignmentId: assignmentSubmissions.assignmentId })
        .from(assignmentSubmissions)
        .where(
          and(
            eq(assignmentSubmissions.studentId, userId),
            inArray(assignmentSubmissions.assignmentId, dueSoon.map((a) => a.id))
          )
        );
      const done = new Set(submitted.map((s) => s.assignmentId));
      for (const a of dueSoon) {
        if (done.has(a.id)) continue;
        signals.push({
          key: `deadline:${a.id}`,
          kind: "deadline",
          priority: 1,
          summary: `Assignment "${a.title}" is due ${relativeFuture(toMs(a.dueDate)!, now)} and has not been submitted.`,
        });
      }
    }

    const fresh = await db
      .select({ id: documents.id, title: documents.title, createdAt: documents.createdAt })
      .from(documents)
      .where(
        and(
          inArray(documents.courseId, courseIds),
          eq(documents.processingStatus, "ready"),
          gte(documents.createdAt, new Date(now - 7 * DAY))
        )
      )
      .orderBy(desc(documents.createdAt))
      .limit(6);
    if (fresh.length) {
      const withCards = await db
        .select({ documentId: flashcards.documentId })
        .from(flashcards)
        .where(and(eq(flashcards.userId, userId), inArray(flashcards.documentId, fresh.map((d) => d.id))))
        .groupBy(flashcards.documentId);
      const covered = new Set(withCards.map((r) => r.documentId));
      for (const d of fresh.filter((doc) => !covered.has(doc.id)).slice(0, 2)) {
        signals.push({
          key: `new_material:${d.id}`,
          kind: "new_material",
          priority: 3,
          documentId: d.id,
          documentTitle: d.title,
          summary: `New lecture material "${d.title}" (documentId ${d.id}) was added and the student has no flashcards for it yet.`,
        });
      }
    }
  }

  const quizDue = await db
    .select({ id: quizzes.id, title: quizzes.title, dueDate: quizzes.dueDate, documentId: quizzes.documentId })
    .from(quizzes)
    .where(
      and(
        eq(quizzes.userId, userId),
        isNull(quizzes.completedAt),
        gte(quizzes.dueDate, new Date(now)),
        lte(quizzes.dueDate, new Date(now + 3 * DAY))
      )
    )
    .limit(3);
  for (const q of quizDue) {
    signals.push({
      key: `quiz_due:${q.id}`,
      kind: "quiz_due",
      priority: 2,
      documentId: q.documentId,
      summary: `Quiz "${q.title}" is due ${relativeFuture(toMs(q.dueDate)!, now)} and has not been completed.`,
    });
  }

  const weak = await db
    .select({
      documentId: progressTracking.documentId,
      score: progressTracking.averageQuizScore,
      attempts: progressTracking.quizzesAttempted,
      title: documents.title,
    })
    .from(progressTracking)
    .innerJoin(documents, eq(documents.id, progressTracking.documentId))
    .where(
      and(
        eq(progressTracking.userId, userId),
        sql`${progressTracking.quizzesAttempted} > 0`,
        sql`${progressTracking.averageQuizScore} < 60`
      )
    )
    .orderBy(progressTracking.averageQuizScore)
    .limit(2);
  for (const w of weak) {
    signals.push({
      key: `weak_topic:${w.documentId}`,
      kind: "weak_topic",
      priority: 3,
      documentId: w.documentId,
      documentTitle: w.title,
      summary: `Average quiz score on "${w.title}" (documentId ${w.documentId}) is ${Math.round(w.score ?? 0)}% over ${w.attempts} attempt${w.attempts === 1 ? "" : "s"}.`,
    });
  }

  const [due] = await db
    .select({ count: sql<number>`count(*)` })
    .from(flashcards)
    .where(and(eq(flashcards.userId, userId), lte(flashcards.dueDate, new Date(now))));
  const dueCount = Number(due?.count ?? 0);
  if (dueCount >= 5) {
    signals.push({
      key: "due_flashcards",
      kind: "due_flashcards",
      priority: 4,
      summary: `${dueCount} flashcards are due for spaced-repetition review.`,
    });
  }

  if (courseIds.length) {
    const [last] = await db
      .select({ createdAt: studentActivities.createdAt })
      .from(studentActivities)
      .where(eq(studentActivities.userId, userId))
      .orderBy(desc(studentActivities.createdAt))
      .limit(1);
    const lastMs = toMs(last?.createdAt);
    if (!lastMs || now - lastMs >= 4 * DAY) {
      const days = lastMs ? Math.floor((now - lastMs) / DAY) : null;
      signals.push({
        key: "inactive",
        kind: "inactive",
        priority: 5,
        summary: days ? `No study activity for ${days} days.` : "The student has not started studying in the app yet.",
      });
    }
  }

  return signals;
}

/** Plain reminder used when the language model is unavailable. */
export function fallbackNotification(signal: AutonomousSignal): {
  title: string;
  body: string;
  target: NotificationTarget;
  documentId?: number;
} {
  switch (signal.kind) {
    case "deadline":
      return { title: "Assignment due soon", body: `${signal.summary} Open your course to submit it in time.`, target: "courses" };
    case "quiz_due":
      return { title: "Quiz due soon", body: `${signal.summary} Take it from your Quizzes page.`, target: "quizzes" };
    case "new_material":
      return {
        title: "New lecture material",
        body: `"${signal.documentTitle}" was just added to your course. Have a read and ask the AI if anything is unclear.`,
        target: "document",
        documentId: signal.documentId,
      };
    case "weak_topic":
      return {
        title: "Time to revisit a topic",
        body: `Your quiz scores on "${signal.documentTitle}" suggest it needs another look. A short review will help.`,
        target: "document",
        documentId: signal.documentId,
      };
    case "due_flashcards":
      return { title: "Flashcards ready for review", body: `${signal.summary} A quick session keeps them fresh.`, target: "flashcards" };
    case "inactive":
      return {
        title: "Let's get back on track",
        body: "A short 15-minute study session today will keep your progress moving.",
        target: "dashboard",
      };
  }
}

async function deliverNotification(
  user: Pick<User, "id" | "expoPushToken">,
  note: { title: string; body: string; target: NotificationTarget; documentId?: number }
) {
  const link = notificationLink(note.target, note.documentId);
  const data = { type: "ai_coach", target: note.target, documentId: note.documentId ?? null, link };
  await createNotification({ userId: user.id, title: note.title, body: note.body, data });
  await sendPushNotifications([user.expoPushToken], note.title, note.body, data);
}

const notificationArgs = z.object({
  title: z.string().min(3).max(80),
  body: z.string().min(5).max(280),
  target: z.enum(["dashboard", "courses", "flashcards", "quizzes", "planner", "progress", "document"]),
  documentId: z.number().int().positive().optional(),
});

const contentArgs = z.object({
  documentId: z.number().int().positive(),
  count: z.number().int().min(3).max(15).optional(),
});

function toolDefinitions(content: { flashcards: boolean; quiz: boolean }): AiToolDefinition[] {
  const tools: AiToolDefinition[] = [
    {
      type: "function",
      function: {
        name: "sendNotification",
        description:
          "Send the student an in-app and push notification. Use target to choose where tapping it leads; use target 'document' with a documentId from the signals to open a lecture.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short title, under 60 characters" },
            body: { type: "string", description: "Friendly, specific message under 200 characters" },
            target: {
              type: "string",
              enum: ["dashboard", "courses", "flashcards", "quizzes", "planner", "progress", "document"],
            },
            documentId: { type: "integer" },
          },
          required: ["title", "body", "target"],
        },
      },
    },
  ];
  if (content.flashcards) {
    tools.push({
      type: "function",
      function: {
        name: "generateFlashcards",
        description: "Create flashcards for the student from one lecture document listed in the signals.",
        parameters: {
          type: "object",
          properties: {
            documentId: { type: "integer" },
            count: { type: "integer", minimum: 3, maximum: 15 },
          },
          required: ["documentId"],
        },
      },
    });
  }
  if (content.quiz) {
    tools.push({
      type: "function",
      function: {
        name: "generateQuiz",
        description: "Create a practice quiz for the student from one lecture document listed in the signals.",
        parameters: {
          type: "object",
          properties: {
            documentId: { type: "integer" },
            count: { type: "integer", minimum: 3, maximum: 15 },
          },
          required: ["documentId"],
        },
      },
    });
  }
  return tools;
}

function systemPrompt(canCreate: boolean): string {
  return [
    "You are the background study coach for the Course-Specific AI Learning Assistant.",
    "You run on a schedule without the student asking. Decide what, if anything, would genuinely help this student right now, then do it with your tools.",
    "Rules:",
    "- Act only on the signals provided. Never invent courses, documents, grades or dates.",
    "- Only use documentIds that appear in the signals.",
    `- Send at most ${MAX_NOTIFICATIONS_PER_RUN} notifications; prefer one combined notification over several small ones. Keep titles under 60 characters and bodies under 200 characters. Be warm, specific and encouraging, never guilt-tripping.`,
    canCreate
      ? "- You may create study material once: generateFlashcards suits new lecture material, generateQuiz suits weak topics or upcoming quizzes. After creating material, send a notification saying it is ready and where to find it."
      : "- You cannot create study material in this run; notifications only.",
    "- You cannot change the student's calendar.",
    "- If nothing is worth interrupting the student for, do nothing.",
    "- When finished, reply with one short sentence describing what you did, for the admin activity log. Do not mention tool names.",
  ].join("\n");
}

export type DecideResult = {
  actions: AutonomousAction[];
  summary: string;
  usedLlm: boolean;
};

/** Lets the language model choose and perform actions for one student's signals. */
export async function decideAndAct(
  user: User,
  signals: AutonomousSignal[],
  options: { allowContent: boolean; flashcardsEnabled: boolean; quizzesEnabled: boolean },
  requestId = randomUUID()
): Promise<DecideResult> {
  const actions: AutonomousAction[] = [];
  const allowedDocs = new Map<number, string | undefined>();
  for (const s of signals) if (s.documentId) allowedDocs.set(s.documentId, s.documentTitle);
  const canFlashcards = options.allowContent && options.flashcardsEnabled && allowedDocs.size > 0;
  const canQuiz = options.allowContent && options.quizzesEnabled && allowedDocs.size > 0;
  let contentBudget = canFlashcards || canQuiz ? 1 : 0;
  let notificationBudget = MAX_NOTIFICATIONS_PER_RUN;

  const firstName = (user.name ?? "").trim().split(/\s+/)[0] || "the student";
  const messages: AiChatMessage[] = [
    { role: "system", content: systemPrompt(contentBudget > 0) },
    {
      role: "user",
      content: [
        `Student first name: ${firstName}`,
        `Current time: ${new Date().toISOString()}`,
        "Signals (most important first):",
        ...signals.map((s, i) => `${i + 1}. [${s.kind}] ${s.summary}`),
      ].join("\n"),
    },
  ];
  const tools = toolDefinitions({ flashcards: canFlashcards, quiz: canQuiz });

  async function runTool(name: string, rawArgs: string): Promise<string> {
    let args: unknown = {};
    try {
      args = JSON.parse(rawArgs || "{}");
    } catch {
      return JSON.stringify({ ok: false, error: "Arguments were not valid JSON." });
    }

    if (name === "sendNotification") {
      if (notificationBudget <= 0) return JSON.stringify({ ok: false, error: "Notification limit reached." });
      const parsed = notificationArgs.safeParse(args);
      if (!parsed.success) return JSON.stringify({ ok: false, error: "Invalid notification." });
      const note = { ...parsed.data };
      if (note.documentId && !allowedDocs.has(note.documentId)) note.documentId = undefined;
      if (note.target === "document" && !note.documentId) note.target = "courses";
      notificationBudget -= 1;
      await deliverNotification(user, note);
      actions.push({ type: "notification", ok: true, detail: note.title, documentId: note.documentId });
      return JSON.stringify({ ok: true });
    }

    if (name === "generateFlashcards" || name === "generateQuiz") {
      const allowed = name === "generateFlashcards" ? canFlashcards : canQuiz;
      if (!allowed || contentBudget <= 0) {
        return JSON.stringify({ ok: false, error: "Creating study material is not allowed now." });
      }
      const parsed = contentArgs.safeParse(args);
      if (!parsed.success || !allowedDocs.has(parsed.data.documentId)) {
        return JSON.stringify({ ok: false, error: "Use a documentId from the signals." });
      }
      contentBudget -= 1;
      const { documentId } = parsed.data;
      const title = allowedDocs.get(documentId) ?? `document ${documentId}`;
      const isCards = name === "generateFlashcards";
      const result = await executeAgentTool(
        isCards ? "generateFlashcards" : "generateQuizDraft",
        { user, documentId },
        { documentId, count: parsed.data.count ?? (isCards ? 8 : 5) }
      );
      const data = (result.data ?? {}) as { created?: number; totalQuestions?: number };
      actions.push({
        type: isCards ? "flashcards" : "quiz",
        ok: result.ok,
        documentId,
        detail: result.ok
          ? isCards
            ? `Created ${data.created ?? 0} flashcards from "${title}"`
            : `Created a ${data.totalQuestions ? `${data.totalQuestions}-question ` : ""}quiz from "${title}"`
          : result.error || "Generation failed",
      });
      return JSON.stringify(result.ok ? { ok: true, ...data } : { ok: false, error: result.error });
    }

    return JSON.stringify({ ok: false, error: `Unknown tool ${name}.` });
  }

  let summary = "";
  let toolCalls = 0;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const turn = await getAiService().generate({
      messages,
      tools,
      toolChoice: "auto",
      taskType: "agent",
      requestId: `${requestId}-auto-r${round}`,
      maxTokens: 600,
      temperature: 0.3,
    });
    if (!turn.toolCalls?.length || toolCalls >= MAX_TOOL_CALLS) {
      summary = turn.content.trim();
      break;
    }
    messages.push({ role: "assistant", content: turn.content || null, tool_calls: turn.toolCalls });
    for (const call of turn.toolCalls) {
      const name = call.function?.name ?? "unknown";
      const content =
        toolCalls >= MAX_TOOL_CALLS
          ? JSON.stringify({ ok: false, error: "Tool limit reached." })
          : await runTool(name, call.function?.arguments ?? "{}");
      toolCalls += 1;
      messages.push({ role: "tool", tool_call_id: call.id, name, content });
    }
  }

  // Material the student never hears about is wasted, so announce it if the model forgot to.
  const created = actions.filter((a) => a.ok && (a.type === "flashcards" || a.type === "quiz"));
  if (created.length && !actions.some((a) => a.type === "notification") && notificationBudget > 0) {
    const item = created[0];
    const isCards = item.type === "flashcards";
    const note = {
      title: isCards ? "New flashcards are ready" : "A practice quiz is ready",
      body: `${item.detail}. Open ${isCards ? "Flashcards" : "Quizzes"} to start.`,
      target: (isCards ? "flashcards" : "quizzes") as NotificationTarget,
    };
    await deliverNotification(user, note);
    actions.push({ type: "notification", ok: true, detail: note.title });
  }

  if (!summary) {
    summary = actions.length
      ? actions.map((a) => a.detail).join("; ")
      : "Reviewed the student's signals and decided no action was needed.";
  }
  return { actions, summary: summary.slice(0, 500), usedLlm: true };
}

async function recordRun(row: {
  userId: number;
  status: "acted" | "idle" | "failed";
  trigger: "schedule" | "manual";
  signals: AutonomousSignal[];
  actions: AutonomousAction[];
  summary: string | null;
  error?: string | null;
  usedLlm: boolean;
  durationMs: number;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(autonomousAgentRuns).values({
    userId: row.userId,
    status: row.status,
    trigger: row.trigger,
    signals: row.signals.map((s) => ({ key: s.key, kind: s.kind, summary: s.summary })),
    actions: row.actions,
    summary: row.summary,
    error: row.error ?? null,
    usedLlm: row.usedLlm,
    durationMs: row.durationMs,
    createdAt: new Date(),
  });
}

export async function runAutonomousAgentForStudent(
  user: User,
  options: { trigger?: "schedule" | "manual"; settings?: AutonomousSettings } = {}
): Promise<"acted" | "idle" | "failed"> {
  const trigger = options.trigger ?? "schedule";
  const started = Date.now();
  const system = await getSystemSettings();
  const settings = options.settings ?? normalizeAutonomousSettings(system.autonomousAgent);
  const db = await getDb();

  let signals: AutonomousSignal[] = [];
  try {
    const recent = db
      ? await db
          .select({ createdAt: autonomousAgentRuns.createdAt, signals: autonomousAgentRuns.signals })
          .from(autonomousAgentRuns)
          .where(
            and(
              eq(autonomousAgentRuns.userId, user.id),
              inArray(autonomousAgentRuns.status, ["acted", "idle"]),
              gte(autonomousAgentRuns.createdAt, new Date(started - 31 * DAY))
            )
          )
      : [];
    signals = filterFreshSignals(
      await collectStudentSignals(user.id, started),
      recent.map((r) => ({ createdAt: toMs(r.createdAt) ?? 0, signals: r.signals ?? null })),
      started
    );

    if (!signals.length) {
      await recordRun({
        userId: user.id,
        status: "idle",
        trigger,
        signals: [],
        actions: [],
        summary: "Nothing needed attention.",
        usedLlm: false,
        durationMs: Date.now() - started,
      });
      return "idle";
    }

    let result: DecideResult;
    try {
      result = await decideAndAct(user, signals, {
        allowContent: settings.allowContentCreation,
        flashcardsEnabled: system.features.flashcards,
        quizzesEnabled: system.features.quizGeneration,
      });
    } catch (error) {
      const note = fallbackNotification(signals[0]);
      await deliverNotification(user, note);
      result = {
        actions: [{ type: "notification", ok: true, detail: note.title, documentId: note.documentId }],
        summary: `AI service unavailable, so a standard reminder was sent instead (${error instanceof Error ? error.message : "unknown error"}).`.slice(0, 500),
        usedLlm: false,
      };
    }

    const status = result.actions.some((a) => a.ok) ? "acted" : "idle";
    await recordRun({
      userId: user.id,
      status,
      trigger,
      signals,
      actions: result.actions,
      summary: result.summary,
      usedLlm: result.usedLlm,
      durationMs: Date.now() - started,
    });
    return status;
  } catch (error) {
    console.error("[autonomous-agent] Run failed", { userId: user.id, error });
    await recordRun({
      userId: user.id,
      status: "failed",
      trigger,
      signals,
      actions: [],
      summary: null,
      error: error instanceof Error ? error.message : String(error),
      usedLlm: false,
      durationMs: Date.now() - started,
    }).catch(() => undefined);
    return "failed";
  }
}

export type SweepResult = {
  processed: number;
  acted: number;
  idle: number;
  failed: number;
  optedOut: number;
  skippedReason?: string;
};

let sweepRunning = false;
let lastSweep: { startedAt: number; finishedAt: number | null; result: SweepResult | null } | null = null;

export function getAutonomousSweepStatus() {
  return { running: sweepRunning, lastSweep };
}

/** One pass over every student who is due for a check. */
export async function runAutonomousSweep(
  options: { trigger?: "schedule" | "manual"; force?: boolean } = {}
): Promise<SweepResult> {
  const empty: SweepResult = { processed: 0, acted: 0, idle: 0, failed: 0, optedOut: 0 };
  const system = await getSystemSettings();
  const settings = normalizeAutonomousSettings(system.autonomousAgent);
  if (!settings.enabled && !options.force) return { ...empty, skippedReason: "disabled" };
  if (sweepRunning) return { ...empty, skippedReason: "already running" };
  const db = await getDb();
  if (!db) return { ...empty, skippedReason: "database unavailable" };

  sweepRunning = true;
  const startedAt = Date.now();
  lastSweep = { startedAt, finishedAt: null, result: null };
  const result: SweepResult = { ...empty };
  try {
    const students = await db
      .select()
      .from(users)
      .where(and(eq(users.role, "user"), eq(users.isBanned, false)));
    if (!students.length) return result;
    const ids = students.map((s) => s.id);

    const prefs = await db
      .select({ userId: userPreferences.userId, notifications: userPreferences.notifications })
      .from(userPreferences)
      .where(inArray(userPreferences.userId, ids));
    const optedOut = new Set(prefs.filter((p) => p.notifications?.[STUDENT_OPT_OUT_KEY] === false).map((p) => p.userId));
    result.optedOut = optedOut.size;

    const lastRuns = await db
      .select({ userId: autonomousAgentRuns.userId, last: sql<number>`max(${autonomousAgentRuns.createdAt})` })
      .from(autonomousAgentRuns)
      .where(inArray(autonomousAgentRuns.userId, ids))
      .groupBy(autonomousAgentRuns.userId);
    const lastByUser = new Map(lastRuns.map((r) => [r.userId, Number(r.last)]));

    const interval = settings.intervalHours * HOUR;
    const due = students
      .filter((s) => !optedOut.has(s.id))
      .filter((s) => options.force || startedAt - (lastByUser.get(s.id) ?? 0) >= interval)
      .sort((a, b) => (lastByUser.get(a.id) ?? 0) - (lastByUser.get(b.id) ?? 0))
      .slice(0, settings.maxStudentsPerSweep);

    for (const student of due) {
      const status = await runAutonomousAgentForStudent(student, {
        trigger: options.trigger ?? "schedule",
        settings,
      });
      result.processed += 1;
      result[status] += 1;
    }
    return result;
  } finally {
    sweepRunning = false;
    lastSweep = { startedAt, finishedAt: Date.now(), result };
  }
}

const CHECK_EVERY_MS = 15 * 60 * 1000;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Wakes up every 15 minutes; each student is only processed once their interval has passed,
 * so restarts and frequent ticks do not cause extra notifications.
 */
export function startAutonomousAgentScheduler() {
  if (schedulerTimer || process.env.VITEST || process.env.NODE_ENV === "test" || process.env.AUTONOMOUS_AGENT === "off") {
    return;
  }
  const tick = () => {
    runAutonomousSweep({ trigger: "schedule" })
      .then((r) => {
        if (r.processed) console.log("[autonomous-agent] Sweep finished", r);
      })
      .catch((error) => console.error("[autonomous-agent] Sweep failed", error));
  };
  const first = setTimeout(tick, 60 * 1000);
  first.unref?.();
  schedulerTimer = setInterval(tick, CHECK_EVERY_MS);
  schedulerTimer.unref?.();
  console.log("[autonomous-agent] Scheduler started (checks every 15 minutes)");
}
