/** AI learning assistant types — Groq is the sole LLM provider. */

export type AiTaskType =
  | "student_chat"
  | "rag_question"
  | "explanation"
  | "summarization"
  | "flashcard_generation"
  | "quiz_generation"
  | "study_content_generation"
  | "general"
  | "agent";

export type AiMessageRole = "system" | "user" | "assistant" | "tool";

export type AiToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type AiChatMessage = {
  role: AiMessageRole;
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: AiToolCall[];
};

export type AiToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type AiUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

export type AiGenerateRequest = {
  messages: AiChatMessage[];
  taskType?: AiTaskType;
  maxTokens?: number;
  temperature?: number;
  requestId?: string;
  tools?: AiToolDefinition[];
  toolChoice?: "auto" | "none" | "required";
};

export type AiGenerateResult = {
  content: string;
  provider: "groq";
  model: string;
  usage: AiUsage;
  latencyMs: number;
  toolCalls?: AiToolCall[];
  finishReason?: string | null;
};

export type AiHealthStatus =
  | "connected"
  | "configured"
  | "unavailable"
  | "misconfigured"
  | "rate_limited"
  | "auth_failure";

export type AiProviderHealth = {
  provider: "groq";
  status: AiHealthStatus;
  model: string;
  latencyMs: number | null;
  detail: string;
};

export type AiMetricsSnapshot = {
  provider: "groq";
  requests: number;
  successes: number;
  failures: number;
  averageLatencyMs: number | null;
  successRate: number | null;
};
