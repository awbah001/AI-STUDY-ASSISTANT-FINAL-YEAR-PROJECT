import pdfParse from "pdf-parse";
import officeParser from "officeparser";
import fs from "fs/promises";
import path from "path";
import { invokeLLM } from "./_core/llm";
import { loadPdfBufferFromUrl } from "./rag/pdfBuffer";
import { buildDocumentVectorIndex, retrieveRelevantChunks } from "./rag/index";

function parseJsonFromLlmContent(raw: string): unknown {
  const trimmed = raw.trim();
  const candidates = [
    trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim(),
    trimmed.match(/\{[\s\S]*\}/)?.[0],
    trimmed.match(/\[[\s\S]*\]/)?.[0],
    trimmed,
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error("Could not parse JSON from LLM response");
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
    const fullPath = path.resolve(process.cwd(), "data", "uploads", relativePath);
    buffer = await fs.readFile(fullPath);
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
    12,
    12000
  );

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "You are an expert document summarizer. Reply with ONLY valid JSON, no markdown fences, no extra text.",
      },
      {
        role: "user",
        content: `Document title: "${documentTitle}"
${normalizedTopic ? `Summary topic: "${normalizedTopic}"` : ""}

Content (excerpts):
${context}

Return JSON with this exact shape:
{"summary":"2-3 paragraph summary","keyPoints":["point1","point2","point3","point4"]}
Use 3-5 key points.${normalizedTopic
  ? "\nFocus the summary and key points on the requested topic."
  : ""}`,
      },
    ],
    max_tokens: 2048,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message.content;
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

/**
 * Generate flashcards from retrieved context + local LLM.
 */
export async function generateFlashcards(
  documentId: number,
  documentText: string,
  documentTitle: string,
  count: number = 10
): Promise<Array<{ question: string; answer: string }>> {
  const context = await ragOrSlice(
    documentId,
    documentText,
    `${documentTitle} important facts definitions concepts`,
    14,
    12000
  );

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "You are an expert educator. Reply with ONLY valid JSON, no markdown fences, no extra text.",
      },
      {
        role: "user",
        content: `Document title: "${documentTitle}"

Content (excerpts):
${context}

Create exactly ${count} flashcards. Return JSON:
{"flashcards":[{"question":"...","answer":"..."}]}`,
      },
    ],
    max_tokens: 4096,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message.content;
  if (typeof content !== "string") {
    throw new Error("Invalid response from LLM");
  }

  const parsed = parseJsonFromLlmContent(content) as {
    flashcards: Array<{ question: string; answer: string }>;
  };
  return parsed.flashcards;
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
    14,
    12000
  );

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "You are an expert quiz creator. Reply with ONLY valid JSON, no markdown fences, no extra text.",
      },
      {
        role: "user",
        content: `Document title: "${documentTitle}"

Content (excerpts):
${context}

Create ${questionCount} multiple-choice questions with 4 options each. Return JSON:
{"questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":"exact text of correct option","explanation":"..."}]}`,
      },
    ],
    max_tokens: 4096,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message.content;
  if (typeof content !== "string") {
    throw new Error("Invalid response from LLM");
  }

  const parsed = parseJsonFromLlmContent(content) as {
    questions: Array<{
      question: string;
      options: string[];
      correctAnswer: string;
      explanation: string;
    }>;
  };
  return parsed.questions;
}

/**
 * Chat with RAG: retrieve relevant chunks, then answer with local LLM.
 */
export async function generateDocumentAwareResponse(
  documentId: number,
  userQuestion: string,
  documentText: string,
  documentTitle: string,
  chatHistory: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  let context = await retrieveRelevantChunks(documentId, userQuestion, 6);
  if (!context.trim() && documentText.trim()) {
    // Fallback to beginning of document if no relevant chunks found
    context = documentText.slice(0, 8000);
  }

  const historyNewestFirst = chatHistory;
  const prior = historyNewestFirst.slice(1).reverse();

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    {
      role: "system",
      content: `You are a helpful learning assistant. Answer using the provided context from the document. If the answer is not in the context, say you do not have enough information from the document. Document title: "${documentTitle}"`,
    },
  ];

  for (const msg of prior) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  messages.push({
    role: "user",
    content: `Context from the document:\n${context}\n\nQuestion: ${userQuestion}`,
  });

  const response = await invokeLLM({
    messages,
    max_tokens: 2048,
  });

  const content = response.choices[0]?.message.content;
  if (typeof content !== "string") {
    throw new Error("Invalid response from LLM");
  }

  return content;
}
