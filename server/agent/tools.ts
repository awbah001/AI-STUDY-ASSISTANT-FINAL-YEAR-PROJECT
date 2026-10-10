import { z } from "zod";
import type { User } from "../../drizzle/schema";
import * as documentAi from "../documentAiService";
import * as lecturerQueries from "../lecturerQueries";
import * as queries from "../queries";
import { retrieveRelevantChunkHits } from "../rag/index";
import * as calendar from "../calendar";
import { assertCourseAccess, assertDocumentToolAccess } from "./access";
import type { RetrievedChunk } from "./types";
import { buildStudentSystemSnapshot } from "./systemContext";

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
  const existing = await queries.getDocumentFlashcards(input.documentId, ctx.user.id);
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

async function getStudentSystemContext(ctx: ToolContext, _raw: unknown): Promise<ToolResult> {
  if (ctx.user.role !== "user" && ctx.user.role !== "admin") {
    return fail("System context is available for student learning sessions.");
  }
  const snapshot = await buildStudentSystemSnapshot(ctx.user, {
    courseId: ctx.courseId,
    documentId: ctx.documentId,
  });
  return ok(snapshot);
}

async function createStudyTimetable(ctx: ToolContext, raw: unknown): Promise<ToolResult> {
  if (ctx.user.role !== "user") return fail("Calendar plans are for students.");
  const input = z
    .object({
      message: z.string().min(3).max(1000),
      courseId: z.number().int().positive().optional(),
      progressDigest: z.string().max(2000).optional(),
    })
    .parse(raw);

  let courseId = input.courseId ?? ctx.courseId;
  // If still unknown, try to resolve from enrolled courses + message, or single enrollment.
  if (!courseId && ctx.user.role === "user") {
    const courses = await lecturerQueries.getStudentEnrolledCourses(ctx.user.id);
    const lower = input.message.toLowerCase();
    const match = courses.find((c) => {
      const hay = [c.code, c.title, c.subject].filter(Boolean).join(" ").toLowerCase();
      return Boolean(
        hay &&
          ((c.code && lower.includes(String(c.code).toLowerCase())) ||
            (c.title && lower.includes(c.title.toLowerCase())) ||
            (c.subject && lower.includes(c.subject.toLowerCase())))
      );
    });
    courseId = match?.id ?? (courses.length === 1 ? courses[0].id : undefined);
  }
  let enrichedMessage = input.message.trim();
  const digestParts: string[] = [];
  if (input.progressDigest?.trim()) digestParts.push(input.progressDigest.trim());

  if (courseId) {
    try {
      await assertCourseAccess(ctx.user, courseId);
      const course = await lecturerQueries.getCourseById(courseId);
      if (course) {
        const label = [course.code, course.title].filter(Boolean).join(" — ") || course.title;
        if (label && !enrichedMessage.toLowerCase().includes(String(course.title).toLowerCase())) {
          enrichedMessage = `${enrichedMessage} (course: ${label})`;
        }
        digestParts.push(`Course: ${label}`);
        const assignments = await lecturerQueries.getCourseAssignments(courseId, course.lecturerId);
        const upcoming = assignments
          .filter((a) => a.dueDate && new Date(a.dueDate).getTime() > Date.now())
          .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
          .slice(0, 5);
        if (upcoming.length) {
          digestParts.push(
            "Upcoming assignments: " +
              upcoming
                .map((a) => `${a.title} due ${new Date(a.dueDate!).toISOString().slice(0, 10)}`)
                .join("; ")
          );
          // If the student gave no date, anchor the plan on the soonest due date.
          const hasDate =
            /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(
              enrichedMessage
            ) ||
            /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}/i.test(enrichedMessage) ||
            /\b(tomorrow|next week|in\s+\d+\s+days?)\b/i.test(enrichedMessage);
          if (!hasDate && upcoming[0]?.dueDate) {
            const due = new Date(upcoming[0].dueDate);
            enrichedMessage += ` focusing on ${upcoming[0].title} due ${due.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}`;
          }
        }
        const docs =
          ctx.user.role === "user"
            ? await lecturerQueries.getStudentCourseDocuments(ctx.user.id, courseId)
            : await lecturerQueries.getCourseDocuments(courseId, course.lecturerId);
        if (docs.length) {
          digestParts.push(
            "Course materials: " + docs.slice(0, 8).map((d) => d.title).join("; ")
          );
        }
      }
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Course access denied.");
    }
  }

  const drafts = await calendar.proposeCalendarDrafts(
    enrichedMessage,
    digestParts.join("\n").slice(0, 2000)
  );
  if (!drafts.length) {
    return fail(
      "Could not build a timetable. Include an exam/test date, for example: “Create a 5-day study plan for my GIS exam on 25 September at 9am.”"
    );
  }

  const withCourse = courseId
    ? drafts.map((d) => ({ ...d, courseId: d.courseId ?? courseId }))
    : drafts;
  const created = await calendar.insertCalendarEvents(ctx.user.id, withCourse, "agent");
  return ok({
    created: created.length,
    events: created,
    courseId: courseId ?? null,
    usedMessage: enrichedMessage,
  });
}

export const agentTools: AgentTool[] = [
  {
    name: "searchCourseMaterial",
    description:
      "Search the student's authorized course documents with RAG. Use when answering course-specific questions. Requires courseId.",
    input: courseSearchInput,
    execute: searchCourseMaterial,
  },
  {
    name: "getMaterialContext",
    description:
      "Retrieve relevant chunks from one authorized lecture document. Use when a documentId is available.",
    input: documentQueryInput,
    execute: getMaterialContext,
  },
  {
    name: "generateSummary",
    description: "Generate and save an AI summary for an authorized document. Requires documentId.",
    input: documentQueryInput,
    execute: generateSummaryTool,
  },
  {
    name: "generateQuizDraft",
    description: "Generate and save a quiz from an authorized document. Requires documentId.",
    input: generateCountInput,
    execute: generateQuizDraft,
  },
  {
    name: "generateFlashcards",
    description: "Generate and save flashcards from an authorized document. Requires documentId.",
    input: flashcardCountInput,
    execute: generateFlashcardsTool,
  },
  {
    name: "getLearningProgress",
    description: "Read the student's quiz/flashcard progress. Never invent grades.",
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
    description: "Read assignment title, description, rubric, and brief filename for an authorized course.",
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
    name: "getStudentSystemContext",
    description:
      "Read the student's authorized system snapshot: enrolled courses, materials, assignments, progress, and upcoming calendar. Call when you need system-wide awareness before acting.",
    input: z.object({}),
    execute: getStudentSystemContext,
  },
  {
    name: "createStudyTimetable",
    description:
      "Create and save a multi-day exam/study timetable to the student's Planner calendar. ALWAYS use this when the student asks for a study timetable, revision plan, exam schedule, or calendar plan. Pass courseId when known. Prefer including an assessment date in message.",
    input: z.object({
      message: z.string().min(3).max(1000),
      courseId: z.number().int().positive().optional(),
      progressDigest: z.string().max(2000).optional(),
    }),
    execute: createStudyTimetable,
  },
  {
    name: "saveCalendarPlan",
    description: "Save a validated exam/study timetable for the current student (internal/legacy).",
    input: saveCalendarInput,
    execute: saveCalendarPlan,
  },
];

/** OpenAI/Groq function-calling schemas for the agentic loop. */
export function getOpenAiToolDefinitions(): Array<{
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}> {
  return [
    {
      type: "function",
      function: {
        name: "searchCourseMaterial",
        description: "Search authorized course documents with RAG for a course-specific question.",
        parameters: {
          type: "object",
          properties: {
            courseId: { type: "integer", description: "Course ID the student is enrolled in" },
            query: { type: "string", description: "Search query / student question" },
          },
          required: ["courseId", "query"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "getMaterialContext",
        description: "Retrieve relevant chunks from one lecture document.",
        parameters: {
          type: "object",
          properties: {
            documentId: { type: "integer" },
            query: { type: "string" },
          },
          required: ["documentId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "generateSummary",
        description: "Generate and save a document summary.",
        parameters: {
          type: "object",
          properties: {
            documentId: { type: "integer" },
            query: { type: "string" },
          },
          required: ["documentId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "generateQuizDraft",
        description: "Generate and save a quiz from a document.",
        parameters: {
          type: "object",
          properties: {
            documentId: { type: "integer" },
            count: { type: "integer", minimum: 3, maximum: 20 },
          },
          required: ["documentId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "generateFlashcards",
        description: "Generate and save flashcards from a document.",
        parameters: {
          type: "object",
          properties: {
            documentId: { type: "integer" },
            count: { type: "integer", minimum: 3, maximum: 30 },
          },
          required: ["documentId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "getLearningProgress",
        description: "Read the student's learning progress.",
        parameters: {
          type: "object",
          properties: {
            documentId: { type: "integer" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "createStudyPlan",
        description: "Build a revision plan from courses and progress.",
        parameters: {
          type: "object",
          properties: {
            courseId: { type: "integer" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "recordStudyActivity",
        description: "Record a short study session.",
        parameters: {
          type: "object",
          properties: {
            documentId: { type: "integer" },
            activityType: { type: "string", enum: ["quiz", "flashcard", "reading", "chat"] },
          },
          required: ["activityType"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "getAssignmentContext",
        description: "Read assignment details for an authorized course.",
        parameters: {
          type: "object",
          properties: {
            assignmentId: { type: "integer" },
            courseId: { type: "integer" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "listCalendarEvents",
        description: "List upcoming student calendar events.",
        parameters: {
          type: "object",
          properties: {
            from: { type: "number" },
            to: { type: "number" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "getStudentSystemContext",
        description:
          "Refresh the student's authorized system snapshot (courses, materials, assignments, progress, calendar).",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    },
    {
      type: "function",
      function: {
        name: "createStudyTimetable",
        description:
          "REQUIRED for study timetable / revision plan / exam schedule requests. Saves day-by-day sessions to Planner. Pass courseId when available. Include exam/test date in message when the student provided one.",
        parameters: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Student request; include subject and exam date when known",
            },
            courseId: { type: "integer", description: "Active course ID when planning for a course" },
            progressDigest: { type: "string" },
          },
          required: ["message"],
        },
      },
    },
  ];
}

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
