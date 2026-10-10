/**
 * Shared OpenAI-compatible chat/completions client used by Groq.
 * Never logs apiKey.
 */
import { classifyHttpProviderError, ProviderError } from "./errors";
import type { AiChatMessage, AiToolCall, AiToolDefinition, AiUsage } from "./types";

export type OpenAiCompatChatParams = {
  label: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  messages: AiChatMessage[];
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  tools?: AiToolDefinition[];
  toolChoice?: "auto" | "none" | "required";
  extraBody?: Record<string, unknown>;
};

export type OpenAiCompatChatResult = {
  content: string;
  model: string;
  usage: AiUsage;
  toolCalls: AiToolCall[];
  finishReason: string | null;
  raw: unknown;
};

export async function openAiCompatibleChat(
  params: OpenAiCompatChatParams
): Promise<OpenAiCompatChatResult> {
  const url = `${params.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages.map(serializeMessage),
    max_tokens: params.maxTokens,
    temperature: params.temperature,
    stream: false as const,
    ...params.extraBody,
  };
  if (params.tools?.length) {
    body.tools = params.tools;
    body.tool_choice = params.toolChoice ?? "auto";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (params.apiKey) headers.authorization = `Bearer ${params.apiKey}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers,
      body: JSON.stringify(body),
    });
    clearTimeout(timer);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw classifyHttpProviderError(params.label, response.status, errorText);
    }

    const json = (await response.json()) as {
      model?: string;
      choices?: Array<{
        finish_reason?: string | null;
        message?: {
          content?: unknown;
          reasoning?: unknown;
          tool_calls?: AiToolCall[];
        };
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    const choice = json.choices?.[0];
    const message = choice?.message;
    const toolCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
    let content = flattenContent(message?.content).trim();
    if (!content && typeof message?.reasoning === "string" && toolCalls.length === 0) {
      content = message.reasoning.trim();
    }
    if (!content && toolCalls.length === 0) {
      throw new ProviderError(`${params.label} returned an empty response.`, {
        category: "response",
        provider: params.label,
        retryable: true,
      });
    }

    return {
      content,
      model: json.model || params.model,
      usage: {
        promptTokens: json.usage?.prompt_tokens ?? null,
        completionTokens: json.usage?.completion_tokens ?? null,
        totalTokens: json.usage?.total_tokens ?? null,
      },
      toolCalls,
      finishReason: choice?.finish_reason ?? null,
      raw: json,
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof ProviderError) throw err;
    const name =
      err && typeof err === "object" && "name" in err
        ? String((err as { name: string }).name)
        : "";
    if (name === "AbortError") {
      throw new ProviderError(
        `${params.label} timed out after ${Math.round(params.timeoutMs / 1000)} seconds.`,
        { category: "timeout", provider: params.label, retryable: true, cause: err }
      );
    }
    throw new ProviderError(`${params.label} network error.`, {
      category: "network",
      provider: params.label,
      retryable: true,
      cause: err,
    });
  }
}

export async function openAiCompatibleModelsProbe(opts: {
  label: string;
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
}): Promise<{ ok: boolean; latencyMs: number; status?: number }> {
  const started = Date.now();
  try {
    const headers: Record<string, string> = {};
    if (opts.apiKey) headers.authorization = `Bearer ${opts.apiKey}`;
    const res = await fetch(`${opts.baseUrl.replace(/\/$/, "")}/models`, {
      headers,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 2500),
    });
    return { ok: res.ok, latencyMs: Date.now() - started, status: res.status };
  } catch {
    return { ok: false, latencyMs: Date.now() - started };
  }
}

function serializeMessage(m: AiChatMessage): Record<string, unknown> {
  const out: Record<string, unknown> = { role: m.role };
  if (m.role === "tool") {
    out.content = m.content ?? "";
    if (m.tool_call_id) out.tool_call_id = m.tool_call_id;
    if (m.name) out.name = m.name;
    return out;
  }
  if (m.tool_calls?.length) {
    out.tool_calls = m.tool_calls;
    out.content = m.content;
  } else {
    out.content = m.content ?? "";
  }
  return out;
}

function flattenContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (content == null) return "";
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return "";
}
