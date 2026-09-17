import { z } from "zod";
import type { User } from "../../drizzle/schema";
import * as documentAi from "../documentAiService";
import * as lecturerQueries from "../lecturerQueries";
import * as queries from "../queries";
import { retrieveRelevantChunkHits } from "../rag/index";
import * as calendar from "../calendar";
import { assertCourseAccess, assertDocumentToolAccess } from "./access";
import type { RetrievedChunk } from "./types";

export type ToolContext = {
  user: User;
  documentId?: number;
  courseId?: number;
};

export type ToolResult = {
  ok: boolean;
  data?: unknown;
  error?: string;
  retrievalCount?: number;
};

type AgentTool = {
  name: string;
  description: string;
  input: z.ZodType;
  execute: (ctx: ToolContext, raw: unknown) => Promise<ToolResult>;
};

const courseSearchInput = z.object({
  courseId: z.number().int().positive(),
  query: z.string().min(2).max(500),
});

const documentQueryInput = z.object({
  documentId: z.number().int().positive(),
  query: z.string().min(1).max(500).optional(),
});

const generateCountInput = z.object({
  documentId: z.number().int().positive(),
  count: z.number().int().min(3).max(20).optional(),
});

const flashcardCountInput = z.object({
  documentId: z.number().int().positive(),
  count: z.number().int().min(3).max(30).optional(),
});

const progressInput = z.object({
  documentId: z.number().int().positive().optional(),
});

const studyPlanInput = z.object({
  courseId: z.number().int().positive().optional(),
});

const recordActivityInput = z.object({
  documentId: z.number().int().positive().optional(),
  activityType: z.enum(["quiz", "flashcard", "reading", "chat"]),
});

const assignmentInput = z.object({
  assignmentId: z.number().int().positive().optional(),
  courseId: z.number().int().positive().optional(),
});

const listCalendarInput = z.object({
  from: z.number().optional(),
  to: z.number().optional(),
});

const saveCalendarInput = z.object({
  events: z.array(calendar.calendarDraftSchema).min(1).max(14),
});

function fail(error: string): ToolResult {
  return { ok: false, error };
}

function ok(data: unknown, retrievalCount?: number): ToolResult {
  return { ok: true, data, retrievalCount };
}

async function searchCourseMaterial(ctx: ToolContext, raw: unknown): Promise<ToolResult> {
  const input = courseSearchInput.parse(raw);
  await assertCourseAccess(ctx.user, input.courseId);
  const course = await lecturerQueries.getCourseById(input.courseId);
  if (!course) return fail("Course not found.");
  const docs =
    ctx.user.role === "user"
      ? await lecturerQueries.getStudentCourseDocuments(ctx.user.id, input.courseId)
      : await lecturerQueries.getCourseDocuments(input.courseId, course.lecturerId);

  const usable = docs.filter((d) => d.id);
  if (!usable.length) {
    return ok({ insufficient: true, chunks: [] as RetrievedChunk[], message: "No course materials found." }, 0);
  }

  const merged: RetrievedChunk[] = [];
  for (const doc of usable.slice(0, 12)) {
    const hits = await retrieveRelevantChunkHits(doc.id, input.query, 3);
    for (const hit of hits) {
      merged.push({
        ...hit,
        documentTitle: doc.title,
        courseId: input.courseId,
      });
    }
  }
  merged.sort((a, b) => b.score - a.score);
  const chunks = merged.slice(0, 8);
  return ok(
    {
      insufficient: chunks.length === 0,
      chunks,
      sources: [...new Set(chunks.map((c) => c.documentTitle).filter(Boolean))],
    },
    chunks.length
  );
}

async function getMaterialContext(ctx: ToolContext, raw: unknown): Promise<ToolResult> {
  const input = documentQueryInput.parse(raw);
  const doc = await assertDocumentToolAccess(ctx.user, input.documentId);
  const query = input.query?.trim() || doc.title;
  const hits = await retrieveRelevantChunkHits(doc.id, query, 6);
  const chunks: RetrievedChunk[] = hits.map((h) => ({
    ...h,
    documentTitle: doc.title,
    courseId: doc.courseId,
  }));
  const fallback = !chunks.length && doc.extractedText?.trim()
    ? [{ documentId: doc.id, chunk: doc.extractedText.slice(0, 2500), score: 0, documentTitle: doc.title, courseId: doc.courseId }]
    : chunks;
  return ok(
    {
      insufficient: fallback.length === 0,
      title: doc.title,
      chunks: fallback,
    },
    hits.length
  );
}

async function generateSummaryTool(ctx: ToolContext, raw: unknown): Promise<ToolResult> {
  const input = documentQueryInput.parse(raw);
  await assertDocumentToolAccess(ctx.user, input.documentId);
  const summary = await documentAi.generateSummaryForDocument(input.documentId);
  return ok({ documentId: input.documentId, summary: summary.summary, keyPoints: summary.keyPoints });
}

async function generateQuizDraft(ctx: ToolContext, raw: unknown): Promise<ToolResult> {
  const input = generateCountInput.parse(raw);
  await assertDocumentToolAccess(ctx.user, input.documentId);
  const quiz = await documentAi.generateQuizForDocument(input.documentId, ctx.user.id, input.count ?? 5);
  return ok({
    quizId: quiz.id,
    title: quiz.title,
    totalQuestions: quiz.totalQuestions,
    documentId: input.documentId,
  });
}

async function generateFlashcardsTool(ctx: ToolContext, raw: unknown): Promise<ToolResult> {
  const input = flashcardCountInput.parse(raw);
  await assertDocumentToolAccess(ctx.user, input.documentId);
  const existing = await queries.getDocumentFlashcards(input.documentId);
  const wanted = input.count ?? 10;
  const saved = await documentAi.generateFlashcardsForDocument(input.documentId, ctx.user.id, wanted);
  return ok({
    created: saved.length,
    existingBefore: existing.length,
    documentId: input.documentId,
  });
}

async function getLearningProgress(ctx: ToolContext, raw: unknown): Promise<ToolResult> {
  const input = progressInput.parse(raw);
  if (input.documentId) {
    await assertDocumentToolAccess(ctx.user, input.documentId);
    const row = await queries.getOrCreateProgress(input.documentId, ctx.user.id);
    return ok({
      documentId: input.documentId,
      quizzesAttempted: row.quizzesAttempted,
      averageQuizScore: row.averageQuizScore,
      flashcardsCreated: row.flashcardsCreated,
      flashcardsReviewed: row.flashcardsReviewed,
      totalStudyTimeMinutes: row.totalStudyTimeMinutes,
      currentStreak: row.currentStreak,
    });
  }
  const rows = await queries.getUserProgressWithTitles(ctx.user.id);
  const weak = [...rows]
    .filter((r) => (r.quizzesAttempted ?? 0) > 0)
    .sort((a, b) => (a.averageQuizScore ?? 100) - (b.averageQuizScore ?? 100))
    .slice(0, 5)
    .map((r) => ({
      documentId: r.documentId,
      title: r.documentTitle,
      averageQuizScore: r.averageQuizScore,
      quizzesAttempted: r.quizzesAttempted,
    }));
  return ok({
    documents: rows.slice(0, 12).map((r) => ({
      documentId: r.documentId,
      title: r.documentTitle,
      quizzesAttempted: r.quizzesAttempted,
      averageQuizScore: r.averageQuizScore,
      flashcardsReviewed: r.flashcardsReviewed,
    })),
    weakerAreas: weak,
  });
}

async function createStudyPlan(ctx: ToolContext, raw: unknown): Promise<ToolResult> {
  const input = studyPlanInput.parse(raw);
  if (input.courseId) await assertCourseAccess(ctx.user, input.courseId);
  const progress = await queries.getUserProgressWithTitles(ctx.user.id);
  const courses =
    ctx.user.role === "user" ? await lecturerQueries.getStudentEnrolledCourses(ctx.user.id) : [];
  const assignments = input.courseId
    ? await lecturerQueries.getCourseAssignments(
        input.courseId,
        ctx.user.role === "lecturer" ? ctx.user.id : (await lecturerQueries.getCourseById(input.courseId))?.lecturerId ?? 0
      )
    : [];
  return ok({
    enrolledCourses: courses.map((c) => ({ id: c.id, title: c.title, code: c.code })),
    focusDocuments: progress.slice(0, 6).map((p) => ({
      documentId: p.documentId,
      title: p.documentTitle,
      averageQuizScore: p.averageQuizScore,
    })),
    openAssignments: assignments.slice(0, 6).map((a) => ({
      id: a.id,
      title: a.title,
      dueDate: a.dueDate,
    })),
  });
}

async function recordStudyActivity(ctx: ToolContext, raw: unknown): Promise<ToolResult> {
  const input = recordActivityInput.parse(raw);
  if (input.documentId) await assertDocumentToolAccess(ctx.user, input.documentId);
  const session = await queries.createStudySession({
    userId: ctx.user.id,
    documentId: input.documentId,
    startTime: new Date(),
    activityType: input.activityType,
    durationMinutes: 1,
  });
  return ok({ sessionId: session.id, activityType: input.activityType });
}

async function getAssignmentContext(ctx: ToolContext, raw: unknown): Promise<ToolResult> {
  const input = assignmentInput.parse(raw);
  if (input.assignmentId) {
    const assignment = await lecturerQueries.getAssignmentById(input.assignmentId);
    if (!assignment) return fail("Assignment not found.");
    await assertCourseAccess(ctx.user, assignment.courseId);
    return ok({
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      dueDate: assignment.dueDate,
      rubric: assignment.rubric,
      fileName: assignment.fileName,
      courseId: assignment.courseId,
    });
  }
  const courseId = input.courseId ?? ctx.courseId;
  if (!courseId) return fail("Select a course or assignment first.");
  await assertCourseAccess(ctx.user, courseId);
  const course = await lecturerQueries.getCourseById(courseId);
  const list = await lecturerQueries.getCourseAssignments(courseId, course?.lecturerId ?? ctx.user.id);
  return ok({
    courseId,
    assignments: list.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      dueDate: a.dueDate,
      rubric: a.rubric,
      fileName: a.fileName,
    })),
  });
}

async function listCalendarEventsTool(ctx: ToolContext, raw: unknown): Promise<ToolResult> {
  if (ctx.user.role !== "user") return fail("Calendar is for students.");
  const input = listCalendarInput.parse(raw);
  const now = Date.now();
  const from = input.from ?? now;
  const to = input.to ?? now + 30 * 24 * 60 * 60 * 1000;
  const events = await calendar.listCalendarEvents(ctx.user.id, from, to);
  return ok({ count: events.length, events });
}

async function saveCalendarPlan(ctx: ToolContext, raw: unknown): Promise<ToolResult> {
  if (ctx.user.role !== "user") return fail("Calendar plans are for students.");
  const input = saveCalendarInput.parse(raw);
  const drafts = calendar.parseCalendarEventDrafts(input.events);
  if (!drafts.length) return fail("No valid calendar dates were found.");
  const created = await calendar.insertCalendarEvents(ctx.user.id, drafts, "agent");
  return ok({ created: created.length, events: created });
}

export const agentTools: AgentTool[] = [
  {
    name: "searchCourseMaterial",
    description: "Search enrolled or owned course documents with RAG.",
    input: courseSearchInput,
    execute: searchCourseMaterial,
  },
  {
    name: "getMaterialContext",
    description: "Retrieve relevant chunks from one authorized document.",
    input: documentQueryInput,
    execute: getMaterialContext,
  },
  {
    name: "generateSummary",
    description: "Generate and save an AI summary for an authorized document.",
    input: documentQueryInput,
    execute: generateSummaryTool,
  },
  {
    name: "generateQuizDraft",
    description: "Generate and save a quiz using the existing quiz pipeline.",
    input: generateCountInput,
    execute: generateQuizDraft,
  },
  {
    name: "generateFlashcards",
    description: "Generate and save flashcards using the existing SM-2 pipeline.",
    input: flashcardCountInput,
    execute: generateFlashcardsTool,
  },
  {
    name: "getLearningProgress",
    description: "Read the student's own quiz/flashcard progress. Does not invent grades.",
    input: progressInput,
    execute: getLearningProgress,
  },
  {
    name: "createStudyPlan",
    description: "Build a revision plan from enrolled courses, progress, and assignments.",
    input: studyPlanInput,
    execute: createStudyPlan,
  },
  {
    name: "recordStudyActivity",
    description: "Record a short study session for the current user.",
    input: recordActivityInput,
    execute: recordStudyActivity,
  },
  {
    name: "getAssignmentContext",
    description: "Read assignment title, description, rubric, and brief filename.",
    input: assignmentInput,
    execute: getAssignmentContext,
  },
  {
    name: "listCalendarEvents",
    description: "List the student's upcoming calendar events.",
    input: listCalendarInput,
    execute: listCalendarEventsTool,
  },
  {
    name: "saveCalendarPlan",
    description: "Save a validated exam/study timetable for the current student.",
    input: saveCalendarInput,
    execute: saveCalendarPlan,
  },
];

export function getAgentTool(name: string): AgentTool | undefined {
  return agentTools.find((t) => t.name === name);
}

const TOOL_TIMEOUT_MS = 90_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Tool timed out.")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export async function executeAgentTool(
  name: string,
  ctx: ToolContext,
  raw: unknown
): Promise<ToolResult> {
  const tool = getAgentTool(name);
  if (!tool) return fail(`Unknown tool: ${name}`);
  try {
    const parsed = tool.input.parse(raw);
    return await withTimeout(tool.execute(ctx, parsed), TOOL_TIMEOUT_MS);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail("Invalid tool arguments.");
    }
    return fail(error instanceof Error ? error.message : "Tool failed.");
  }
}
