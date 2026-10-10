import { ENV } from "../_core/env";
import { assertGroqConfigured, resolveGroqConfig } from "./config";
import { isRetryableProviderError, ProviderError, userFacingAiError } from "./errors";
import { getAiMetrics, recordAiAttempt } from "./metrics";
import { openAiCompatibleChat, openAiCompatibleModelsProbe } from "./openaiCompatible";
import type {
  AiGenerateRequest,
  AiGenerateResult,
  AiProviderHealth,
} from "./types";

const MAX_RETRIES = 1;

/**
 * AI service — Groq is the only LLM provider.
 * RAG / prompt construction happen outside this module.
 */
export class AiService {
  getModelName(): string {
    return ENV.groqModel || "openai/gpt-oss-20b";
  }

  isConfigured(): boolean {
    return Boolean(ENV.groqApiKey);
  }

  async healthCheck(): Promise<AiProviderHealth> {
    if (!this.isConfigured()) {
      return {
        provider: "groq",
        status: "misconfigured",
        model: this.getModelName(),
        latencyMs: null,
        detail: "GROQ_API_KEY is not set.",
      };
    }
    const config = await resolveGroqConfig();
    const probe = await openAiCompatibleModelsProbe({
      label: "Groq",
      baseUrl: ENV.groqBaseUrl,
      apiKey: ENV.groqApiKey,
      timeoutMs: 5000,
    });
    if (probe.ok) {
      return {
        provider: "groq",
        status: "connected",
        model: config.model,
        latencyMs: probe.latencyMs,
        detail: "Cloud (configured)",
      };
    }
    if (probe.status === 401 || probe.status === 403) {
      return {
        provider: "groq",
        status: "auth_failure",
        model: config.model,
        latencyMs: probe.latencyMs,
        detail: "Authentication failed.",
      };
    }
    if (probe.status === 429) {
      return {
        provider: "groq",
        status: "rate_limited",
        model: config.model,
        latencyMs: probe.latencyMs,
        detail: "Rate limited.",
      };
    }
    return {
      provider: "groq",
      status: "unavailable",
      model: config.model,
      latencyMs: probe.latencyMs,
      detail: "Cloud unreachable.",
    };
  }

  metrics() {
    return getAiMetrics();
  }

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    assertGroqConfigured();
    const config = await resolveGroqConfig();
    const model = config.model;
    const isGptOss = model.toLowerCase().includes("gpt-oss");
    const maxTokens = Math.max(
      request.maxTokens ?? config.maxTokens,
      isGptOss ? 512 : 256
    );
    const temperature = request.temperature ?? config.temperature;
    const task = request.taskType ?? "general";
    const requestId = request.requestId ?? `ai-${Date.now()}`;

    console.log(
      `[AI] Request started id=${requestId} op=${task} model=${model}`
    );

    let lastErr: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const started = Date.now();
      try {
        console.log(`[AI] Groq request started id=${requestId} attempt=${attempt + 1}`);
        const result = await openAiCompatibleChat({
          label: "Groq",
          baseUrl: ENV.groqBaseUrl,
          model,
          apiKey: ENV.groqApiKey,
          messages: request.messages,
          maxTokens,
          temperature,
          timeoutMs: config.timeoutMs,
          tools: request.tools,
          toolChoice: request.toolChoice,
          extraBody: isGptOss
            ? { reasoning_effort: "low", include_reasoning: false }
            : undefined,
        });
        const latencyMs = Date.now() - started;
        recordAiAttempt(true, latencyMs);
        console.log(
          `[AI] Groq request completed id=${requestId} latencyMs=${latencyMs} tokens=${result.usage.totalTokens ?? "n/a"} tools=${result.toolCalls?.length ?? 0}`
        );
        console.log(`[AI] Response generated id=${requestId} op=${task}`);
        return {
          content: result.content,
          provider: "groq",
          model: result.model,
          usage: result.usage,
          latencyMs,
          toolCalls: result.toolCalls ?? [],
          finishReason: result.finishReason ?? null,
        };
      } catch (err) {
        lastErr = err;
        const latencyMs = Date.now() - started;
        recordAiAttempt(false, latencyMs);
        const category = err instanceof ProviderError ? err.category : "response";
        console.warn(
          `[AI] Groq request failed id=${requestId} category=${category} attempt=${attempt + 1}`
        );
        if (!isRetryableProviderError(err) || attempt === MAX_RETRIES) break;
      }
    }

    throw new ProviderError(userFacingAiError(lastErr), {
      category: lastErr instanceof ProviderError ? lastErr.category : "unavailable",
      provider: "groq",
      retryable: false,
      cause: lastErr,
    });
  }
}

let singleton: AiService | null = null;

export function getAiService(): AiService {
  if (!singleton) singleton = new AiService();
  return singleton;
}

/** Test helper */
export function setAiServiceForTests(instance: AiService | null) {
  singleton = instance;
}

export { userFacingAiError };
