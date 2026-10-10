import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderError, classifyHttpProviderError, userFacingAiError } from "./errors";
import { resetAiMetrics, getAiMetrics } from "./metrics";
import { AiService, setAiServiceForTests } from "./service";
import { GroqClient } from "./providers/groq";

vi.mock("./config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./config")>();
  return {
    ...actual,
    resolveGroqConfig: vi.fn(async () => ({
      model: "openai/gpt-oss-20b",
      temperature: 0.3,
      maxTokens: 256,
      timeoutMs: 60_000,
      apiKeyConfigured: true,
    })),
    assertGroqConfigured: vi.fn(),
  };
});

vi.mock("./openaiCompatible", () => ({
  openAiCompatibleChat: vi.fn(async () => ({
    content: "hello from groq",
    model: "openai/gpt-oss-20b",
    usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
    toolCalls: [],
    finishReason: "stop",
    raw: {},
  })),
  openAiCompatibleModelsProbe: vi.fn(async () => ({
    ok: true,
    latencyMs: 12,
    status: 200,
  })),
}));

import { openAiCompatibleChat } from "./openaiCompatible";

describe("Groq-only AiService", () => {
  beforeEach(() => {
    resetAiMetrics();
    setAiServiceForTests(null);
    vi.mocked(openAiCompatibleChat).mockReset();
    vi.mocked(openAiCompatibleChat).mockResolvedValue({
      content: "hello from groq",
      model: "openai/gpt-oss-20b",
      usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
      toolCalls: [],
      finishReason: "stop",
      raw: {},
    });
  });

  it("constructs GroqClient", () => {
    const p = new GroqClient();
    expect(typeof p.generate).toBe("function");
    expect(typeof p.healthCheck).toBe("function");
  });

  it("generates via Groq and records metrics", async () => {
    const service = new AiService();
    const result = await service.generate({
      messages: [{ role: "user", content: "hi" }],
      taskType: "rag_question",
    });
    expect(result.provider).toBe("groq");
    expect(result.content).toBe("hello from groq");
    expect(getAiMetrics().successes).toBe(1);
  });

  it("does not retry authentication errors", async () => {
    vi.mocked(openAiCompatibleChat).mockRejectedValueOnce(
      new ProviderError("bad key", {
        category: "authentication",
        provider: "groq",
        retryable: false,
      })
    );
    const service = new AiService();
    await expect(
      service.generate({ messages: [{ role: "user", content: "hi" }] })
    ).rejects.toBeInstanceOf(ProviderError);
    expect(openAiCompatibleChat).toHaveBeenCalledTimes(1);
  });

  it("retries once on timeout then succeeds", async () => {
    vi.mocked(openAiCompatibleChat)
      .mockRejectedValueOnce(
        new ProviderError("timeout", {
          category: "timeout",
          provider: "groq",
          retryable: true,
        })
      )
      .mockResolvedValueOnce({
        content: "recovered",
        model: "openai/gpt-oss-20b",
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        toolCalls: [],
        finishReason: "stop",
        raw: {},
      });
    const service = new AiService();
    const result = await service.generate({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(result.content).toBe("recovered");
    expect(openAiCompatibleChat).toHaveBeenCalledTimes(2);
  });

  it("classifies HTTP 429 as rate_limit", () => {
    const err = classifyHttpProviderError("Groq", 429, "slow");
    expect(err.category).toBe("rate_limit");
    expect(err.retryable).toBe(true);
  });

  it("never embeds secrets in user-facing messages", () => {
    const err = new ProviderError("GROQ_API_KEY=sk-secret is invalid", {
      category: "authentication",
      provider: "groq",
      retryable: false,
    });
    expect(userFacingAiError(err)).not.toMatch(/sk-secret|GROQ_API_KEY/i);
  });
});
