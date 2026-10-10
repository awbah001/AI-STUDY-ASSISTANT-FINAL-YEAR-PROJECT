import { randomUUID } from "crypto";
import { classifyLearningIntent, type LearningIntent } from "./intents";
import { resolveCourseFromMessage } from "./access";
import { runAgenticToolLoop, shouldReportInsufficient } from "./agentLoop";
import { formatStudyPlanReply } from "../calendar";
import { executeAgentTool } from "./tools";
import { currentLlmProviderName } from "./llmProvider";
import { logAgentToolRun, upsertAgentSession } from "./persist";
import { getAiService } from "../ai";
import * as lecturerQueries from "../lecturerQueries";
import {
  INSUFFICIENT_COURSE_CONTEXT,
  type AgentRunInput,
  type AgentRunResult,
} from "./types";

async function courseNoteTitles(input: AgentRunInput, courseId?: number): Promise<string[]> {
  if (!courseId || input.user.role !== "user") return [];
  try {
    const docs = await lecturerQueries.getStudentCourseDocuments(input.user.id, courseId);
    return docs.map((d) => d.title).filter(Boolean).slice(0, 8);
  } catch {
    return [];
  }
}

/**
 * The notes were searched and nothing relevant came back. Rather than refusing, give a general
 * answer that is clearly labelled as not coming from the student's uploaded materials.
 */
async function answerBeyondNotes(
  input: AgentRunInput,
  requestId: string,
  courseId?: number,
  documentTitle?: string | null
): Promise<string | null> {
  const titles = documentTitle ? [documentTitle] : await courseNoteTitles(input, courseId);
  const notesLabel = titles.length ? ` (${titles.join(", ")})` : "";
  const system = [
    "You are a patient university tutor.",
    "The student's uploaded course notes do not cover this question, so answer from accurate general knowledge.",
    "Be clear and concise: short paragraphs or bullet points, under 250 words.",
    "Do not say the answer comes from their notes, and do not add a disclaimer — one is shown separately.",
    titles.length
      ? `Their notes cover: ${titles.join(", ")}. Only if the topic genuinely connects, end with one sentence pointing them to the relevant note.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const turn = await getAiService().generate({
      messages: [
        { role: "system", content: system },
        ...(input.history ?? []).slice(-4).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user", content: input.message },
      ],
      taskType: "explanation",
      requestId: `${requestId}-general`,
      maxTokens: 700,
      temperature: 0.3,
    });
    const body = turn.content.trim();
    if (!body) return null;
    return `_Your uploaded notes${notesLabel} don't cover this directly, so here is a general explanation:_\n\n${body}`;
  } catch {
    return null;
  }
}

function formatToolReply(
  intent: LearningIntent,
  results: Array<{ tool: string; ok: boolean; data?: unknown; error?: string }>
): string | null {
  const lastOk = [...results].reverse().find((r) => r.ok);
  if (!lastOk?.data || typeof lastOk.data !== "object") return null;
  const data = lastOk.data as Record<string, unknown>;

  if (lastOk.tool === "generateQuizDraft") {
    return `I've created a new **AI quiz** (${data.totalQuestions ?? "several"} questions). Open the **Quizzes** tab to take it.`;
  }
  if (lastOk.tool === "generateFlashcards") {
    return `I've added **${data.created ?? 0} AI flashcards**. Open the **Flashcards** tab to study them.`;
  }
  if (lastOk.tool === "generateSummary") {
    return "I've generated an **AI summary** of this document. Open the **AI Actions** tab to read it.";
  }
  if (lastOk.tool === "createStudyTimetable" || lastOk.tool === "saveCalendarPlan") {
    const events = Array.isArray(data.events)
      ? (data.events as Array<{
          title: string;
          type: string;
          startsAt: string | number;
          notes?: string | null;
        }>)
      : [];
    if (events.length) return formatStudyPlanReply(events);
    return `I've added **${data.created ?? 0} items** to your calendar. Open **Planner** to review the timetable.`;
  }
  return null;
}

/**
 * Course learning agent — Groq tool-calling loop decides which tools to run.
 * Tool executors still enforce JWT-backed course/document authorization.
 */
export async function runLearningAgent(input: AgentRunInput): Promise<AgentRunResult> {
  const requestId = randomUUID();
  const intent = classifyLearningIntent(input.message);
  const documentId = input.documentId && input.documentId > 0 ? input.documentId : undefined;
  let courseId = input.courseId ?? undefined;
  if (!courseId) {
    courseId = await resolveCourseFromMessage(input.user, input.message);
  }

  if (
    (intent === "quiz" || intent === "flashcards" || intent === "summary") &&
    !documentId
  ) {
    return {
      response:
        "Open a lecture document first, then ask me to generate a quiz, flashcards, or a summary from that material.",
      intent,
      requestId,
      toolsUsed: [],
    };
  }

  const sessionId = await upsertAgentSession({
    userId: input.user.id,
    documentId,
    courseId,
    intent,
    learningGoal:
      intent === "study_session" || intent === "progress" || intent === "calendar"
        ? input.message.slice(0, 180)
        : undefined,
  });

  try {
    const loop = await runAgenticToolLoop({
      requestId,
      sessionId: sessionId ?? undefined,
      userMessage: input.message,
      history: input.history,
      documentId,
      courseId,
      documentTitle: input.documentTitle,
      groundFirst: intent === "qa" || intent === "study_session",
      toolCtx: {
        user: input.user,
        documentId,
        courseId,
      },
    });

    // Safety net: calendar/timetable intents must actually save a plan, not just chat about one.
    if (
      intent === "calendar" &&
      !loop.toolsUsed.includes("createStudyTimetable") &&
      !loop.toolsUsed.includes("saveCalendarPlan")
    ) {
      const started = Date.now();
      const forced = await executeAgentTool(
        "createStudyTimetable",
        { user: input.user, documentId, courseId },
        { message: input.message, courseId }
      );
      loop.toolsUsed.push("createStudyTimetable");
      loop.toolResults.push({
        tool: "createStudyTimetable",
        ok: forced.ok,
        data: forced.data,
        error: forced.error,
      });
      await logAgentToolRun({
        sessionId,
        requestId,
        userId: input.user.id,
        toolName: "createStudyTimetable",
        workflow: "calendar_fallback",
        provider: currentLlmProviderName(),
        success: forced.ok,
        durationMs: Date.now() - started,
        retrievalCount: 0,
        error: forced.error,
      });
      if (!forced.ok) {
        return {
          response:
            forced.error ||
            "I could not save a timetable. Try again with a clear exam date, for example: “Create a 5-day study plan for my GIS exam on 25 September at 9am.”",
          intent,
          requestId,
          toolsUsed: loop.toolsUsed,
        };
      }
    }

    const failedCritical = loop.toolResults.find(
      (r) =>
        !r.ok &&
        (r.tool === "generateQuizDraft" ||
          r.tool === "generateFlashcards" ||
          r.tool === "generateSummary")
    );
    if (failedCritical) {
      return {
        response:
          failedCritical.error ||
          "I could not complete that learning action. Check that the document has readable text and try again.",
        intent,
        requestId,
        toolsUsed: loop.toolsUsed,
      };
    }

    const canned = formatToolReply(intent, loop.toolResults);
    if (canned) {
      return { response: canned, intent, requestId, toolsUsed: loop.toolsUsed };
    }

    if (
      shouldReportInsufficient(courseId, documentId, loop.retrievedChunks, loop.toolsUsed) &&
      (intent === "qa" || intent === "study_session")
    ) {
      const general = await answerBeyondNotes(input, requestId, courseId, input.documentTitle);
      return {
        response: general ?? INSUFFICIENT_COURSE_CONTEXT,
        intent,
        requestId,
        toolsUsed: loop.toolsUsed,
      };
    }

    if (loop.response.trim()) {
      return {
        response: loop.response.trim(),
        intent,
        requestId,
        toolsUsed: loop.toolsUsed,
      };
    }

    if (loop.retrievedChunks.length) {
      const preview = loop.retrievedChunks
        .slice(0, 3)
        .map((c) => c.chunk)
        .join("\n\n")
        .slice(0, 1200);
      return {
        response: `Here is what I found in your materials:\n\n${preview}`,
        intent,
        requestId,
        toolsUsed: loop.toolsUsed,
      };
    }

    return {
      response:
        "I could not produce an answer that time. Please rephrase your question or open a lecture document and try again.",
      intent,
      requestId,
      toolsUsed: loop.toolsUsed,
    };
  } catch (error) {
    console.error("[agent] Agentic loop failed", { requestId, error });
    await logAgentToolRun({
      sessionId,
      requestId,
      userId: input.user.id,
      toolName: "agentic_loop",
      workflow: intent,
      provider: "groq",
      success: false,
      durationMs: 0,
      retrievalCount: 0,
      error: error instanceof Error ? error.message : "agent failed",
    }).catch(() => undefined);

    return {
      response: "The AI service is temporarily unavailable. Please try again in a moment.",
      intent,
      requestId,
      toolsUsed: [],
    };
  }
}

/** @deprecated Kept for unit tests that still assert deterministic planning helpers. */
export { planTools } from "./planTools";
