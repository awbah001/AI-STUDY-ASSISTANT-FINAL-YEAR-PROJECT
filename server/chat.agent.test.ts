import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./agent", () => ({
  runLearningAgent: vi.fn(async () => ({
    response: "Grounded from your lecture notes.",
    intent: "qa",
    requestId: "req-1",
    toolsUsed: ["getMaterialContext"],
  })),
}));

vi.mock("./documentAccess", () => ({
  canAccessDocument: vi.fn(async () => true),
}));

vi.mock("./queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./queries")>();
  return {
    ...actual,
    getDocumentById: vi.fn(async () => ({
      id: 5,
      userId: 7,
      title: "Lecture 1",
      extractedText: "Indexes speed up lookups.",
      courseId: 2,
      fileUrl: "/x.pdf",
    })),
    createChatMessage: vi.fn(async () => ({ id: 1 })),
    getDocumentChatHistory: vi.fn(async () => []),
    createGeneralChatMessage: vi.fn(async () => ({ id: 1 })),
    getGeneralChatHistory: vi.fn(async () => []),
  };
});

vi.mock("./documentAiService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./documentAiService")>();
  return {
    ...actual,
    generateQuizForDocument: vi.fn(async () => ({ id: 3, totalQuestions: 5, title: "Quiz" })),
  };
});

import { appRouter } from "./routers";
import { runLearningAgent } from "./agent";
import * as documentAi from "./documentAiService";
import * as queries from "./queries";

function caller() {
  const user = {
    id: 7,
    openId: "student-7",
    email: "student@example.com",
    name: "Student",
    loginMethod: "password",
    role: "user" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

describe("chat.send agent integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the existing { userMessage, aiResponse } contract", async () => {
    const result = await caller().chat.send({ documentId: 5, message: "Explain indexes" });
    expect(result).toEqual({
      userMessage: "Explain indexes",
      aiResponse: "Grounded from your lecture notes.",
    });
    expect(runLearningAgent).toHaveBeenCalled();
    expect(queries.createChatMessage).toHaveBeenCalled();
  });

  it("keeps slash-command quizzes on the existing document AI path", async () => {
    const result = await caller().chat.send({ documentId: 5, message: "/quiz 5" });
    expect(documentAi.generateQuizForDocument).toHaveBeenCalledWith(5, 7, 5);
    expect(runLearningAgent).not.toHaveBeenCalled();
    expect(result.aiResponse).toContain("AI quiz");
  });

  it("routes Ask AI (documentId 0) through the agent without breaking", async () => {
    const result = await caller().chat.send({ documentId: 0, message: "What should I revise today?" });
    expect(result.userMessage).toBe("What should I revise today?");
    expect(result.aiResponse).toBe("Grounded from your lecture notes.");
    expect(runLearningAgent).toHaveBeenCalled();
  });
});
