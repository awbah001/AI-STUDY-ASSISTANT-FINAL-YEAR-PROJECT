import pdfParse from "pdf-parse";
import officeParser from "officeparser";
import fs from "fs/promises";
import { invokeLLM } from "./_core/llm";
import { resolveUploadPath } from "./_core/uploads";
import { loadPdfBufferFromUrl } from "./rag/pdfBuffer";
import { buildDocumentVectorIndex, retrieveRelevantChunks } from "./rag/index";
import { validateQuizQuestions } from "./agent/structured";

/**
 * Call invokeLLM and retry once if the response is empty or starts with
 * something that looks like an apology / refusal instead of JSON.
 * Small models sometimes respond with "I'm sorry, I can't..." on the first
 * attempt but succeed on a second identical request.
 */
export function llmMessageText(content: unknown): string {
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

export function questionsAreSimilar(a: string, b: string): boolean {
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

export function parseJsonFromLlmContent(raw: string): unknown {
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
export async function readDocumentBuffer(fileUrl: string): Promise<Buffer> {
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
  
  return buffer;
}

export async function extractDocumentText(fileUrl: string): Promise<string> {
  const buffer = await readDocumentBuffer(fileUrl);
  if (buffer.length === 0) throw new Error("The uploaded file is empty.");
  const extension = fileUrl.split(/[?#]/)[0].split(".").pop()?.toLowerCase();
  if (["txt", "md", "csv", "tsv"].includes(extension ?? "")) {
    const text = buffer.toString("utf8").replace(/^\uFEFF/, "").trim();
    if (!text) throw new Error("This document contains no extractable text.");
    return text;
  }
  // Only PDF bytes may be passed to the legacy PDF fallback.
  const isPdf = buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"));
  let officeError: unknown;
  try {
    const document = await officeParser.parseOffice(buffer);
    const text = document.toText().trim();
    if (text) return text;
  } catch (err) {
    officeError = err;
  }

  if (!isPdf) {
    if (officeError) {
      throw new Error("Could not read this document. It may be damaged or in an unsupported format. Try exporting it as PDF, DOCX, or PPTX and uploading again.", { cause: officeError });
    }
    throw new Error("This document contains no extractable text.");
  }

  try {
    const data = await pdfParse(buffer);
    const text = (data.text ?? "").trim();
    if (text) return text;
  } catch (err) {
    throw new Error("Could not read this PDF. It may be damaged or password-protected. Try opening it and exporting a new PDF before uploading again.", { cause: err });
  }
  throw new Error("This PDF contains no extractable text. If it is a scan, use OCR to create a searchable PDF before uploading.");
}

/**
 * Build FAISS-style vector index for a document after text is available.
 */
export async function indexDocumentForRag(documentId: number, extractedText: string, source?: { pages?: string[]; revision: string }): Promise<void> {
  if (!extractedText?.trim()) return;
  await buildDocumentVectorIndex(documentId, extractedText, source);
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
    taskType: "summarization",
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

function normalizeQuizQuestions(raw: unknown) {
  return validateQuizQuestions(raw, 4);
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
        taskType: "flashcard_generation",
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
  const passages = splitQuizPassages(sourceText, Math.max(target * 3, target));
  const allQuestions: Array<{
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
  }> = [];
  const maxAttempts = Math.max(passages.length, target * 6);

  for (let attempt = 0; attempt < maxAttempts && allQuestions.length < target; attempt++) {
    const focus = passages[attempt % passages.length] || sourceText.slice(0, 1200);
    let response: Awaited<ReturnType<typeof invokeLLM>>;
    try {
      response = await invokeLLMWithRetry({
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
              `{"questions":[{"question":"What is GIS?","options":["A geographic information system","A graphics editing program","A satellite vendor","A type of database lock"],"correctAnswer":"A geographic information system","explanation":"GIS stores and analyses spatial data."}]}`,
              `Rules: exactly one question; exactly four complete option phrases (never letters only like A,B,C,D); correctAnswer must copy one option string exactly; different topic from the forbidden list.`,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
        max_tokens: 700,
        temperature: 0.7,
        taskType: "quiz_generation",
      });
    } catch (error) {
      console.warn("[LLM] Quiz attempt failed:", error);
      continue;
    }

    const raw = llmMessageText(response.choices[0]?.message?.content);
    if (!raw.trim()) continue;

    let parsedQuestions: ReturnType<typeof normalizeQuizQuestions> = [];
    try {
      parsedQuestions = normalizeQuizQuestions(parseJsonFromLlmContent(raw));
    } catch {
      parsedQuestions = normalizeQuizQuestions(extractQuizObjectsFromText(raw));
    }

    for (const q of parsedQuestions) {
      if (q.options.length < 4) continue;
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
  const totalStarted = Date.now();
  // documentId === 0 means general Ask AI — skip RAG, answer from LLM knowledge only
  let context = "";
  let ragMs = 0;
  if (documentId > 0) {
    const ragStarted = Date.now();
    context = await retrieveRelevantChunks(documentId, userQuestion, 4);
    ragMs = Date.now() - ragStarted;
    if (!context.trim() && documentText.trim()) {
      context = documentText.slice(0, 3000); // 3B model — less context, faster chat
    }
  }

  // Sanitize retrieved context against prompt injection
  const promptStarted = Date.now();
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
        : `You are the Course-Specific AI Learning Assistant, a helpful AI learning assistant for higher education students. Answer questions clearly, concisely and educationally. You can explain concepts, help with study topics, and assist with learning. Keep answers focused and student-friendly.`,
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
  const promptMs = Date.now() - promptStarted;

  const llmStarted = Date.now();
  const response = await invokeLLM({
    messages,
    max_tokens: 512,
    taskType: documentId > 0 ? "rag_question" : "student_chat",
  });
  const llmMs = Date.now() - llmStarted;
  console.log(
    `[Perf] chat doc=${documentId} rag=${ragMs}ms prompt=${promptMs}ms provider=${llmMs}ms total=${Date.now() - totalStarted}ms`
  );

  return llmMessageText(response.choices[0]?.message?.content) || "";
}

// ============ PRESENTATION (SLIDE DECK) GENERATION ============

export type GeneratedSlide = {
  title: string;
  bullets: string[];
  notes?: string;
};

export type SlideDeck = {
  title: string;
  subtitle?: string;
  slides: GeneratedSlide[];
};

function collectSlides(raw: unknown, acc: GeneratedSlide[]): void {
  if (raw == null) return;
  if (Array.isArray(raw)) {
    for (const item of raw) collectSlides(item, acc);
    return;
  }
  if (typeof raw !== "object") return;
  const obj = raw as Record<string, unknown>;
  const list = obj.slides ?? obj.deck ?? obj.items;
  if (Array.isArray(list)) collectSlides(list, acc);
  const title = typeof obj.title === "string" ? obj.title.trim() : "";
  const bulletsRaw = obj.bullets ?? obj.points ?? obj.content;
  const bullets = Array.isArray(bulletsRaw)
    ? bulletsRaw.map((b) => (typeof b === "string" ? b : b && typeof b === "object" ? String((b as Record<string, unknown>).text ?? (b as Record<string, unknown>).point ?? "") : String(b))).map((s) => s.trim()).filter(Boolean)
    : typeof bulletsRaw === "string"
      ? bulletsRaw.split(/\n+/).map((s) => s.replace(/^[-•*]\s*/, "").trim()).filter(Boolean)
      : [];
  if (title && bullets.length) {
    const notes = typeof obj.notes === "string" ? obj.notes.trim() : undefined;
    acc.push({ title, bullets, notes: notes || undefined });
  }
}

/**
 * Generate a structured slide deck (titles + bullet points + speaker notes)
 * from a document, ready to be rendered into a .pptx file.
 *
 * Uses the one-slide-per-call loop pattern (same as generateFlashcards /
 * generateQuiz) to avoid JSON truncation on smaller models.
 */
export async function generateSlideDeck(
  documentId: number,
  documentText: string,
  documentTitle: string,
  slideCount: number,
  topic?: string
): Promise<SlideDeck> {
  const target = Math.min(20, Math.max(5, Math.round(slideCount)));
  const normalizedTopic = topic?.trim();

  // Pull a broad context for topic planning.
  const fullContext = await ragOrSlice(
    documentId,
    documentText,
    normalizedTopic
      ? `${documentTitle} ${normalizedTopic} key concepts structure outline`
      : `${documentTitle} key concepts structure outline overview`,
    12,
    6000
  );

  // ── Step 1: Generate a short outline (slide titles only) ─────────────────
  // One compact call that asks only for titles — tiny output, never truncated.
  let outlineTitles: string[] = [];
  try {
    const outlineResp = await invokeLLMWithRetry({
      messages: [
        {
          role: "system",
          content:
            "You are a presentation outline generator. Output ONLY a JSON array of strings. No markdown, no explanation. Start with [ and end with ].",
        },
        {
          role: "user",
          content: `Generate exactly ${target} slide titles for a presentation on the document below${normalizedTopic ? ` focusing on "${normalizedTopic}"` : ""}.

Document: "${documentTitle}"
Content:
${fullContext.slice(0, 3000)}

Respond with ONLY a JSON array of ${target} short slide title strings, e.g.:
["Introduction","Key Concepts","Main Arguments","Applications","Conclusion"]

Rules:
- Output raw JSON array only, no markdown
- Exactly ${target} strings
- Each title: 3-8 words, descriptive, in logical order`,
        },
      ],
      max_tokens: 60 * target + 100,
      temperature: 0.3,
      taskType: "summarization",
    });
    const raw = llmMessageText(outlineResp.choices[0]?.message?.content).trim();
    const parsed = parseJsonFromLlmContent(raw);
    if (Array.isArray(parsed)) {
      outlineTitles = parsed
        .map((t) => (typeof t === "string" ? t.trim() : ""))
        .filter(Boolean)
        .slice(0, target);
    }
  } catch {
    // Outline failed — fall back to auto-numbered titles.
  }

  // Fill any missing titles with generic numbered placeholders.
  while (outlineTitles.length < target) {
    outlineTitles.push(`Slide ${outlineTitles.length + 1}`);
  }

  // Generate a deck title and subtitle in one small call.
  let deckTitle = documentTitle;
  let deckSubtitle: string | undefined;
  try {
    const titleResp = await invokeLLMWithRetry({
      messages: [
        {
          role: "system",
          content:
            "You are a presentation title generator. Output ONLY a JSON object. Start with { and end with }.",
        },
        {
          role: "user",
          content: `Create a short presentation title and one-line subtitle for a ${target}-slide deck on "${documentTitle}"${normalizedTopic ? ` focusing on "${normalizedTopic}"` : ""}.
Respond with ONLY: {"title":"Short title","subtitle":"One-line subtitle"}`,
        },
      ],
      max_tokens: 120,
      temperature: 0.4,
      taskType: "summarization",
    });
    const raw = llmMessageText(titleResp.choices[0]?.message?.content).trim();
    const parsed = parseJsonFromLlmContent(raw) as { title?: string; subtitle?: string };
    if (typeof parsed.title === "string" && parsed.title.trim()) {
      deckTitle = parsed.title.trim();
    }
    if (typeof parsed.subtitle === "string" && parsed.subtitle.trim()) {
      deckSubtitle = parsed.subtitle.trim();
    }
  } catch {
    // Keep defaults if title call fails.
  }

  // ── Step 2: Generate each slide individually ───────────────────────────────
  // Identical pattern to generateFlashcards: one item per call, loop over passages.
  const passages = splitQuizPassages(
    `${fullContext}\n${documentText}`.trim() || documentText,
    target * 2
  );
  const slides: GeneratedSlide[] = [];
  const seenTitles = new Set<string>();

  for (let i = 0; i < target; i++) {
    const slideTitle = outlineTitles[i];
    const passage = passages[i % passages.length] || fullContext.slice(0, 1200);
    let response: Awaited<ReturnType<typeof invokeLLM>>;
    try {
      response = await invokeLLMWithRetry({
        messages: [
          {
            role: "system",
            content:
              "You are a slide content generator. Output ONLY valid JSON. No markdown, no explanation. Start with { and end with }.",
          },
          {
            role: "user",
            content: [
              `Document: "${documentTitle}".`,
              `Generate slide ${i + 1} of ${target} titled "${slideTitle}" from this excerpt:`,
              `---`,
              passage.slice(0, 1200),
              `---`,
              slides.length
                ? `Already covered (do not repeat): ${slides.map((s) => s.title).join(", ")}`
                : "",
              `Required JSON:`,
              `{"title":"${slideTitle}","bullets":["Key point 1","Key point 2","Key point 3"],"notes":"Brief speaker note."}`,
              `Rules: "title" must be exactly "${slideTitle}"; "bullets": 3-5 plain-text points; "notes": 1-2 sentences (optional).`,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
        max_tokens: 350,
        temperature: 0.5,
        taskType: "summarization",
      });
    } catch (error) {
      console.warn(`[LLM] Slide ${i + 1} generation failed:`, error);
      // Use a placeholder slide so the deck is still complete.
      slides.push({ title: slideTitle, bullets: [slideTitle], notes: undefined });
      continue;
    }

    const raw = llmMessageText(response.choices[0]?.message?.content);
    if (!raw.trim()) {
      slides.push({ title: slideTitle, bullets: [slideTitle], notes: undefined });
      continue;
    }

    let parsed: unknown;
    try {
      parsed = parseJsonFromLlmContent(raw);
    } catch {
      parsed = extractQuizObjectsFromText(raw)[0];
    }

    const slideData: GeneratedSlide[] = [];
    collectSlides(parsed ?? {}, slideData);

    const slide = slideData[0];
    if (slide && slide.bullets.length) {
      const key = slide.title.toLowerCase();
      if (!seenTitles.has(key)) {
        seenTitles.add(key);
        slides.push(slide);
      } else {
        slides.push({ ...slide, title: slideTitle });
      }
    } else {
      // Fallback: build a minimal slide from the raw text if JSON parse failed.
      const lines = raw
        .replace(/[{}"\\]/g, " ")
        .split(/[\n,]+/)
        .map((l) => l.trim())
        .filter((l) => l.length > 8 && !l.startsWith("title") && !l.startsWith("notes"))
        .slice(0, 4);
      slides.push({
        title: slideTitle,
        bullets: lines.length ? lines : [`See source: ${documentTitle}`],
        notes: undefined,
      });
    }
  }

  if (!slides.length) {
    throw new Error(
      "The AI could not build a slide deck from this document. Try again or use a document with more text."
    );
  }

  return { title: deckTitle, subtitle: deckSubtitle, slides };
}

// ============ NARRATED VIDEO SCRIPT GENERATION ============

export type VideoScene = {
  title: string;
  bullets: string[];
  narration: string;
};

export type VideoScript = {
  title: string;
  scenes: VideoScene[];
};

function collectScenes(raw: unknown, acc: VideoScene[]): void {
  if (raw == null) return;
  if (Array.isArray(raw)) {
    for (const item of raw) collectScenes(item, acc);
    return;
  }
  if (typeof raw !== "object") return;
  const obj = raw as Record<string, unknown>;
  const list = obj.scenes ?? obj.items;
  if (Array.isArray(list)) collectScenes(list, acc);
  const title = typeof obj.title === "string" ? obj.title.trim() : "";
  const bulletsRaw = obj.bullets ?? obj.points ?? obj.content;
  const bullets = Array.isArray(bulletsRaw)
    ? bulletsRaw.map((b) => (typeof b === "string" ? b : String(b))).map((s) => s.trim()).filter(Boolean)
    : typeof bulletsRaw === "string"
      ? bulletsRaw.split(/\n+/).map((s) => s.replace(/^[-•*]\s*/, "").trim()).filter(Boolean)
      : [];
  const narration =
    typeof obj.narration === "string"
      ? obj.narration.trim()
      : typeof obj.voiceover === "string"
        ? obj.voiceover.trim()
        : typeof obj.script === "string"
          ? obj.script.trim()
          : "";
  if (title && (bullets.length || narration)) acc.push({ title, bullets, narration });
}

/**
 * Generate a narrated-video script: a sequence of scenes, each with on-screen
 * bullets and a spoken narration, built from the document material.
 *
 * Uses the one-scene-per-call loop pattern to avoid JSON truncation on smaller
 * models (same approach as generateFlashcards / generateSlideDeck).
 */
export async function generateVideoScript(
  documentId: number,
  documentText: string,
  documentTitle: string,
  sceneCount: number,
  topic?: string
): Promise<VideoScript> {
  const target = Math.min(12, Math.max(4, Math.round(sceneCount)));
  const normalizedTopic = topic?.trim();

  const fullContext = await ragOrSlice(
    documentId,
    documentText,
    normalizedTopic
      ? `${documentTitle} ${normalizedTopic} main ideas explanation walkthrough`
      : `${documentTitle} main ideas explanation walkthrough overview`,
    12,
    6000
  );

  // ── Step 1: Generate scene titles outline ─────────────────────────────────
  let outlineTitles: string[] = [];
  try {
    const outlineResp = await invokeLLMWithRetry({
      messages: [
        {
          role: "system",
          content:
            "You are a video outline generator. Output ONLY a JSON array of strings. Start with [ and end with ].",
        },
        {
          role: "user",
          content: `Generate exactly ${target} scene titles for a narrated study video on the document below${normalizedTopic ? ` focusing on "${normalizedTopic}"` : ""}.

Document: "${documentTitle}"
Content:
${fullContext.slice(0, 3000)}

Respond with ONLY a JSON array of ${target} short scene title strings in teaching order, e.g.:
["Introduction","Background","Core Concepts","Key Findings","Summary"]

Rules: raw JSON array only, exactly ${target} strings, each 3-8 words.`,
        },
      ],
      max_tokens: 60 * target + 100,
      temperature: 0.3,
      taskType: "summarization",
    });
    const raw = llmMessageText(outlineResp.choices[0]?.message?.content).trim();
    const parsed = parseJsonFromLlmContent(raw);
    if (Array.isArray(parsed)) {
      outlineTitles = parsed
        .map((t) => (typeof t === "string" ? t.trim() : ""))
        .filter(Boolean)
        .slice(0, target);
    }
  } catch {
    // Fallback to numbered titles.
  }
  while (outlineTitles.length < target) {
    outlineTitles.push(`Scene ${outlineTitles.length + 1}`);
  }

  // Generate video title.
  let videoTitle = `${documentTitle} — study video`;
  try {
    const titleResp = await invokeLLMWithRetry({
      messages: [
        {
          role: "system",
          content: "Output ONLY a JSON object. Start with { and end with }.",
        },
        {
          role: "user",
          content: `Create a short study video title for "${documentTitle}"${normalizedTopic ? ` about "${normalizedTopic}"` : ""}. Respond with ONLY: {"title":"Short engaging title"}`,
        },
      ],
      max_tokens: 80,
      temperature: 0.4,
      taskType: "summarization",
    });
    const raw = llmMessageText(titleResp.choices[0]?.message?.content).trim();
    const parsed = parseJsonFromLlmContent(raw) as { title?: string };
    if (typeof parsed.title === "string" && parsed.title.trim()) {
      videoTitle = parsed.title.trim();
    }
  } catch {
    // Keep default.
  }

  // ── Step 2: Generate each scene individually ───────────────────────────────
  const passages = splitQuizPassages(
    `${fullContext}\n${documentText}`.trim() || documentText,
    target * 2
  );
  const scenes: VideoScene[] = [];

  for (let i = 0; i < target; i++) {
    const sceneTitle = outlineTitles[i];
    const passage = passages[i % passages.length] || fullContext.slice(0, 1200);
    let response: Awaited<ReturnType<typeof invokeLLM>>;
    try {
      response = await invokeLLMWithRetry({
        messages: [
          {
            role: "system",
            content:
              "You are a study video scene writer. Output ONLY valid JSON. Start with { and end with }.",
          },
          {
            role: "user",
            content: [
              `Document: "${documentTitle}". Write scene ${i + 1} of ${target} titled "${sceneTitle}".`,
              `Excerpt:`,
              `---`,
              passage.slice(0, 1200),
              `---`,
              scenes.length
                ? `Already covered (do not repeat): ${scenes.map((s) => s.title).join(", ")}`
                : "",
              `Required JSON:`,
              `{"title":"${sceneTitle}","bullets":["On-screen text 1","On-screen text 2"],"narration":"Two to three plain spoken English sentences explaining this scene."}`,
              `Rules: "title" must be exactly "${sceneTitle}"; "bullets": 2-4 short on-screen phrases; "narration": 2-3 plain English sentences, no markdown, no emojis.`,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
        max_tokens: 380,
        temperature: 0.5,
        taskType: "summarization",
      });
    } catch (error) {
      console.warn(`[LLM] Scene ${i + 1} generation failed:`, error);
      scenes.push({
        title: sceneTitle,
        bullets: [sceneTitle],
        narration: `${sceneTitle}. See the source document for details.`,
      });
      continue;
    }

    const raw = llmMessageText(response.choices[0]?.message?.content);
    if (!raw.trim()) {
      scenes.push({
        title: sceneTitle,
        bullets: [sceneTitle],
        narration: `${sceneTitle}.`,
      });
      continue;
    }

    let parsed: unknown;
    try {
      parsed = parseJsonFromLlmContent(raw);
    } catch {
      parsed = extractQuizObjectsFromText(raw)[0];
    }

    const sceneData: VideoScene[] = [];
    collectScenes(parsed ?? {}, sceneData);

    const scene = sceneData[0];
    if (scene) {
      if (!scene.narration) {
        scene.narration = scene.bullets.length
          ? `${scene.title}. ${scene.bullets.join(". ")}.`
          : `${scene.title}.`;
      }
      scenes.push({ ...scene, title: sceneTitle });
    } else {
      scenes.push({
        title: sceneTitle,
        bullets: [sceneTitle],
        narration: `${sceneTitle}. ${passage.slice(0, 120).replace(/\s+/g, " ").trim()}.`,
      });
    }
  }

  if (!scenes.length) {
    throw new Error(
      "The AI could not write a video script from this document. Try again or use a document with more text."
    );
  }

  return { title: videoTitle, scenes };
}

// ============ MIXED QUIZ GENERATION (MCQ + Essay) ============

export type MixedQuestion =
  | {
      questionType: "mcq";
      question: string;
      options: string[];
      correctAnswer: string;
      explanation: string;
    }
  | {
      questionType: "essay";
      question: string;
      options: [];
      /** Model answer used for AI grading */
      correctAnswer: string;
      /** Bullet-point marking guidance (joined as newlines) */
      explanation: string;
    };

/**
 * Generate a mixed quiz with both MCQ and essay questions from a document.
 * Roughly 60% MCQ, 40% essay (adjusted for small totals).
 * Uses the one-item-per-call loop pattern.
 */
export async function generateMixedQuiz(
  documentId: number,
  documentText: string,
  documentTitle: string,
  totalCount: number
): Promise<MixedQuestion[]> {
  const total = Math.min(20, Math.max(3, Math.round(totalCount)));
  // Decide split: at least 1 essay, rest MCQ, ≈60/40 for larger sets
  const essayCount = Math.max(1, Math.round(total * 0.4));
  const mcqCount = total - essayCount;

  const context = await ragOrSlice(
    documentId,
    documentText,
    `${documentTitle} quiz test knowledge understanding key concepts`,
    12,
    5000
  );
  const sourceText = `${context}\n${documentText}`.trim() || documentText;
  const passages = splitQuizPassages(sourceText, Math.max(total * 3, total));

  const results: MixedQuestion[] = [];
  const seenQuestions = new Set<string>();

  // ── Generate MCQ questions ───────────────────────────────────────────────
  for (let i = 0; i < passages.length * 4 && results.filter(q => q.questionType === "mcq").length < mcqCount; i++) {
    const focus = passages[i % passages.length] || sourceText.slice(0, 1200);
    let response: Awaited<ReturnType<typeof invokeLLM>>;
    try {
      response = await invokeLLMWithRetry({
        messages: [
          {
            role: "system",
            content: "You are a quiz generator. Output ONLY valid JSON. No markdown, no explanation. Begin with { and end with }.",
          },
          {
            role: "user",
            content: [
              `Document title: "${documentTitle}".`,
              `Write exactly 1 multiple-choice question from THIS excerpt (MCQ #${results.filter(q => q.questionType === "mcq").length + 1} of ${mcqCount}):`,
              `---`,
              focus.slice(0, 1200),
              `---`,
              results.length
                ? `Forbidden (already asked — choose a different fact):\n${results.map(q => `- ${q.question}`).join("\n")}`
                : "",
              `Required JSON:`,
              `{"questions":[{"question":"What is X?","options":["Correct answer","Wrong A","Wrong B","Wrong C"],"correctAnswer":"Correct answer","explanation":"Brief explanation."}]}`,
              `Rules: exactly one question; exactly four complete option phrases (no bare letters A/B/C/D); correctAnswer must match one option exactly.`,
            ].filter(Boolean).join("\n"),
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
        taskType: "quiz_generation",
      });
    } catch {
      continue;
    }
    const raw = llmMessageText(response.choices[0]?.message?.content);
    if (!raw.trim()) continue;
    let parsed: unknown;
    try { parsed = parseJsonFromLlmContent(raw); } catch { parsed = extractQuizObjectsFromText(raw)[0]; }
    const qs = normalizeQuizQuestions(parsed);
    for (const q of qs) {
      if (q.options.length < 4) continue;
      const key = q.question.toLowerCase().trim();
      if (seenQuestions.has(key)) continue;
      if (results.some(r => questionsAreSimilar(r.question, q.question))) continue;
      seenQuestions.add(key);
      results.push({ questionType: "mcq", ...q });
      break;
    }
  }

  // ── Generate Essay questions ─────────────────────────────────────────────
  for (let i = 0; i < passages.length * 4 && results.filter(q => q.questionType === "essay").length < essayCount; i++) {
    const focus = passages[i % passages.length] || sourceText.slice(0, 1200);
    let response: Awaited<ReturnType<typeof invokeLLM>>;
    try {
      response = await invokeLLMWithRetry({
        messages: [
          {
            role: "system",
            content: "You are an exam question writer. Output ONLY valid JSON. No markdown, no explanation. Begin with { and end with }.",
          },
          {
            role: "user",
            content: [
              `Document title: "${documentTitle}".`,
              `Write exactly 1 essay/short-answer question from THIS excerpt (Essay #${results.filter(q => q.questionType === "essay").length + 1} of ${essayCount}):`,
              `---`,
              focus.slice(0, 1200),
              `---`,
              results.length
                ? `Forbidden (already asked — choose a different concept):\n${results.map(q => `- ${q.question}`).join("\n")}`
                : "",
              `Required JSON:`,
              `{"question":"Explain why X matters in the context of Y.","modelAnswer":"A complete 2-3 sentence model answer.","keyPoints":["Point 1","Point 2","Point 3"]}`,
              `Rules: question must require a written explanation (not a yes/no); modelAnswer is 2-4 sentences; keyPoints are 2-4 short marking criteria.`,
            ].filter(Boolean).join("\n"),
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
        taskType: "quiz_generation",
      });
    } catch {
      continue;
    }
    const raw = llmMessageText(response.choices[0]?.message?.content);
    if (!raw.trim()) continue;
    let parsed: unknown;
    try { parsed = parseJsonFromLlmContent(raw); } catch { continue; }
    const obj = parsed as Record<string, unknown>;
    const question = typeof obj.question === "string" ? obj.question.trim() : "";
    const modelAnswer = typeof obj.modelAnswer === "string" ? obj.modelAnswer.trim() : "";
    const keyPoints = Array.isArray(obj.keyPoints)
      ? obj.keyPoints.map((p: unknown) => String(p).trim()).filter(Boolean)
      : [];
    if (!question || !modelAnswer) continue;
    const key = question.toLowerCase().trim();
    if (seenQuestions.has(key)) continue;
    if (results.some(r => questionsAreSimilar(r.question, question))) continue;
    seenQuestions.add(key);
    results.push({
      questionType: "essay",
      question,
      options: [],
      correctAnswer: modelAnswer,
      explanation: keyPoints.length ? keyPoints.join("\n") : modelAnswer,
    });
  }

  if (results.length < Math.min(3, total)) {
    throw new Error(
      `Mixed quiz generation produced only ${results.length} questions. Try again or use a document with more text.`
    );
  }

  // Interleave MCQ and essay so they alternate in the quiz
  const mcqs = results.filter(q => q.questionType === "mcq");
  const essays = results.filter(q => q.questionType === "essay");
  const interleaved: MixedQuestion[] = [];
  const maxLen = Math.max(mcqs.length, essays.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < mcqs.length) interleaved.push(mcqs[i]);
    if (i < essays.length) interleaved.push(essays[i]);
  }
  return interleaved;
}
