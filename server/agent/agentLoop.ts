import { getAiService } from "../ai";
import type { AiChatMessage, AiToolCall } from "../ai/types";
import { currentLlmProviderName } from "./llmProvider";
import { logAgentToolRun } from "./persist";
import {
  buildStudentSystemSnapshot,
  formatSnapshotForPrompt,
} from "./systemContext";
import {
  executeAgentTool,
  getOpenAiToolDefinitions,
  type ToolContext,
  type ToolResult,
} from "./tools";
import {
  INSUFFICIENT_COURSE_CONTEXT,
  MAX_TOOL_CALLS,
  type AgentChatMessage,
  type RetrievedChunk,
} from "./types";

export const MAX_AGENT_ROUNDS = 5;

export type AgenticLoopInput = {
  requestId: string;
  sessionId?: number;
  userMessage: string;
  history?: AgentChatMessage[];
  documentId?: number;
  courseId?: number;
  documentTitle?: string | null;
  toolCtx: ToolContext;
  /** Search the active document/course before the model answers, so study questions are always grounded. */
  groundFirst?: boolean;
};

export type AgenticLoopResult = {
  response: string;
  toolsUsed: string[];
  toolResults: Array<{ tool: string; ok: boolean; data?: unknown; error?: string }>;
  retrievedChunks: RetrievedChunk[];
  usedAgentic: boolean;
};

function sanitizeToolPayload(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const copy = { ...(data as Record<string, unknown>) };
  if (Array.isArray(copy.chunks)) {
    copy.chunks = (copy.chunks as RetrievedChunk[]).slice(0, 6).map((c) => ({
      documentId: c.documentId,
      documentTitle: c.documentTitle,
      score: c.score,
      chunk: String(c.chunk ?? "").slice(0, 700),
    }));
  }
  if (Array.isArray(copy.events)) {
    copy.events = (copy.events as unknown[]).slice(0, 10);
  }
  if (Array.isArray(copy.enrolledCourses)) {
    copy.enrolledCourses = (copy.enrolledCourses as unknown[]).slice(0, 8);
  }
  return copy;
}

function toolResultContent(result: ToolResult): string {
  const payload = result.ok
    ? { ok: true, data: sanitizeToolPayload(result.data) }
    : { ok: false, error: result.error || "Tool failed." };
  const json = JSON.stringify(payload);
  return json.length > 7000 ? `${json.slice(0, 7000)}…` : json;
}

function parseToolArgs(raw: string): unknown {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

function injectContextIds(args: unknown, input: AgenticLoopInput): unknown {
  const base =
    args && typeof args === "object" && !Array.isArray(args)
      ? { ...(args as Record<string, unknown>) }
      : {};
  if (input.documentId && base.documentId == null) base.documentId = input.documentId;
  if (input.courseId && base.courseId == null) base.courseId = input.courseId;
  return base;
}

function buildSystemPrompt(input: AgenticLoopInput, systemSnapshotText?: string): string {
  const lines = [
    "You are the Course-Specific AI Learning Assistant's course learning agent with authorized access to this student's data in the system.",
    "You may call tools to read the system, retrieve course material, generate quizzes/flashcards/summaries, check progress, or build study timetables.",
    "Use the system snapshot below (or getStudentSystemContext) for real courseIds, documentIds, assignments, and progress — never invent them.",
    "Ground course-specific answers in retrieved excerpts. If retrieval finds nothing relevant, say briefly that the notes do not cover it, then give an accurate general explanation.",
    "Never invent document titles, page numbers, grades, or enrollment facts.",
    "When citing notes, refer to them by document title only — never show internal IDs such as documentId or courseId.",
    "Do not reveal hidden chain-of-thought or raw tool names to the student.",
    "Prefer tools over guessing when the student asks about their materials, progress, assignments, or planner.",
    "For quiz/flashcards/summary, a documentId is required (from snapshot or active context).",
    "For course-wide RAG search, a courseId is required (from snapshot or active context).",
    "For study timetable / revision plan / exam schedule / calendar plan requests, you MUST call createStudyTimetable (do not only describe a plan in text). Pass courseId from the snapshot when available.",
  ];
  if (systemSnapshotText) {
    lines.push(systemSnapshotText);
  } else {
    if (input.documentId) {
      lines.push(
        `Active documentId: ${input.documentId}${input.documentTitle ? ` (${input.documentTitle})` : ""}. Prefer this document when relevant.`
      );
    }
    if (input.courseId) {
      lines.push(
        `Active courseId: ${input.courseId}. Use this for searchCourseMaterial and createStudyTimetable when appropriate.`
      );
    }
    if (!input.documentId && !input.courseId) {
      lines.push(
        "No active document/course and no snapshot yet. Call getStudentSystemContext or ask the student to open a lecture/course for material-specific actions."
      );
    }
  }
  return lines.join("\n");
}

/**
 * Bounded Groq tool-calling agent loop.
 * Auth and course isolation remain in executeAgentTool — never trust the model for access control.
 */
export async function runAgenticToolLoop(input: AgenticLoopInput): Promise<AgenticLoopResult> {
  const provider = currentLlmProviderName();
  const tools = getOpenAiToolDefinitions();

  let snapshotText: string | undefined;
  try {
    if (input.toolCtx.user.role === "user" || input.toolCtx.user.role === "admin") {
      const snapshot = await buildStudentSystemSnapshot(input.toolCtx.user, {
        courseId: input.courseId,
        documentId: input.documentId,
        documentTitle: input.documentTitle,
      });
      snapshotText = formatSnapshotForPrompt(snapshot);
      // If the client did not pass courseId, prefer the sole enrollment or active match.
      if (!input.courseId && snapshot.enrolledCourses.length === 1) {
        input.courseId = snapshot.enrolledCourses[0].id;
        input.toolCtx.courseId = snapshot.enrolledCourses[0].id;
      }
    }
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "agent.system_snapshot_failed",
        requestId: input.requestId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }

  const messages: AiChatMessage[] = [
    { role: "system", content: buildSystemPrompt(input, snapshotText) },
    ...(input.history ?? []).slice(-6).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: input.userMessage },
  ];

  const toolsUsed: string[] = [];
  const toolResults: AgenticLoopResult["toolResults"] = [];
  let retrievedChunks: RetrievedChunk[] = [];
  let totalToolCalls = 0;

  const runToolCall = async (call: AiToolCall, round: number) => {
    totalToolCalls += 1;
    const name = call.function?.name || "unknown";
    const args = injectContextIds(parseToolArgs(call.function?.arguments ?? "{}"), input);
    const started = Date.now();
    const result = await executeAgentTool(name, input.toolCtx, args);
    const durationMs = Date.now() - started;
    toolsUsed.push(name);
    toolResults.push({ tool: name, ok: result.ok, data: result.data, error: result.error });

    const data = result.data as { chunks?: RetrievedChunk[] } | undefined;
    if (result.ok && data?.chunks?.length) {
      retrievedChunks = data.chunks;
    }

    console.log(
      JSON.stringify({
        event: "agent.tool",
        requestId: input.requestId,
        userId: input.toolCtx.user.id,
        workflow: "agentic",
        toolName: name,
        durationMs,
        success: result.ok,
        provider,
        retrievalCount: result.retrievalCount ?? 0,
        round,
      })
    );

    await logAgentToolRun({
      sessionId: input.sessionId,
      requestId: input.requestId,
      userId: input.toolCtx.user.id,
      toolName: name,
      workflow: "agentic",
      provider,
      success: result.ok,
      durationMs,
      retrievalCount: result.retrievalCount,
      error: result.error,
    });

    messages.push({
      role: "tool",
      tool_call_id: call.id,
      name,
      content: toolResultContent(result),
    });
  };

  if (input.groundFirst && (input.documentId || input.courseId)) {
    const query = input.userMessage.trim().slice(0, 500);
    const prefetch: AiToolCall = {
      id: "prefetch-0",
      type: "function",
      function: input.documentId
        ? { name: "getMaterialContext", arguments: JSON.stringify({ documentId: input.documentId, query }) }
        : { name: "searchCourseMaterial", arguments: JSON.stringify({ courseId: input.courseId, query }) },
    };
    messages.push({ role: "assistant", content: null, tool_calls: [prefetch] });
    try {
      await runToolCall(prefetch, -1);
    } catch {
      messages.pop();
    }
  }

  for (let round = 0; round < MAX_AGENT_ROUNDS; round++) {
    const turn = await getAiService().generate({
      messages,
      tools,
      toolChoice: "auto",
      taskType: "agent",
      requestId: `${input.requestId}-r${round}`,
      maxTokens: 900,
      temperature: 0.2,
    });

    if (!turn.toolCalls?.length) {
      const text = turn.content.trim();
      if (!text && toolResults.length) {
        // Model returned empty final text after tools — synthesize from last success later.
        return {
          response: "",
          toolsUsed,
          toolResults,
          retrievedChunks,
          usedAgentic: true,
        };
      }
      return {
        response: text,
        toolsUsed,
        toolResults,
        retrievedChunks,
        usedAgentic: true,
      };
    }

    messages.push({
      role: "assistant",
      content: turn.content || null,
      tool_calls: turn.toolCalls,
    });

    for (const call of turn.toolCalls) {
      if (totalToolCalls >= MAX_TOOL_CALLS) break;
      await runToolCall(call, round);
    }

    if (totalToolCalls >= MAX_TOOL_CALLS) {
      // Force a final answer without more tools.
      const final = await getAiService().generate({
        messages: [
          ...messages,
          {
            role: "user",
            content: "Provide the final student-facing answer now. Do not call more tools.",
          },
        ],
        toolChoice: "none",
        taskType: "agent",
        requestId: `${input.requestId}-final`,
        maxTokens: 700,
        temperature: 0.2,
      });
      return {
        response: final.content.trim(),
        toolsUsed,
        toolResults,
        retrievedChunks,
        usedAgentic: true,
      };
    }
  }

  return {
    response: "",
    toolsUsed,
    toolResults,
    retrievedChunks,
    usedAgentic: true,
  };
}

export function shouldReportInsufficient(
  courseId: number | undefined,
  documentId: number | undefined,
  chunks: RetrievedChunk[],
  toolsUsed: string[]
): boolean {
  const searched = toolsUsed.some(
    (t) => t === "searchCourseMaterial" || t === "getMaterialContext"
  );
  if (!searched) return false;
  if (!courseId && !documentId) return false;
  const useful = chunks.filter((c) => c.score === 0 || c.score >= 0.22);
  return useful.length === 0;
}

export { INSUFFICIENT_COURSE_CONTEXT };
