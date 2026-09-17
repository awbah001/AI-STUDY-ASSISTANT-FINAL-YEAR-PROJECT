import { randomUUID } from "crypto";
import { classifyLearningIntent, requestedCount, type LearningIntent } from "./intents";
import { resolveCourseFromMessage } from "./access";
import { currentLlmProviderName, generateAgentText } from "./llmProvider";
import { executeAgentTool } from "./tools";
import { logAgentToolRun, upsertAgentSession } from "./persist";
import { formatStudyPlanReply, proposeCalendarDrafts } from "../calendar";
import {
  INSUFFICIENT_COURSE_CONTEXT,
  MAX_TOOL_CALLS,
  type AgentRunInput,
  type AgentRunResult,
  type RetrievedChunk,
} from "./types";

const INSUFFICIENT_SCORE = 0.22;

function chunkEvidence(chunks: RetrievedChunk[]): { text: string; sufficient: boolean } {
  const useful = chunks.filter((c) => c.score === 0 || c.score >= INSUFFICIENT_SCORE);
  const text = useful
    .slice(0, 8)
    .map((c) => {
      const src = c.documentTitle ? `Source: ${c.documentTitle}` : `Document ${c.documentId}`;
      return `${src}\n${c.chunk.slice(0, 900)}`;
    })
    .join("\n\n---\n\n");
  return { text, sufficient: useful.length > 0 && text.trim().length > 40 };
}

export function planTools(
  intent: LearningIntent,
  input: AgentRunInput,
  courseId?: number
): Array<{ name: string; args: unknown }> {
  const documentId = input.documentId && input.documentId > 0 ? input.documentId : undefined;
  const countQuiz = requestedCount(input.message, 5, 3, 20);
  const countCards = requestedCount(input.message, 10, 3, 30);

  switch (intent) {
    case "quiz":
      return documentId ? [{ name: "generateQuizDraft", args: { documentId, count: countQuiz } }] : [];
    case "flashcards":
      return documentId ? [{ name: "generateFlashcards", args: { documentId, count: countCards } }] : [];
    case "summary":
      return documentId ? [{ name: "generateSummary", args: { documentId } }] : [];
    case "assignment":
      return [{ name: "getAssignmentContext", args: { courseId } }];
    case "progress":
      return [
        { name: "getLearningProgress", args: { documentId } },
        { name: "createStudyPlan", args: { courseId } },
      ];
    case "study_session":
      return [
        courseId
          ? { name: "searchCourseMaterial", args: { courseId, query: input.message } }
          : documentId
            ? { name: "getMaterialContext", args: { documentId, query: input.message } }
            : { name: "getLearningProgress", args: {} },
        { name: "createStudyPlan", args: { courseId } },
        ...(documentId ? [{ name: "recordStudyActivity", args: { documentId, activityType: "chat" as const } }] : []),
      ];
    case "calendar":
      return [
        { name: "getLearningProgress", args: { documentId } },
        { name: "createStudyPlan", args: { courseId } },
        { name: "listCalendarEvents", args: {} },
      ];
    case "qa":
      if (courseId && !documentId) {
        return [{ name: "searchCourseMaterial", args: { courseId, query: input.message } }];
      }
      if (documentId) {
        return [{ name: "getMaterialContext", args: { documentId, query: input.message } }];
      }
      return [];
    default:
      if (documentId) {
        return [{ name: "getMaterialContext", args: { documentId, query: input.message } }];
      }
      return [];
  }
}

function formatToolReply(intent: LearningIntent, results: Array<{ tool: string; ok: boolean; data?: unknown; error?: string }>): string | null {
  const lastOk = [...results].reverse().find((r) => r.ok);
  if (!lastOk?.data || typeof lastOk.data !== "object") return null;
  const data = lastOk.data as Record<string, unknown>;

  if (intent === "quiz" && lastOk.tool === "generateQuizDraft") {
    return `I've created a new **AI quiz** (${data.totalQuestions ?? "several"} questions). Open the **Quizzes** tab to take it.`;
  }
  if (intent === "flashcards" && lastOk.tool === "generateFlashcards") {
    return `I've added **${data.created ?? 0} AI flashcards**. Open the **Flashcards** tab to study them.`;
  }
  if (intent === "summary" && lastOk.tool === "generateSummary") {
    return "I've generated an **AI summary** of this document. Open the **AI Actions** tab to read it.";
  }
  if (intent === "calendar" && lastOk.tool === "saveCalendarPlan") {
    const events = Array.isArray(data.events)
      ? data.events as Array<{ title: string; type: string; startsAt: string | number; notes?: string | null }>
      : [];
    if (events.length) return formatStudyPlanReply(events);
    return `I've added **${data.created ?? 0} items** to your calendar. Open **Planner** to review the timetable.`;
  }
  return null;
}

export async function runLearningAgent(input: AgentRunInput): Promise<AgentRunResult> {
  const requestId = randomUUID();
  const intent = classifyLearningIntent(input.message);
  const documentId = input.documentId && input.documentId > 0 ? input.documentId : undefined;
  let courseId = input.courseId ?? undefined;
  if (!courseId) {
    courseId = await resolveCourseFromMessage(input.user, input.message);
  }

  if ((intent === "quiz" || intent === "flashcards" || intent === "summary") && !documentId) {
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

  const provider = currentLlmProviderName();
  const planned = planTools(intent, input, courseId)
    .filter((step) => {
      const args = step.args as { courseId?: number; documentId?: number };
      if (step.name === "searchCourseMaterial" && !args.courseId) return false;
      if (
        (step.name === "getMaterialContext" ||
          step.name === "generateQuizDraft" ||
          step.name === "generateFlashcards" ||
          step.name === "generateSummary") &&
        !args.documentId
      ) {
        return false;
      }
      return true;
    })
    .slice(0, MAX_TOOL_CALLS);
  const toolResults: Array<{ tool: string; ok: boolean; data?: unknown; error?: string }> = [];
  let retrievedChunks: RetrievedChunk[] = [];
  const toolsUsed: string[] = [];

  for (const step of planned) {
    const started = Date.now();
    const result = await executeAgentTool(step.name, {
      user: input.user,
      documentId,
      courseId,
    }, step.args);
    const durationMs = Date.now() - started;
    toolsUsed.push(step.name);
    toolResults.push({ tool: step.name, ok: result.ok, data: result.data, error: result.error });

    const data = result.data as { chunks?: RetrievedChunk[] } | undefined;
    if (result.ok && data?.chunks?.length) {
      retrievedChunks = data.chunks;
    }

    console.log(
      JSON.stringify({
        event: "agent.tool",
        requestId,
        userId: input.user.id,
        workflow: intent,
        toolName: step.name,
        durationMs,
        success: result.ok,
        provider,
        retrievalCount: result.retrievalCount ?? 0,
      })
    );

    await logAgentToolRun({
      sessionId,
      requestId,
      userId: input.user.id,
      toolName: step.name,
      workflow: intent,
      provider,
      success: result.ok,
      durationMs,
      retrievalCount: result.retrievalCount,
      error: result.error,
    });

    if (!result.ok && (intent === "quiz" || intent === "flashcards" || intent === "summary")) {
      return {
        response: result.error || "I could not complete that learning action. Check that the document has readable text and try again.",
        intent,
        requestId,
        toolsUsed,
      };
    }
  }

  if (intent === "calendar") {
    const digest = toolResults
      .filter((r) => r.ok)
      .map((r) => `${r.tool}: ${JSON.stringify(r.data).slice(0, 500)}`)
      .join("\n");
    const drafts = await proposeCalendarDrafts(input.message, digest);
    const started = Date.now();
    const saved = await executeAgentTool("saveCalendarPlan", {
      user: input.user,
      documentId,
      courseId,
    }, { events: drafts });
    toolsUsed.push("saveCalendarPlan");
    toolResults.push({ tool: "saveCalendarPlan", ok: saved.ok, data: saved.data, error: saved.error });
    await logAgentToolRun({
      sessionId,
      requestId,
      userId: input.user.id,
      toolName: "saveCalendarPlan",
      workflow: intent,
      provider,
      success: saved.ok,
      durationMs: Date.now() - started,
      retrievalCount: 0,
      error: saved.error,
    });
    const cannedCalendar = formatToolReply(intent, toolResults);
    if (cannedCalendar) {
      return { response: cannedCalendar, intent, requestId, toolsUsed };
    }
    if (!saved.ok) {
      return {
        response:
          "I could not save that timetable. Try again with a clear exam date, for example: “Create a 5-day plan for my GIS exam on 20 September at 9am.”",
        intent,
        requestId,
        toolsUsed,
      };
    }
  }

  const canned = formatToolReply(intent, toolResults);
  if (canned) {
    return { response: canned, intent, requestId, toolsUsed };
  }

  const evidence = chunkEvidence(retrievedChunks);
  const needsGrounding = intent === "qa" || intent === "study_session";

  if (needsGrounding && (courseId || documentId) && !evidence.sufficient) {
    return { response: INSUFFICIENT_COURSE_CONTEXT, intent, requestId, toolsUsed };
  }

  const history = (input.history ?? []).slice(-6);
  const toolDigest = toolResults
    .map((r) => {
      if (!r.ok) return `${r.tool} failed`;
      const data = r.data && typeof r.data === "object" ? { ...(r.data as Record<string, unknown>) } : {};
      delete data.chunks;
      return `${r.tool}: ${JSON.stringify(data).slice(0, 800)}`;
    })
    .join("\n");

  try {
    const { text } = await generateAgentText(
      [
        {
          role: "system",
          content:
            "You are Cognify's course learning assistant. Be concise and educational. Never invent page numbers or document titles. If course excerpts are provided, ground the answer in them and name only those titles. If the student asked for a general explanation with no excerpts, say so clearly. Do not reveal hidden reasoning or tool names.",
        },
        ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        {
          role: "user",
          content: [
            `Student request: ${input.message}`,
            evidence.sufficient ? `Course excerpts:\n${evidence.text}` : "No course excerpts were retrieved.",
            toolDigest ? `Internal notes (do not quote tool names): ${toolDigest}` : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
      intent === "study_session" ? 700 : 512
    );
    return { response: text, intent, requestId, toolsUsed };
  } catch (error) {
    console.error("[agent] LLM failed", { requestId, error });
    if (evidence.sufficient) {
      return {
        response: `Here is what I found in your materials:\n\n${evidence.text.slice(0, 1200)}`,
        intent,
        requestId,
        toolsUsed,
      };
    }
    return {
      response:
        "Something went wrong while running the AI. Check that LM Studio is running with a model loaded, then try again.",
      intent,
      requestId,
      toolsUsed,
    };
  }
}
