import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiGenerateResult } from "../ai/types";
import { INSUFFICIENT_COURSE_CONTEXT, shouldReportInsufficient, runAgenticToolLoop } from "./agentLoop";

vi.mock("../ai", () => ({
  getAiService: vi.fn(),
}));

vi.mock("./llmProvider", () => ({
  currentLlmProviderName: () => "groq",
}));

vi.mock("./persist", () => ({
  logAgentToolRun: vi.fn(async () => undefined),
}));

vi.mock("./tools", () => ({
  getOpenAiToolDefinitions: vi.fn(() => [
    {
      type: "function",
      function: {
        name: "searchCourseMaterial",
        description: "search",
        parameters: { type: "object", properties: {} },
      },
    },
  ]),
  executeAgentTool: vi.fn(),
}));

import { getAiService } from "../ai";
import { executeAgentTool } from "./tools";
import type { User } from "../../drizzle/schema";

const student = { id: 7, role: "user" } as User;

function gen(partial: Partial<AiGenerateResult> & { content: string }): AiGenerateResult {
  return {
    provider: "groq",
    model: "openai/gpt-oss-20b",
    usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    latencyMs: 10,
    toolCalls: [],
    finishReason: "stop",
    ...partial,
  };
}

describe("runAgenticToolLoop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes Groq-requested tools then returns the final answer", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce(
        gen({
          content: "",
          toolCalls: [
            {
              id: "call_1",
              type: "function",
              function: {
                name: "searchCourseMaterial",
                arguments: JSON.stringify({ courseId: 2, query: "normalization" }),
              },
            },
          ],
          finishReason: "tool_calls",
        })
      )
      .mockResolvedValueOnce(gen({ content: "3NF removes transitive dependencies." }));

    vi.mocked(getAiService).mockReturnValue({ generate } as never);
    vi.mocked(executeAgentTool).mockResolvedValue({
      ok: true,
      retrievalCount: 1,
      data: {
        chunks: [
          {
            documentId: 9,
            chunk: "Third normal form removes transitive dependencies.",
            score: 0.9,
            documentTitle: "Week 3",
            courseId: 2,
          },
        ],
      },
    });

    const result = await runAgenticToolLoop({
      requestId: "req-1",
      userMessage: "Explain normalization",
      courseId: 2,
      toolCtx: { user: student, courseId: 2 },
    });

    expect(executeAgentTool).toHaveBeenCalledWith(
      "searchCourseMaterial",
      expect.objectContaining({ user: student }),
      expect.objectContaining({ courseId: 2 })
    );
    expect(result.toolsUsed).toEqual(["searchCourseMaterial"]);
    expect(result.response).toContain("3NF");
    expect(result.usedAgentic).toBe(true);
  });

  it("injects active documentId into tool args when missing", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce(
        gen({
          content: "",
          toolCalls: [
            {
              id: "call_2",
              type: "function",
              function: {
                name: "generateQuizDraft",
                arguments: JSON.stringify({ count: 5 }),
              },
            },
          ],
          finishReason: "tool_calls",
        })
      )
      .mockResolvedValueOnce(gen({ content: "Quiz created." }));

    vi.mocked(getAiService).mockReturnValue({ generate } as never);
    vi.mocked(executeAgentTool).mockResolvedValue({
      ok: true,
      data: { quizId: 1, totalQuestions: 5, documentId: 12 },
    });

    await runAgenticToolLoop({
      requestId: "req-2",
      userMessage: "Make a quiz",
      documentId: 12,
      toolCtx: { user: student, documentId: 12 },
    });

    expect(executeAgentTool).toHaveBeenCalledWith(
      "generateQuizDraft",
      expect.anything(),
      expect.objectContaining({ documentId: 12, count: 5 })
    );
  });

  it("searches the course notes before the model answers when groundFirst is set", async () => {
    const generate = vi.fn().mockResolvedValueOnce(gen({ content: "Linear regression fits a line." }));
    vi.mocked(getAiService).mockReturnValue({ generate } as never);
    vi.mocked(executeAgentTool).mockResolvedValue({
      ok: true,
      retrievalCount: 1,
      data: { chunks: [{ documentId: 9, chunk: "y = b0 + b1x", score: 0.66, documentTitle: "Week 1", courseId: 3 }] },
    });

    const result = await runAgenticToolLoop({
      requestId: "req-3",
      userMessage: "What is linear regression?",
      courseId: 3,
      groundFirst: true,
      toolCtx: { user: student, courseId: 3 },
    });

    expect(executeAgentTool).toHaveBeenCalledWith(
      "searchCourseMaterial",
      expect.anything(),
      expect.objectContaining({ courseId: 3, query: "What is linear regression?" })
    );
    const firstMessages = generate.mock.calls[0][0].messages;
    expect(firstMessages.some((m: { role: string }) => m.role === "tool")).toBe(true);
    expect(result.retrievedChunks).toHaveLength(1);
    expect(result.response).toContain("Linear regression");
  });
});

describe("shouldReportInsufficient", () => {
  it("flags empty retrieval after search tools", () => {
    expect(
      shouldReportInsufficient(2, undefined, [], ["searchCourseMaterial"])
    ).toBe(true);
  });

  it("does not flag when chunks exist", () => {
    expect(
      shouldReportInsufficient(2, undefined, [{ documentId: 1, chunk: "x", score: 0.8 }], [
        "searchCourseMaterial",
      ])
    ).toBe(false);
  });

  it("exports the shared insufficient message", () => {
    expect(INSUFFICIENT_COURSE_CONTEXT.length).toBeGreaterThan(20);
  });
});
