import {
  invokeLLM,
  lastLlmProviderName,
  preferredLlmProviderName,
  type Message,
} from "../_core/llm";

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

/** Active LLM provider — always Groq after migration. */
export function currentLlmProviderName(): "groq" {
  return lastLlmProviderName() ?? preferredLlmProviderName();
}

export async function generateAgentText(
  messages: LlmChatMessage[],
  maxTokens = 512
): Promise<{ text: string; usage?: { total_tokens?: number }; provider: "groq" }> {
  const result = await invokeLLM({
    messages: messages as Message[],
    max_tokens: maxTokens,
    taskType: "general",
  });
  const text = messageText(result.choices[0]?.message?.content).trim();
  if (!text) throw new Error("The language model returned an empty response.");
  return { text, usage: result.usage, provider: "groq" };
}
