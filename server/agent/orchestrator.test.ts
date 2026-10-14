import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../../drizzle/schema";
import { INSUFFICIENT_COURSE_CONTEXT } from "./types";

vi.mock("./persist", () => ({
  upsertAgentSession: vi.fn(async () => 11),
  logAgentToolRun: vi.fn(async () => undefined),
}));

vi.mock("./access", () => ({
  resolveCourseFromMessage: vi.fn(async () => 2),
  assertCourseAccess: vi.fn(),
  assertDocumentToolAccess: vi.fn(),
}));

vi.mock("./agentLoop", () => ({
  runAgenticToolLoop: vi.fn(),
  shouldReportInsufficient: vi.fn(
    (
      _courseId: number | undefined,
      _documentId: number | undefined,
      chunks: Array<{ score: number }>,
      toolsUsed: string[]
    ) => {
      const searched = toolsUsed.some(
        (t) => t === "searchCourseMaterial" || t === "getMaterialContext"
      );
      return searched && chunks.filter((c) => c.score === 0 || c.score >= 0.22).length === 0;
    }
  ),
}));

const generateMock = vi.fn();
vi.mock("../ai", () => ({ getAiService: () => ({ generate: generateMock }) }));

vi.mock("../lecturerQueries", () => ({
  getStudentCourseDocuments: vi.fn(async () => [{ id: 9, title: "Week 1" }]),
}));

import { runLearningAgent } from "./orchestrator";
import { runAgenticToolLoop } from "./agentLoop";

const student = { id: 7, role: "user" } as User;

describe("runLearningAgent (agentic)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("grounds a course-specific question using agentic tool results", async () => {
    vi.mocked(runAgenticToolLoop).mockResolvedValue({
      response: "Normalization organizes attributes to reduce redundancy.",
      toolsUsed: ["searchCourseMaterial"],
      toolResults: [
        {
          tool: "searchCourseMaterial",
          ok: true,
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
        },
      ],
      retrievedChunks: [
        {
          documentId: 9,
          chunk: "Third normal form removes transitive dependencies.",
          score: 0.91,
          documentTitle: "CSC 302 Week 3",
          courseId: 2,
        },
      ],
      usedAgentic: true,
    });

    const result = await runLearningAgent({
      user: student,
      message: "Explain database normalization using my CSC 302 materials.",
    });

    expect(runAgenticToolLoop).toHaveBeenCalled();
    expect(result.response).toContain("Normalization");
    expect(result.intent).toBe("qa");
    expect(result.toolsUsed).toEqual(["searchCourseMaterial"]);
  });

  it("gives a labelled general answer when the notes do not cover the question", async () => {
    vi.mocked(runAgenticToolLoop).mockResolvedValue({
      response: "I could invent an answer but should not.",
      toolsUsed: ["searchCourseMaterial"],
      toolResults: [{ tool: "searchCourseMaterial", ok: true, data: { insufficient: true, chunks: [] } }],
      retrievedChunks: [],
      usedAgentic: true,
    });
    generateMock.mockResolvedValueOnce({ content: "Artificial intelligence is the study of machines that learn." });

    const result = await runLearningAgent({
      user: student,
      message: "What is artificial intelligence?",
    });

    expect(result.response).toMatch(/notes \(Week 1\) don't cover this directly/);
    expect(result.response).toContain("Artificial intelligence is the study");
  });

  it("falls back to the insufficient-context message if the general answer fails", async () => {
    vi.mocked(runAgenticToolLoop).mockResolvedValue({
      response: "",
      toolsUsed: ["searchCourseMaterial"],
      toolResults: [{ tool: "searchCourseMaterial", ok: true, data: { insufficient: true, chunks: [] } }],
      retrievedChunks: [],
      usedAgentic: true,
    });
    generateMock.mockRejectedValueOnce(new Error("provider down"));

    const result = await runLearningAgent({
      user: student,
      message: "Explain database normalization using my CSC 302 materials.",
    });

    expect(result.response).toBe(INSUFFICIENT_COURSE_CONTEXT);
  });

  it("returns the quiz save message after generateQuizDraft", async () => {
    vi.mocked(runAgenticToolLoop).mockResolvedValue({
      response: "Quiz ready.",
      toolsUsed: ["generateQuizDraft"],
      toolResults: [
        { tool: "generateQuizDraft", ok: true, data: { quizId: 44, totalQuestions: 10, documentId: 5 } },
      ],
      retrievedChunks: [],
      usedAgentic: true,
    });

    const result = await runLearningAgent({
      user: student,
      message: "Generate 10 questions from this lecture.",
      documentId: 5,
    });

    expect(result.response).toContain("AI quiz");
    expect(result.response).toContain("10");
  });

  it("returns the flashcard save message", async () => {
    vi.mocked(runAgenticToolLoop).mockResolvedValue({
      response: "Cards ready.",
      toolsUsed: ["generateFlashcards"],
      toolResults: [
        { tool: "generateFlashcards", ok: true, data: { created: 8, existingBefore: 2, documentId: 5 } },
      ],
      retrievedChunks: [],
      usedAgentic: true,
    });

    const result = await runLearningAgent({
      user: student,
      message: "Create flashcards from this document.",
      documentId: 5,
    });

    expect(result.response).toContain("8 AI flashcards");
  });

  it("uses agentic progress tools for revision advice", async () => {
    vi.mocked(runAgenticToolLoop).mockResolvedValue({
      response: "Focus on ER diagrams next.",
      toolsUsed: ["getLearningProgress", "createStudyPlan"],
      toolResults: [
        {
          tool: "getLearningProgress",
          ok: true,
          data: { weakerAreas: [{ documentId: 5, title: "ER diagrams", averageQuizScore: 40 }] },
        },
        { tool: "createStudyPlan", ok: true, data: {} },
      ],
      retrievedChunks: [],
      usedAgentic: true,
    });

    const result = await runLearningAgent({
      user: student,
      message: "What should I revise today?",
    });

    expect(result.toolsUsed).toContain("getLearningProgress");
    expect(result.toolsUsed).toContain("createStudyPlan");
    expect(result.response).toContain("ER diagrams");
  });

  it("surfaces unauthorized material errors from tools", async () => {
    vi.mocked(runAgenticToolLoop).mockResolvedValue({
      response: "",
      toolsUsed: ["generateQuizDraft"],
      toolResults: [
        { tool: "generateQuizDraft", ok: false, error: "You do not have access to this material." },
      ],
      retrievedChunks: [],
      usedAgentic: true,
    });

    const result = await runLearningAgent({
      user: student,
      message: "Generate 5 questions from this lecture.",
      documentId: 99,
    });

    expect(result.response).toBe("You do not have access to this material.");
  });

  it("falls back when the agentic loop fails", async () => {
    vi.mocked(runAgenticToolLoop).mockRejectedValueOnce(new Error("provider down"));

    const result = await runLearningAgent({
      user: student,
      message: "Hello there",
    });

    expect(result.response).toMatch(/temporarily unavailable|try again/i);
  });

  it("shows the timetable's schedule assumptions instead of a model-written plan", async () => {
    vi.mocked(runAgenticToolLoop).mockResolvedValue({
      response: "An unsupported generic plan", toolsUsed: ["createStudyTimetable"], retrievedChunks: [], usedAgentic: true,
      toolResults: [{ tool: "createStudyTimetable", ok: true, data: {
        events: [{ title: "OSI model", type: "study", startsAt: "2026-10-14T18:00:00Z", notes: "Compare the seven layers." }],
        assumptions: ["Study sessions start at 18:00 UTC."],
      } }],
    });
    const message = "generate a study timetable for the resources provided";
    const result = await runLearningAgent({ user: student, message });
    expect(result.response).toContain("OSI model");
    expect(result.response).toContain("Schedule assumptions: Study sessions start at 18:00 UTC.");
    expect(result.response).not.toContain("unsupported generic plan");
    expect(vi.mocked(runAgenticToolLoop).mock.calls.at(-1)?.[0].toolCtx.requestMessage).toBe(message);
  });

  it("asks for missing assessment details without claiming a timetable was saved", async () => {
    vi.mocked(runAgenticToolLoop).mockResolvedValue({
      response: "A fabricated saved plan", toolsUsed: ["createStudyTimetable"], retrievedChunks: [], usedAgentic: true,
      toolResults: [{ tool: "createStudyTimetable", ok: false, error: "What date is your assessment?" }],
    });
    const result = await runLearningAgent({ user: student, message: "Create a study timetable for my exam" });
    expect(result.response).toBe("What date is your assessment?");
  });
});
