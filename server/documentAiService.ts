import { TRPCError } from "@trpc/server";
import type { Document } from "../drizzle/schema";
import * as queries from "./queries";
import * as llmUtils from "./llmUtils";
import { getFeatureFlags } from "./settings";

const processingJobs = new Map<number, Promise<void>>();

/** One extraction/indexing job per document, shared by uploads and explicit retries. */
export function processDocument(documentId: number, autoIndex = true): Promise<void> {
  const running = processingJobs.get(documentId);
  if (running) return running;
  const job = (async () => {
    const doc = await queries.getDocumentById(documentId);
    if (!doc) throw new Error("Document not found.");
    await queries.updateDocument(documentId, { processingStatus: "processing", processingError: null });
    try {
      const text = doc.extractedText?.trim() || await llmUtils.extractDocumentText(doc.fileUrl);
      if (!text.trim()) throw new Error("No readable text was found in this document.");
      await queries.updateDocument(documentId, { extractedText: text });
      if (autoIndex) await llmUtils.indexDocumentForRag(documentId, text);
      await queries.updateDocument(documentId, { processingStatus: "ready", processingError: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Document processing failed.";
      await queries.updateDocument(documentId, { processingStatus: "failed", processingError: message.slice(0, 1000) });
      await queries.recordSystemEvent({ category: "indexing", severity: "error", message, documentId, userId: doc.userId });
      throw error;
    }
  })().finally(() => processingJobs.delete(documentId));
  processingJobs.set(documentId, job);
  return job;
}

export function enqueueDocumentProcessing(documentId: number, autoIndex = true): void {
  void processDocument(documentId, autoIndex).catch(error => console.warn(`[Document ${documentId}] ${error instanceof Error ? error.message : "Processing failed"}`));
}

export async function ensureDocumentText(documentId: number): Promise<Document> {
  const doc = await queries.getDocumentById(documentId);
  if (!doc) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Document not found." });
  }

  if (doc.extractedText?.trim()) {
    return doc;
  }

  try {
    await processDocument(documentId);
    const updated = await queries.getDocumentById(documentId);
    if (!updated?.extractedText?.trim()) throw new Error("No readable text was found in this document.");
    return updated;
  } catch (error) {
    // Extraction can still be used if the embedding provider failed afterwards.
    const updated = await queries.getDocumentById(documentId);
    if (updated?.extractedText?.trim()) return updated;
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        error instanceof Error ? error.message : "This document could not be read automatically. Retry processing or upload a readable copy.",
    });
  }
}

export function assertDocumentHasExtractedText(doc: Document | undefined): asserts doc is Document {
  if (!doc) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Document not found." });
  }
  if (!doc.extractedText?.trim()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "This document has no extracted text, so the AI cannot read it. Try re-uploading the file (PDF, DOCX, or PPTX) or a file that contains selectable text.",
    });
  }
}

export async function generateSummaryForDocument(documentId: number, topic?: string) {
  const flags = await getFeatureFlags();
  if (!flags.summarization) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "AI summarization is disabled." });
  const doc = await ensureDocumentText(documentId);
  assertDocumentHasExtractedText(doc);
  const { summary, keyPoints } = await llmUtils.generateDocumentSummary(
    documentId,
    doc.extractedText || "",
    doc.title,
    topic
  );
  return queries.replaceDocumentSummary({ documentId, summary, keyPoints });
}

export async function generateFlashcardsForDocument(documentId: number, userId: number, count: number) {
  const flags = await getFeatureFlags();
  if (!flags.flashcards) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Flashcard generation is disabled." });
  const doc = await ensureDocumentText(documentId);
  assertDocumentHasExtractedText(doc);
  const n = Math.min(30, Math.max(3, count));
  const flashcards = await llmUtils.generateFlashcards(
    documentId,
    doc.extractedText || "",
    doc.title,
    n
  );
  const savedFlashcards = [];
  for (const card of flashcards) {
    const saved = await queries.createFlashcard({
      documentId,
      userId,
      question: card.question,
      answer: card.answer,
    });
    savedFlashcards.push(saved);
  }
  const allCards = await queries.getDocumentFlashcards(documentId, userId);
  await queries.updateProgressActivity(documentId, userId, {
    flashcardsCreated: allCards.length,
  });
  return savedFlashcards;
}

export async function generateQuizForDocument(documentId: number, userId: number, questionCount: number) {
  const flags = await getFeatureFlags();
  if (!flags.quizGeneration) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Quiz generation is disabled." });
  const doc = await ensureDocumentText(documentId);
  assertDocumentHasExtractedText(doc);
  const n = Math.min(20, Math.max(3, questionCount));
  const questions = await llmUtils.generateQuiz(documentId, doc.extractedText || "", doc.title, n);
  const quiz = await queries.createQuiz({
    documentId,
    userId,
    title: `Quiz: ${doc.title}`,
    totalQuestions: questions.length,
  });
  for (const q of questions) {
    await queries.createQuizQuestion({
      quizId: quiz.id,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
    });
  }
  return quiz;
}

export type SlashCommandResult =
  | { type: "summary" }
  | { type: "flashcards"; count: number }
  | { type: "quiz"; count: number };

/**
 * Parse /summary, /flashcards [n], /quiz [n] from chat messages.
 */
export function parseSlashCommand(raw: string): SlashCommandResult | null {
  const line = raw.trim().split("\n")[0]?.trim() ?? "";
  if (!line.startsWith("/")) return null;
  const parts = line.split(/\s+/).filter(Boolean);
  const cmd = parts[0]?.toLowerCase() ?? "";

  if (cmd === "/summary" || cmd === "/summarize") {
    return { type: "summary" };
  }
  if (cmd === "/flashcards" || cmd === "/cards") {
    const n = parts[1] ? parseInt(parts[1], 10) : 10;
    const count = Number.isFinite(n) ? n : 10;
    return { type: "flashcards", count };
  }
  if (cmd === "/quiz" || cmd === "/quizzes") {
    const n = parts[1] ? parseInt(parts[1], 10) : 5;
    const count = Number.isFinite(n) ? n : 5;
    return { type: "quiz", count };
  }
  return null;
}
