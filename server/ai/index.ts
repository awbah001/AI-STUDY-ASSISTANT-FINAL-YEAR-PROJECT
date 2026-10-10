export type {
  AiChatMessage,
  AiGenerateRequest,
  AiGenerateResult,
  AiHealthStatus,
  AiMessageRole,
  AiMetricsSnapshot,
  AiProviderHealth,
  AiTaskType,
  AiToolCall,
  AiToolDefinition,
  AiUsage,
} from "./types";

export {
  ProviderError,
  classifyHttpProviderError,
  isRetryableProviderError,
  userFacingAiError,
} from "./errors";

export { getAiMetrics, recordAiAttempt, resetAiMetrics } from "./metrics";
export { resolveGroqConfig, assertGroqConfigured } from "./config";
export { assertAiRateLimit, getAiRateLimitPerMinute } from "./rateLimit";
export { AiService, getAiService, setAiServiceForTests } from "./service";
