import { ENV } from "../_core/env";
import { getAiSettings } from "../settings";

export type GroqRuntimeConfig = {
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  apiKeyConfigured: boolean;
};

export async function resolveGroqConfig(): Promise<GroqRuntimeConfig> {
  const ai = await getAiSettings().catch(() => null);
  const model = (ai?.model?.trim() || ENV.groqModel || "openai/gpt-oss-20b").trim();
  return {
    model,
    temperature: ai?.temperature ?? 0.3,
    maxTokens: ai?.maxTokens ?? 1024,
    timeoutMs: ENV.groqTimeoutMs,
    apiKeyConfigured: Boolean(ENV.groqApiKey),
  };
}

export function assertGroqConfigured() {
  if (!ENV.groqApiKey) {
    throw new Error(
      "GROQ_API_KEY is not configured. Set it in the server .env file to enable the AI learning assistant."
    );
  }
}
