import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../../drizzle/schema";
import { INSUFFICIENT_COURSE_CONTEXT } from "./types";

vi.mock("./persist", () => ({
  upsertAgentSession: vi.fn(async () => 11),
  logAgentToolRun: vi.fn(async () => undefined),
}));

vi.mock("./llmProvider", () => ({
  currentLlmProviderName: () => "lm-studio",
  generateAgentText: vi.fn(async () => ({ text: "Normalization organizes attributes to reduce redundancy." })),
}));

vi.mock("./access", () => ({
  resolveCourseFromMessage: vi.fn(async () => 2),
  assertCourseAccess: vi.fn(),
  assertDocumentToolAccess: vi.fn(),
}));

vi.mock("./tools", () => ({
  executeAgentTool: vi.fn(),
}));

import { runLearningAgent } from "./orchestrator";
import { executeAgentTool } from "./tools";
import { generateAgentText } from "./llmProvider";

const student = { id: 7, role: "user" } as User;

describe("runLearningAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("grounds a course-specific question in retrieved chunks", async () => {
    vi.mocked(executeAgentTool).mockResolvedValue({
      ok: true,
      retrievalCount: 1,
      data: {
        chunks: [
          {
            documentId: 9,
            chunk: "Third normal form removes transitive dependencies.",
            score: 0.91,
            documentTitle: "CSC 302 Week 3",
            courseId: 2,
          },
        ],
      },
    });

    const result = await runLearningAgent({
      user: student,
      message: "Explain database normalization using my CSC 302 materials.",
    });

    expect(executeAgentTool).toHaveBeenCalledWith(
      "searchCourseMaterial",
      expect.objectContaining({ user: student, courseId: 2 }),
      expect.objectContaining({ courseId: 2 })
    );
    expect(generateAgentText).toHaveBeenCalled();
    expect(result.response).toContain("Normalization");
    expect(result.intent).toBe("qa");
    expect(result.toolsUsed).toEqual(["searchCourseMaterial"]);
  });

  it("explains when retrieval is insufficient", async () => {
    vi.mocked(executeAgentTool).mockResolvedValue({
      ok: true,
      retrievalCount: 0,
      data: { insufficient: true, chunks: [] },
    });

    const result = await runLearningAgent({
      user: student,
      message: "Explain database normalization using my CSC 302 materials.",
    });

    expect(result.response).toBe(INSUFFICIENT_COURSE_CONTEXT);
    expect(generateAgentText).not.toHaveBeenCalled();
  });

  it("returns the existing quiz save message after generateQuizDraft", async () => {
    vi.mocked(executeAgentTool).mockResolvedValue({
      ok: true,
      data: { quizId: 44, totalQuestions: 10, documentId: 5 },
    });

    const result = await runLearningAgent({
      user: student,
      message: "Generate 10 questions from this lecture.",
      documentId: 5,
    });

    expect(executeAgentTool).toHaveBeenCalledWith(
      "generateQuizDraft",
      expect.anything(),
      expect.objectContaining({ documentId: 5, count: 10 })
    );
    expect(result.response).toContain("AI quiz");
    expect(result.response).toContain("10");
  });

  it("returns the flashcard save message", async () => {
    vi.mocked(executeAgentTool).mockResolvedValue({
      ok: true,
      data: { created: 8, existingBefore: 2, documentId: 5 },
    });

    const result = await runLearningAgent({
      user: student,
      message: "Create flashcards from this document.",
      documentId: 5,
    });

    expect(result.response).toContain("8 AI flashcards");
  });

  it("uses progress tools for revision advice", async () => {
    vi.mocked(executeAgentTool).mockResolvedValue({
      ok: true,
      data: { weakerAreas: [{ documentId: 5, title: "ER diagrams", averageQuizScore: 40 }] },
    });

    const result = await runLearningAgent({
      user: student,
      message: "What should I revise today?",
    });

    expect(result.toolsUsed).toContain("getLearningProgress");
    expect(result.toolsUsed).toContain("createStudyPlan");
    expect(result.toolsUsed.length).toBeLessThanOrEqual(4);
    expect(generateAgentText).toHaveBeenCalled();
    expect(result.response.length).toBeGreaterThan(0);
  });

  it("surfaces unauthorized material errors from tools", async () => {
    vi.mocked(executeAgentTool).mockResolvedValue({
      ok: false,
      error: "You do not have access to this material.",
    });

    const result = await runLearningAgent({
      user: student,
      message: "Generate 5 questions from this lecture.",
      documentId: 99,
    });

    expect(result.response).toBe("You do not have access to this material.");
  });

  it("falls back when the LLM provider fails", async () => {
    vi.mocked(executeAgentTool).mockResolvedValue({ ok: true, data: {} });
    vi.mocked(generateAgentText).mockRejectedValueOnce(new Error("provider down"));

    const result = await runLearningAgent({
      user: student,
      message: "Hello there",
    });

    expect(result.response).toMatch(/LM Studio/i);
  });
});
