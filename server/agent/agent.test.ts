import { describe, expect, it } from "vitest";
import { classifyLearningIntent, requestedCount } from "./intents";
import { planTools } from "./orchestrator";
import { MAX_TOOL_CALLS } from "./types";
import type { User } from "../../drizzle/schema";
import { validateFlashcards, validateQuizQuestions } from "./structured";
import { executeAgentTool, getAgentTool, getOpenAiToolDefinitions } from "./tools";
import { currentLlmProviderName } from "./llmProvider";
import { formatSnapshotForPrompt, type StudentSystemSnapshot } from "./systemContext";

const student = {
  id: 7,
  role: "user",
} as User;

describe("classifyLearningIntent", () => {
  it("classifies course question answering", () => {
    expect(classifyLearningIntent("Explain database normalization using my CSC 302 materials.")).toBe("qa");
  });

  it("classifies guided study sessions", () => {
    expect(classifyLearningIntent("Help me prepare for my database exam tomorrow.")).toBe("study_session");
  });

  it("classifies quiz generation", () => {
    expect(classifyLearningIntent("Generate 10 questions from this lecture.")).toBe("quiz");
  });

  it("classifies flashcard generation", () => {
    expect(classifyLearningIntent("Create flashcards from this document.")).toBe("flashcards");
  });

  it("classifies progress-aware revision", () => {
    expect(classifyLearningIntent("What should I revise today?")).toBe("progress");
  });

  it("classifies assignment help", () => {
    expect(classifyLearningIntent("Explain what I need to do for this assignment.")).toBe("assignment");
  });

  it("classifies exam timetable requests", () => {
    expect(classifyLearningIntent("Create a timetable for my upcoming GIS exam.")).toBe("calendar");
    expect(classifyLearningIntent("Remind me about my quiz next week")).toBe("calendar");
  });

  it("falls back to general for greetings", () => {
    expect(classifyLearningIntent("Hello")).toBe("general");
  });
});

describe("requestedCount", () => {
  it("clamps extracted counts", () => {
    expect(requestedCount("Generate 10 questions", 5, 3, 20)).toBe(10);
    expect(requestedCount("Generate 99 questions", 5, 3, 20)).toBe(20);
    expect(requestedCount("Generate questions", 5, 3, 20)).toBe(5);
  });
});

describe("planTools", () => {
  it("selects course search for QA when only a course is known", () => {
    const steps = planTools("qa", { user: student, message: "Explain indexing", documentId: 0 }, 3);
    expect(steps).toEqual([{ name: "searchCourseMaterial", args: { courseId: 3, query: "Explain indexing" } }]);
  });

  it("selects quiz generation for a document", () => {
    const steps = planTools("quiz", { user: student, message: "Generate 8 questions", documentId: 12 }, 2);
    expect(steps[0]?.name).toBe("generateQuizDraft");
    expect((steps[0]?.args as { count: number }).count).toBe(8);
  });

  it("stays within the tool-call budget", () => {
    const steps = planTools(
      "study_session",
      { user: student, message: "Help me study", documentId: 4 },
      2
    );
    expect(steps.length).toBeLessThanOrEqual(MAX_TOOL_CALLS);
  });

  it("plans calendar tools without document access", () => {
    const steps = planTools("calendar", { user: student, message: "Plan my exam timetable", documentId: 0 });
    expect(steps.map((s) => s.name)).toEqual(["getLearningProgress", "createStudyPlan", "listCalendarEvents"]);
  });
});

describe("structured validation", () => {
  it("keeps well-formed quiz questions", () => {
    const valid = validateQuizQuestions([
      {
        question: "What is 3NF?",
        options: ["A normal form", "A network protocol", "A sorting algorithm", "A lock"],
        correctAnswer: "A normal form",
        explanation: "Third normal form.",
      },
    ]);
    expect(valid).toHaveLength(1);
  });

  it("accepts object-shaped options and letter answers from small models", () => {
    const valid = validateQuizQuestions({
      questions: [
        {
          question: "What is GIS?",
          options: {
            A: "A geographic information system",
            B: "A graphics editor",
            C: "A satellite brand",
            D: "A database lock",
          },
          correctAnswer: "A",
        },
      ],
    });
    expect(valid).toHaveLength(1);
    expect(valid[0].options).toHaveLength(4);
    expect(valid[0].correctAnswer).toBe("A geographic information system");
  });

  it("drops letter-only options that are not real answers", () => {
    const valid = validateQuizQuestions([
      {
        question: "What is 3NF?",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
      },
    ]);
    expect(valid).toHaveLength(0);
  });

  it("drops quizzes whose answer is not in the options", () => {
    const valid = validateQuizQuestions([
      {
        question: "What is 3NF?",
        options: ["Alpha", "Beta"],
        correctAnswer: "Gamma",
      },
    ]);
    expect(valid).toHaveLength(0);
  });

  it("deduplicates flashcards", () => {
    const cards = validateFlashcards([
      { question: "What is SQL?", answer: "A query language" },
      { question: "What is SQL?", answer: "Duplicate" },
      { question: "Hi", answer: "" },
    ]);
    expect(cards).toEqual([{ question: "What is SQL?", answer: "A query language" }]);
  });
});

describe("executeAgentTool", () => {
  it("rejects unknown tools", async () => {
    const result = await executeAgentTool("dropDatabase", { user: student }, {});
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Unknown tool/);
  });

  it("rejects invalid tool arguments", async () => {
    const result = await executeAgentTool("searchCourseMaterial", { user: student }, { courseId: "csc", query: "x" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Invalid tool arguments.");
  });
});

describe("LLM provider selection", () => {
  it("defaults to groq", () => {
    expect(currentLlmProviderName()).toBe("groq");
  });
});

describe("system context", () => {
  it("formats an authorized snapshot for the agent prompt", () => {
    const snapshot: StudentSystemSnapshot = {
      generatedAt: "2026-09-24T12:00:00.000Z",
      active: { courseId: 2, documentId: 9, documentTitle: "Week 1" },
      enrolledCourses: [
        {
          id: 2,
          code: "GIS101",
          title: "Intro GIS",
          subject: "Geography",
          documentCount: 1,
          documents: [{ id: 9, title: "Week 1" }],
          upcomingAssignments: [{ id: 1, title: "Lab 1", dueDate: "2026-09-30T00:00:00.000Z" }],
        },
      ],
      progress: {
        weakerAreas: [
          { documentId: 9, title: "Week 1", averageQuizScore: 55, quizzesAttempted: 2 },
        ],
        recentDocuments: [],
      },
      upcomingCalendar: [
        { id: 3, title: "GIS exam", type: "exam", startsAt: "2026-10-01T09:00:00.000Z" },
      ],
    };
    const text = formatSnapshotForPrompt(snapshot);
    expect(text).toContain("courseId=2");
    expect(text).toContain("doc 9");
    expect(text).toContain("Lab 1");
    expect(text).toContain("Weaker areas");
    expect(text).toContain("GIS exam");
  });

  it("registers getStudentSystemContext as a callable tool", () => {
    expect(getAgentTool("getStudentSystemContext")?.name).toBe("getStudentSystemContext");
    expect(getOpenAiToolDefinitions().some((t) => t.function.name === "getStudentSystemContext")).toBe(
      true
    );
  });
});
