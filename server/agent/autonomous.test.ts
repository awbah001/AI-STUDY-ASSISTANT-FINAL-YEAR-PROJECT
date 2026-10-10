import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiGenerateResult } from "../ai/types";
import type { User } from "../../drizzle/schema";

vi.mock("../ai", () => ({ getAiService: vi.fn() }));
vi.mock("./tools", () => ({ executeAgentTool: vi.fn() }));
vi.mock("../queries", () => ({ createNotification: vi.fn(async () => ({ id: 1 })) }));
vi.mock("../pushNotifications", () => ({ sendPushNotifications: vi.fn(async () => undefined) }));

import { getAiService } from "../ai";
import { createNotification } from "../queries";
import { executeAgentTool } from "./tools";
import {
  decideAndAct,
  fallbackNotification,
  filterFreshSignals,
  normalizeAutonomousSettings,
  notificationLink,
  type AutonomousSignal,
} from "./autonomous";

const student = { id: 7, role: "user", name: "Aminata Kamara", expoPushToken: null } as User;
const HOUR = 60 * 60 * 1000;

function gen(partial: Partial<AiGenerateResult> & { content: string }): AiGenerateResult {
  return {
    provider: "groq",
    model: "test",
    usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    latencyMs: 5,
    toolCalls: [],
    finishReason: "stop",
    ...partial,
  };
}

function call(id: string, name: string, args: Record<string, unknown>) {
  return { id, type: "function" as const, function: { name, arguments: JSON.stringify(args) } };
}

const newMaterial: AutonomousSignal = {
  key: "new_material:12",
  kind: "new_material",
  priority: 3,
  documentId: 12,
  documentTitle: "Week 3",
  summary: 'New lecture material "Week 3" (documentId 12) was added.',
};
const deadline: AutonomousSignal = {
  key: "deadline:4",
  kind: "deadline",
  priority: 1,
  summary: 'Assignment "Essay" is due tomorrow and has not been submitted.',
};

const allowAll = { allowContent: true, flashcardsEnabled: true, quizzesEnabled: true };

describe("filterFreshSignals", () => {
  const now = Date.now();

  it("drops signals seen within their cooldown and keeps older ones", () => {
    const runs = [
      { createdAt: now - 2 * HOUR, signals: [{ key: "deadline:4", kind: "deadline" }] },
      { createdAt: now - 30 * HOUR, signals: [{ key: "due_flashcards", kind: "due_flashcards" }] },
    ];
    const due: AutonomousSignal = { key: "due_flashcards", kind: "due_flashcards", priority: 4, summary: "10 due" };
    const result = filterFreshSignals([deadline, due, newMaterial], runs, now);
    expect(result.map((s) => s.key)).toEqual(["new_material:12", "due_flashcards"]);
  });

  it("orders by priority and caps the number of signals", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      key: `weak_topic:${i}`,
      kind: "weak_topic" as const,
      priority: 8 - i,
      summary: "weak",
    }));
    const result = filterFreshSignals(many, [], now);
    expect(result).toHaveLength(5);
    expect(result[0].priority).toBe(1);
  });
});

describe("helpers", () => {
  it("builds web links for notification targets", () => {
    expect(notificationLink("document", 12)).toBe("/document/12");
    expect(notificationLink("document")).toBe("/student/courses");
    expect(notificationLink("flashcards")).toBe("/student/flashcards");
  });

  it("clamps admin settings to safe ranges", () => {
    expect(normalizeAutonomousSettings({ intervalHours: 0.2, maxStudentsPerSweep: 5000 })).toMatchObject({
      intervalHours: 1,
      maxStudentsPerSweep: 200,
    });
  });

  it("writes a plain reminder for every signal kind", () => {
    expect(fallbackNotification(newMaterial)).toMatchObject({ target: "document", documentId: 12 });
    expect(fallbackNotification(deadline).target).toBe("courses");
  });
});

describe("decideAndAct", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates material chosen by the model and notifies the student", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce(gen({ content: "", toolCalls: [call("c1", "generateFlashcards", { documentId: 12, count: 8 })] }))
      .mockResolvedValueOnce(
        gen({
          content: "",
          toolCalls: [call("c2", "sendNotification", { title: "Flashcards ready", body: "8 cards from Week 3 are waiting.", target: "flashcards" })],
        })
      )
      .mockResolvedValueOnce(gen({ content: "Made Week 3 flashcards and told the student." }));
    vi.mocked(getAiService).mockReturnValue({ generate } as never);
    vi.mocked(executeAgentTool).mockResolvedValue({ ok: true, data: { created: 8 } });

    const result = await decideAndAct(student, [newMaterial], allowAll);

    expect(executeAgentTool).toHaveBeenCalledWith("generateFlashcards", { user: student, documentId: 12 }, { documentId: 12, count: 8 });
    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createNotification).mock.calls[0][0]).toMatchObject({
      userId: 7,
      title: "Flashcards ready",
      data: { type: "ai_coach", target: "flashcards", link: "/student/flashcards" },
    });
    expect(result.summary).toBe("Made Week 3 flashcards and told the student.");
    expect(result.actions.map((a) => a.type)).toEqual(["flashcards", "notification"]);
  });

  it("refuses documents that are not in the signals and allows only one creation", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce(
        gen({
          content: "",
          toolCalls: [
            call("c1", "generateQuiz", { documentId: 99 }),
            call("c2", "generateQuiz", { documentId: 12 }),
            call("c3", "generateFlashcards", { documentId: 12 }),
          ],
        })
      )
      .mockResolvedValueOnce(gen({ content: "Done." }));
    vi.mocked(getAiService).mockReturnValue({ generate } as never);
    vi.mocked(executeAgentTool).mockResolvedValue({ ok: true, data: { totalQuestions: 5 } });

    const result = await decideAndAct(student, [newMaterial], allowAll);

    expect(executeAgentTool).toHaveBeenCalledTimes(1);
    expect(executeAgentTool).toHaveBeenCalledWith("generateQuizDraft", expect.anything(), { documentId: 12, count: 5 });
    // The model never announced the quiz, so the agent does it.
    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(result.actions.at(-1)).toMatchObject({ type: "notification", detail: "A practice quiz is ready" });
  });

  it("offers no creation tools when the admin allows notifications only", async () => {
    const generate = vi.fn().mockResolvedValueOnce(gen({ content: "Nothing to do." }));
    vi.mocked(getAiService).mockReturnValue({ generate } as never);

    await decideAndAct(student, [newMaterial], { ...allowAll, allowContent: false });

    const tools = generate.mock.calls[0][0].tools.map((t: { function: { name: string } }) => t.function.name);
    expect(tools).toEqual(["sendNotification"]);
  });

  it("caps notifications per run", async () => {
    const note = (id: string) => call(id, "sendNotification", { title: "Heads up", body: "Your essay is due tomorrow.", target: "courses" });
    const generate = vi
      .fn()
      .mockResolvedValueOnce(gen({ content: "", toolCalls: [note("a"), note("b"), note("c")] }))
      .mockResolvedValueOnce(gen({ content: "Reminded the student." }));
    vi.mocked(getAiService).mockReturnValue({ generate } as never);

    const result = await decideAndAct(student, [deadline], allowAll);

    expect(createNotification).toHaveBeenCalledTimes(2);
    expect(result.actions.filter((a) => a.type === "notification")).toHaveLength(2);
  });
});
