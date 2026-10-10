import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../settings", () => ({
  getAiSettings: vi.fn(async () => ({
    provider: "groq",
    model: "",
    temperature: 0.3,
    maxTokens: 256,
    rag: {},
  })),
}));

const envState = vi.hoisted(() => ({
  groqApiKey: "test-groq-key",
  groqBaseUrl: "https://api.groq.com/openai/v1",
  groqModel: "openai/gpt-oss-20b",
  groqTimeoutMs: 60_000,
  forgeApiUrl: "",
  forgeApiKey: "",
  cookieSecret: "test-secret-key-16",
}));

vi.mock("./env", () => ({
  ENV: envState,
}));

vi.mock("../ai", async () => {
  const actual = await vi.importActual<typeof import("../ai")>("../ai");
  return {
    ...actual,
    getAiService: () => ({
      generate: vi.fn(async () => ({
        content: "hello from groq",
        provider: "groq" as const,
        model: "openai/gpt-oss-20b",
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        latencyMs: 15,
      })),
    }),
  };
});

import { hasGroqFallback, invokeLLM, lastLlmProviderName, preferredLlmProviderName } from "./llm";

describe("invokeLLM Groq-only", () => {
  beforeEach(() => {
    envState.groqApiKey = "test-groq-key";
  });

  it("reports Groq configured when GROQ_API_KEY is set", () => {
    expect(hasGroqFallback()).toBe(true);
  });

  it("always prefers Groq", () => {
    expect(preferredLlmProviderName()).toBe("groq");
    expect(lastLlmProviderName()).toBe("groq");
  });

  it("returns Groq response through invokeLLM", async () => {
    const result = await invokeLLM({
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 64,
      taskType: "student_chat",
    });
    expect(result.choices[0]?.message.content).toBe("hello from groq");
    expect(result.model).toBe("openai/gpt-oss-20b");
  });
});
