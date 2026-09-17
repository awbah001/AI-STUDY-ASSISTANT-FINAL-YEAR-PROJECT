import pdfParse from "pdf-parse";
import officeParser from "officeparser";
import fs from "fs/promises";
import { invokeLLM } from "./_core/llm";
import { resolveUploadPath } from "./_core/uploads";
import { loadPdfBufferFromUrl } from "./rag/pdfBuffer";
import { buildDocumentVectorIndex, retrieveRelevantChunks } from "./rag/index";

/**
 * Call invokeLLM and retry once if the response is empty or starts with
 * something that looks like an apology / refusal instead of JSON.
 * Small models sometimes respond with "I'm sorry, I can't..." on the first
 * attempt but succeed on a second identical request.
 */
function llmMessageText(content: unknown): string {
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

async function invokeLLMWithRetry(
  params: Parameters<typeof invokeLLM>[0],
  retries = 1
): ReturnType<typeof invokeLLM> {
  let last: Awaited<ReturnType<typeof invokeLLM>> | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    last = await invokeLLM(params);
    const trimmed = llmMessageText(last.choices[0]?.message?.content).trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed.startsWith("```")) {
      return last;
    }
    if (attempt < retries) {
      console.warn(`[LLM] Attempt ${attempt + 1} returned non-JSON, retrying…`);
    }
  }
  return last!;
}

function splitQuizPassages(text: string, count: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return Array.from({ length: count }, () => "");
  const sentences = normalized.split(/(?<=[.!?])\s+/).filter((s) => s.length >= 24);
  const source = sentences.length ? sentences : [normalized];
  return Array.from({ length: count }, (_, i) => {
    if (source.length === 1) {
      const size = Math.max(280, Math.ceil(normalized.length / count));
      const start = Math.min(Math.max(0, normalized.length - 1), i * size);
      return normalized.slice(start, start + size) || normalized;
    }
    const start = Math.floor((i * source.length) / count) % source.length;
    return source.slice(start, start + 3).join(" ") || source[start];
  });
}

function questionsAreSimilar(a: string, b: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const wa = new Set(na.split(" ").filter((w) => w.length > 2));
  const wb = new Set(nb.split(" ").filter((w) => w.length > 2));
  if (!wa.size || !wb.size) return false;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / Math.min(wa.size, wb.size) >= 0.75;
}

/** Close unclosed quotes/brackets so truncated 3B-model JSON can still parse. */
function closeUnbalancedJson(input: string): string {
  let inString = false;
  let escape = false;
  let braces = 0;
  let brackets = 0;
  for (const ch of input) {
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") braces++;
    else if (ch === "}") braces--;
    else if (ch === "[") brackets++;
    else if (ch === "]") brackets--;
  }
  let out = input;
  if (inString) out += '"';
  if (brackets > 0) out += "]".repeat(brackets);
  if (braces > 0) out += "}".repeat(braces);
  return out;
}

function tryParseJson(candidate: string): unknown | undefined {
  if (!candidate) return undefined;
  try {
    return JSON.parse(candidate);
  } catch {
    try {
      return JSON.parse(closeUnbalancedJson(candidate));
    } catch {
      return undefined;
    }
  }
}

function parseJsonFromLlmContent(raw: string): unknown {
  const trimmed = raw.trim();
  const candidates: string[] = [];

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch?.[1]) candidates.push(fenceMatch[1].trim());

  const braceStart = trimmed.indexOf("{");
  if (braceStart !== -1) {
    const braceEnd = trimmed.lastIndexOf("}");
    candidates.push(
      braceEnd > braceStart ? trimmed.slice(braceStart, braceEnd + 1) : trimmed.slice(braceStart)
    );
  }

  const bracketStart = trimmed.indexOf("[");
  if (bracketStart !== -1) {
    const bracketEnd = trimmed.lastIndexOf("]");
    candidates.push(
      bracketEnd > bracketStart ? trimmed.slice(bracketStart, bracketEnd + 1) : trimmed.slice(bracketStart)
    );
  }

  candidates.push(trimmed);

  for (const candidate of candidates) {
    const parsed = tryParseJson(candidate);
    if (parsed !== undefined) return parsed;
  }

  console.error("[LLM] Could not parse JSON. Raw response (first 500 chars):", raw.slice(0, 500));
  throw new Error("Could not parse JSON from LLM response");
}

/** Walk nested `{ questions: [...] }` blobs that small models often emit. */
function collectQuizLikeItems(raw: unknown, acc: unknown[]): void {
  if (raw == null) return;
  if (Array.isArray(raw)) {
    for (const item of raw) collectQuizLikeItems(item, acc);
    return;
  }
  if (typeof raw !== "object") return;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.question === "string") acc.push(obj);
  if ("questions" in obj) collectQuizLikeItems(obj.questions, acc);
  if ("quiz" in obj) collectQuizLikeItems(obj.quiz, acc);
}

/** Last-resort scan when the whole payload is not valid JSON. */
function extractQuizObjectsFromText(text: string): unknown[] {
  const items: unknown[] = [];
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const qIdx = text.indexOf('"question"', searchFrom);
    if (qIdx < 0) break;
    const start = text.lastIndexOf("{", qIdx);
    if (start < 0) {
      searchFrom = qIdx + 1;
      continue;
    }
    let depth = 0;
    let inString = false;
    let escape = false;
    let end = -1;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (escape) escape = false;
        else if (ch === "\\") escape = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const slice = end >= 0 ? text.slice(start, end + 1) : closeUnbalancedJson(text.slice(start));
    const parsed = tryParseJson(slice);
    if (parsed && typeof parsed === "object" && typeof (parsed as { question?: unknown }).question === "string") {
      items.push(parsed);
    }
    searchFrom = qIdx + 9;
  }
  return items;
}

async function ragOrSlice(
  documentId: number,
  fallbackText: string,
  query: string,
  topK: number,
  maxChars: number
): Promise<string> {
  const retrieved = await retrieveRelevantChunks(documentId, query, topK);
  const text = retrieved.trim() || fallbackText.slice(0, maxChars);
  return text.slice(0, maxChars);
}

/**
 * Extract text from a document (PDF, DOCX, PPTX) from a URL.
 */
export async function extractDocumentText(fileUrl: string): Promise<string> {
  let buffer: Buffer;
  if (fileUrl.startsWith("/uploads/")) {
    const relativePath = fileUrl.replace("/uploads/", "");
    buffer = await fs.readFile(resolveUploadPath(relativePath));
  } else if (fileUrl.startsWith("http")) {
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Failed to fetch file from URL: ${fileUrl}`);
    buffer = Buffer.from(await response.arrayBuffer());
  } else {
    throw new Error(`Unsupported file URL format: ${fileUrl}`);
  }
  
  // Try officeparser first (supports docx, pptx, xlsx, etc.)
  try {
    const text = await (officeParser as any).parseOfficeAsync(buffer);
    if (text && text.trim().length > 0) {
      return text.trim();
    }
  } catch (err) {
    // If officeparser fails, try pdf-parse if it might be a PDF
    console.log("OfficeParser failed or skipped, trying PDF parser...");
  }

  try {
    const data = await pdfParse(buffer);
    return (data.text ?? "").trim();
  } catch (err) {
    console.error("All text extraction methods failed:", err);
    throw new Error("Could not extract text from this file format.");
  }
}

/**
 * Build FAISS-style vector index for a document after text is available.
 */
export async function indexDocumentForRag(documentId: number, extractedText: string): Promise<void> {
  if (!extractedText?.trim()) return;
  await buildDocumentVectorIndex(documentId, extractedText);
}

/**
 * Generate a concise summary using retrieved chunks + local LLM.
 */
export async function generateDocumentSummary(
  documentId: number,
  documentText: string,
  documentTitle: string,
  topic?: string
): Promise<{ summary: string; keyPoints: string[] }> {
  const normalizedTopic = topic?.trim();
  const queryFocus = normalizedTopic
    ? `${documentTitle} ${normalizedTopic} main ideas key points`
    : `${documentTitle} main ideas key points overview`;

  const context = await ragOrSlice(
    documentId,
    documentText,
    queryFocus,
    8,
    4000   // 3B model context window — keep it tight
  );

  const response = await invokeLLMWithRetry({
    messages: [
      {
        role: "system",
        content:
          "You are a document summarizer. Output ONLY a JSON object. No explanation, no markdown, no extra text. Start your response with { and end with }.",
      },
      {
        role: "user",
        content: `Summarize the document below${normalizedTopic ? ` focusing on "${normalizedTopic}"` : ""}.

Document: "${documentTitle}"
Content:
${context}

Respond with ONLY this JSON:
{"summary":"Write 2-3 paragraphs here","keyPoints":["Key point 1","Key point 2","Key point 3"]}

Rules:
- Output raw JSON only, no markdown fences
- "summary": 2-3 paragraph string
- "keyPoints": array of 3-5 short strings`,
      },
    ],
    max_tokens: 1024,
  });

    const content = llmMessageText(response.choices[0]?.message.content);
    if (typeof content !== "string") {
      throw new Error("Invalid response from LLM");
    }

    const parsed = parseJsonFromLlmContent(content) as {
    summary: string;
    keyPoints: string[];
  };
  return {
    summary: parsed.summary,
    keyPoints: parsed.keyPoints,
  };
}

function collectFlashcardLikeItems(raw: unknown, acc: unknown[]): void {
  if (raw == null) return;
  if (Array.isArray(raw)) {
    for (const item of raw) collectFlashcardLikeItems(item, acc);
    return;
  }
  if (typeof raw !== "object") return;
  const obj = raw as Record<string, unknown>;
  const question = obj.question ?? obj.front ?? obj.term;
  const answer = obj.answer ?? obj.back ?? obj.definition;
  if (typeof question === "string" && typeof answer === "string") acc.push(obj);
  if ("flashcards" in obj) collectFlashcardLikeItems(obj.flashcards, acc);
  if ("cards" in obj) collectFlashcardLikeItems(obj.cards, acc);
}

function normalizeFlashcards(raw: unknown): Array<{ question: string; answer: string }> {
  const collected: unknown[] = [];
  collectFlashcardLikeItems(raw, collected);
  const list = collected.length
    ? collected
    : Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object" && Array.isArray((raw as { flashcards?: unknown }).flashcards)
        ? (raw as { flashcards: unknown[] }).flashcards
        : [];
  const cards: Array<{ question: string; answer: string }> = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const question = String(rec.question ?? rec.front ?? rec.term ?? "").trim();
    const answer = String(rec.answer ?? rec.back ?? rec.definition ?? "").trim();
    if (question.length < 3 || answer.length < 1) continue;
    cards.push({ question, answer });
  }
  return cards;
}

function normalizeQuizQuestions(raw: unknown): Array<{
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}> {
  const collected: unknown[] = [];
  collectQuizLikeItems(raw, collected);
  const list = collected.length ? collected : Array.isArray(raw) ? raw : [];
  const questions: Array<{
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
  }> = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const question = String((item as { question?: unknown }).question ?? "").trim();
    const options = Array.isArray((item as { options?: unknown }).options)
      ? (item as { options: unknown[] }).options.map((opt) => String(opt ?? "").trim()).filter(Boolean)
      : [];
    const correctAnswer = String((item as { correctAnswer?: unknown }).correctAnswer ?? "").trim();
    const explanation = String((item as { explanation?: unknown }).explanation ?? "").trim();
    if (question.length < 3 || options.length < 2 || !correctAnswer) continue;
    const uniqueOptions = [...new Set(options)].slice(0, 4);
    if (uniqueOptions.length < 2) continue;
    const matched =
      uniqueOptions.find((opt) => opt.toLowerCase() === correctAnswer.toLowerCase()) ?? uniqueOptions[0];
    if (!uniqueOptions.includes(matched)) uniqueOptions[0] = matched;
    questions.push({
      question,
      options: uniqueOptions,
      correctAnswer: matched,
      explanation: explanation || "See the document for details.",
    });
  }
  return questions;
}

/**
 * Generate flashcards from retrieved context + local LLM.
 */
export async function generateFlashcards(
  documentId: number,
  documentText: string,
  documentTitle: string,
  count: number = 10
): Promise<Array<{ question: string; answer: string }>> {
  const target = Math.min(30, Math.max(1, Math.round(count)));
  const context = await ragOrSlice(
    documentId,
    documentText,
    `${documentTitle} important facts definitions concepts`,
    10,
    4000
  );
  const sourceText = `${context}\n${documentText}`.trim() || documentText;
  const passages = splitQuizPassages(sourceText, Math.max(target * 2, target));

  const cards: Array<{ question: string; answer: string }> = [];
  const seen = new Set<string>();

  for (let attempt = 0; attempt < passages.length && cards.length < target; attempt++) {
    const focus = passages[attempt] || sourceText.slice(0, 1200);
    let response: Awaited<ReturnType<typeof invokeLLM>>;
    try {
      response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are a flashcard generator. Output ONLY valid JSON. No markdown, no explanation. Begin with { and end with }.",
          },
          {
            role: "user",
            content: [
              `Document title: "${documentTitle}".`,
              `Write exactly 1 flashcard from THIS excerpt only (card #${cards.length + 1} of ${target}):`,
              `---`,
              focus.slice(0, 1400),
              `---`,
              cards.length
                ? `Forbidden (too similar to these — use a different fact):\n${cards.map((c) => `- ${c.question}`).join("\n")}`
                : "",
              `Required JSON:`,
              `{"flashcards":[{"question":"What is X?","answer":"X is ..."}]}`,
              `Rules: one question, one short answer, different topic from the forbidden list.`,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
        max_tokens: 280,
        temperature: 0.7,
      });
    } catch (error) {
      console.warn("[LLM] Flashcard attempt failed:", error);
      continue;
    }

    const raw = llmMessageText(response?.choices?.[0]?.message?.content);
    if (!raw.trim()) continue;

    let parsedCards: ReturnType<typeof normalizeFlashcards> = [];
    try {
      parsedCards = normalizeFlashcards(parseJsonFromLlmContent(raw));
    } catch {
      parsedCards = normalizeFlashcards(extractQuizObjectsFromText(raw));
    }

    for (const card of parsedCards) {
      const key = card.question.toLowerCase();
      if (seen.has(key)) continue;
      if (cards.some((existing) => questionsAreSimilar(existing.question, card.question))) continue;
      seen.add(key);
      cards.push(card);
      if (cards.length >= target) break;
    }
  }

  if (cards.length < Math.min(3, target)) {
    throw new Error(
      `Flashcard generation produced ${cards.length} of ${target} cards. Try again or use a document with more text.`
    );
  }

  if (cards.length < target) {
    console.warn(`[LLM] Flashcard generation saved ${cards.length} of ${target} requested cards.`);
  }

  return cards.slice(0, target);
}

/**
 * Generate a multiple-choice quiz from retrieved context + local LLM.
 */
export async function generateQuiz(
  documentId: number,
  documentText: string,
  documentTitle: string,
  questionCount: number = 5
): Promise<
  Array<{
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
  }>
> {
  const context = await ragOrSlice(
    documentId,
    documentText,
    `${documentTitle} quiz test knowledge understanding`,
    10,
    4000   // 3B model — tighter context for quiz generation
  );

  const target = Math.min(20, Math.max(1, Math.round(questionCount)));
  const sourceText = `${context}\n${documentText}`.trim() || documentText;
  const passages = splitQuizPassages(sourceText, Math.max(target * 2, target));
  const allQuestions: Array<{
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
  }> = [];

  for (let attempt = 0; attempt < passages.length && allQuestions.length < target; attempt++) {
    const focus = passages[attempt] || sourceText.slice(0, 1200);
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a quiz generator. Output ONLY valid JSON. No markdown, no explanation. Begin with { and end with }.",
        },
        {
          role: "user",
          content: [
            `Document title: "${documentTitle}".`,
            `Write exactly 1 multiple-choice question from THIS excerpt only (question #${allQuestions.length + 1} of ${target}):`,
            `---`,
            focus.slice(0, 1400),
            `---`,
            allQuestions.length
              ? `Forbidden (too similar to these — ask about a different fact):\n${allQuestions.map((q) => `- ${q.question}`).join("\n")}`
              : "",
            `Required JSON:`,
            `{"questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":"A","explanation":"..."}]}`,
            `Rules: one question, four options, correctAnswer must copy one option, different topic from forbidden list.`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      max_tokens: 400,
      temperature: 0.8,
    });

    const raw = llmMessageText(response.choices[0]?.message?.content);
    if (!raw.trim()) continue;

    let parsedQuestions: ReturnType<typeof normalizeQuizQuestions> = [];
    try {
      parsedQuestions = normalizeQuizQuestions(parseJsonFromLlmContent(raw));
    } catch {
      parsedQuestions = normalizeQuizQuestions(extractQuizObjectsFromText(raw));
    }

    for (const q of parsedQuestions) {
      if (allQuestions.some((existing) => questionsAreSimilar(existing.question, q.question))) continue;
      allQuestions.push(q);
      if (allQuestions.length >= target) break;
    }
  }

  if (allQuestions.length < target) {
    throw new Error(
      `Quiz generation produced ${allQuestions.length} of ${target} questions. Try again or use a document with more text.`
    );
  }

  return allQuestions.slice(0, target);
}

/**
 * Chat with RAG: retrieve relevant chunks, then answer with local LLM.
 *
 * Optimizations applied:
 *  - Conversation history limited to last MAX_HISTORY_MESSAGES messages
 *  - Context sanitized against prompt injection
 *  - Fallback to raw document text if RAG returns nothing
 */
const MAX_HISTORY_MESSAGES = 8; // last 4 exchanges (user + assistant pairs)

function sanitizeContext(text: string): string {
  return text
    .replace(/ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi, "[filtered]")
    .replace(/you\s+are\s+now\s+/gi, "")
    .replace(/system\s*:\s*/gi, "context: ");
}

export async function generateDocumentAwareResponse(
  documentId: number,
  userQuestion: string,
  documentText: string,
  documentTitle: string,
  chatHistory: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  // documentId === 0 means general Ask AI — skip RAG, answer from LLM knowledge only
  let context = "";
  if (documentId > 0) {
    context = await retrieveRelevantChunks(documentId, userQuestion, 4);
    if (!context.trim() && documentText.trim()) {
      context = documentText.slice(0, 3000); // 3B model — less context, faster chat
    }
  }

  // Sanitize retrieved context against prompt injection
  if (context) context = sanitizeContext(context);

  // Limit history to avoid token bloat
  const historyNewestFirst = chatHistory;
  const prior = historyNewestFirst
    .slice(1, MAX_HISTORY_MESSAGES + 1)
    .reverse();

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    {
      role: "system",
      content: documentId > 0
        ? `You are a helpful learning assistant for higher education. Answer questions accurately using only the provided document context. If the answer is not clearly in the context, say you do not have enough information from this document. Be concise, clear, and educational. Document title: "${documentTitle}"`
        : `You are Cognify, a helpful AI learning assistant for higher education students. Answer questions clearly, concisely and educationally. You can explain concepts, help with study topics, and assist with learning. Keep answers focused and student-friendly.`,
    },
  ];

  for (const msg of prior) {
    messages.push({ role: msg.role, content: msg.content });
  }

  messages.push({
    role: "user",
    content: context
      ? `Document context:\n${context}\n\nStudent question: ${userQuestion}`
      : userQuestion,
  });

  const response = await invokeLLM({ messages, max_tokens: 512 });  // chat reply — keep concise for speed

  const content = response.choices[0]?.message.content;
  if (typeof content !== "string") throw new Error("Invalid response from LLM");
  return content;
}
