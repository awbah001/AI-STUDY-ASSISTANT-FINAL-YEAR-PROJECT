import { invokeLLM, type Message } from "../_core/llm";
import { ENV } from "../_core/env";

export type LlmChatMessage = { role: "system" | "user" | "assistant"; content: string };

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
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

export function currentLlmProviderName(): "lm-studio" | "gemini" {
  return ENV.useLocalLlm ? "lm-studio" : "gemini";
}

export async function generateAgentText(
  messages: LlmChatMessage[],
  maxTokens = 512
): Promise<{ text: string; usage?: { total_tokens?: number } }> {
  const result = await invokeLLM({
    messages: messages as Message[],
    max_tokens: maxTokens,
  });
  const text = messageText(result.choices[0]?.message?.content).trim();
  if (!text) throw new Error("The language model returned an empty response.");
  return { text, usage: result.usage };
}
