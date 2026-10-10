import { ENV } from "../../_core/env";
import { ProviderError } from "../errors";
import { openAiCompatibleChat, openAiCompatibleModelsProbe } from "../openaiCompatible";
import type { AiGenerateRequest, AiProviderHealth } from "../types";

/** Thin Groq client used by AiService and tests. */
export class GroqClient {
  private modelOverride: string | null = null;

  setModel(model: string) {
    this.modelOverride = model.trim() || null;
  }

  getModelName(): string {
    return this.modelOverride || ENV.groqModel || "openai/gpt-oss-20b";
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
        model: this.getModelName(),
        latencyMs: probe.latencyMs,
        detail: "Cloud (configured)",
      };
    }
    if (probe.status === 401 || probe.status === 403) {
      return {
        provider: "groq",
        status: "auth_failure",
        model: this.getModelName(),
        latencyMs: probe.latencyMs,
        detail: "Authentication failed.",
      };
    }
    if (probe.status === 429) {
      return {
        provider: "groq",
        status: "rate_limited",
        model: this.getModelName(),
        latencyMs: probe.latencyMs,
        detail: "Rate limited.",
      };
    }
    return {
      provider: "groq",
      status: "unavailable",
      model: this.getModelName(),
      latencyMs: probe.latencyMs,
      detail: "Cloud unreachable.",
    };
  }

  async generate(request: AiGenerateRequest) {
    if (!this.isConfigured()) {
      throw new ProviderError("Groq is not configured.", {
        category: "configuration",
        provider: "groq",
        retryable: false,
      });
    }
    const started = Date.now();
    const model = this.getModelName();
    const isGptOss = model.toLowerCase().includes("gpt-oss");
    const result = await openAiCompatibleChat({
      label: "Groq",
      baseUrl: ENV.groqBaseUrl,
      model,
      apiKey: ENV.groqApiKey,
      messages: request.messages,
      maxTokens: Math.max(request.maxTokens ?? 1024, isGptOss ? 512 : 256),
      temperature: request.temperature ?? 0.3,
      timeoutMs: ENV.groqTimeoutMs,
      extraBody: isGptOss
        ? { reasoning_effort: "low", include_reasoning: false }
        : undefined,
    });
    return {
      content: result.content,
      model: result.model,
      usage: result.usage,
      latencyMs: Date.now() - started,
    };
  }
}
