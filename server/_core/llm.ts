import { ENV } from "./env";
import {
  getAiService,
  ProviderError,
  type AiChatMessage,
  type AiTaskType,
} from "../ai";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  temperature?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  /** Task label for logging / metrics (does not change provider — Groq only). */
  taskType?: AiTaskType;
  requestId?: string;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const flattenMessageContent = (message: Message): string => {
  const parts = ensureArray(message.content);
  return parts
    .map((part) => {
      if (typeof part === "string") return part;
      if (part.type === "text") return part.text;
      if (part.type === "file_url") {
        return `[Attached file: ${part.file_url.url}]`;
      }
      if (part.type === "image_url") {
        return `[Image: ${part.image_url.url}]`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
};

export function isGroqConfigured(): boolean {
  return Boolean(ENV.groqApiKey);
}

/** @deprecated Use isGroqConfigured — kept for older imports. */
export function hasGroqFallback(): boolean {
  return isGroqConfigured();
}

export function lastLlmProviderName(): "groq" | null {
  return "groq";
}

export function preferredLlmProviderName(): "groq" {
  return "groq";
}

function toAiMessages(messages: Message[]): AiChatMessage[] {
  return messages.map((m) => {
    const role: AiChatMessage["role"] =
      m.role === "system" || m.role === "user" || m.role === "assistant" ? m.role : "user";
    return { role, content: flattenMessageContent(m) };
  });
}

function toInvokeResult(
  content: string,
  model: string,
  usage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null }
): InvokeResult {
  return {
    id: `groq-${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
    usage:
      usage.promptTokens != null || usage.completionTokens != null || usage.totalTokens != null
        ? {
            prompt_tokens: usage.promptTokens ?? 0,
            completion_tokens: usage.completionTokens ?? 0,
            total_tokens: usage.totalTokens ?? 0,
          }
        : undefined,
  };
}

/**
 * LLM entry point — always Groq.
 * RAG / prompt construction happen in callers (llmUtils, agent, etc.).
 */
export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  try {
    const result = await getAiService().generate({
      messages: toAiMessages(params.messages),
      maxTokens: params.max_tokens ?? params.maxTokens,
      temperature: params.temperature,
      taskType: params.taskType ?? "general",
      requestId: params.requestId,
    });
    return toInvokeResult(result.content, result.model, result.usage);
  } catch (err) {
    if (err instanceof ProviderError) {
      throw new Error(err.message);
    }
    throw err;
  }
}
