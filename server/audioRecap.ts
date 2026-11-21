import fs from "fs";
import path from "path";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { audioRecaps, type AudioRecap } from "../drizzle/schema";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import { resolveUploadPath } from "./_core/uploads";
import { canAccessDocument } from "./documentAccess";
import * as documentAi from "./documentAiService";
import { llmMessageText } from "./llmUtils";
import * as queries from "./queries";
import { getFeatureFlags } from "./settings";
import { synthesizeSpeech, ttsConfig } from "./tts";
import {
  recapLengthForDocument,
  RECAP_WORDS_PER_MINUTE,
} from "../shared/audioRecap";
import { samplePassages } from "./examMarking";

const inFlight = new Map<number, Promise<AudioRecap>>();

async function database() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Database not available.",
    });
  return db;
}

async function assertAccess(userId: number, documentId: number) {
  const doc = await queries.getDocumentById(documentId);
  if (!doc || !(await canAccessDocument(userId, doc)))
    throw new TRPCError({ code: "NOT_FOUND" });
  return doc;
}

/** Plain spoken text: no markdown, lists read as sentences. */
export function scriptFromSummary(
  title: string,
  summary: string,
  keyPoints: string[] = []
): string {
  const prose = summary
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*_`>|]/g, "")
    .replace(/^\s*[-•]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  const points = keyPoints
    .map(p => p.replace(/[#*_`]/g, "").trim())
    .filter(Boolean);
  const closing = points.length
    ? ` To remember: ${points.map(p => p.replace(/[.!?]*$/, "")).join(". ")}.`
    : "";
  return `Here is your recap of ${title}. ${prose}${closing}`;
}

export async function writeRecapScript(
  title: string,
  summary: string,
  keyPoints: string[],
  documentText: string
): Promise<string> {
  const target = recapLengthForDocument(documentText);
  let bestScript = "";
  const wordCount = (text: string) =>
    text.trim().split(/\s+/).filter(Boolean).length;
  const prompt = [
    `Topic: ${title}`,
    `Summary:\n${summary.slice(0, 8000)}`,
    keyPoints.length
      ? `Key points:\n${keyPoints.join("\n").slice(0, 5000)}`
      : "",
    `Source passages sampled across the uploaded document:\n${samplePassages(documentText, 24000, 8)}`,
    `Write ${target.minWords} to ${target.maxWords} words, targeting about ${target.minutes} minutes at a normal speaking pace.`,
    "Cover the document's main sections, explain important ideas and their relationships, and walk through examples or applications supported by the source. Use natural transitions and brief recall questions, then finish with the key takeaways. Spell out abbreviations the first time.",
    "Use only information supported by the document. Do not invent facts, repeat passages, or add filler to reach the duration. If the document is too brief to support the target, give a shorter faithful recap.",
  ]
    .filter(Boolean)
    .join("\n\n");
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You turn study notes into a spoken revision recap for a student to listen to. Write plain spoken English only: no markdown, no bullet points, no headings, no emojis.",
          },
          {
            role: "user",
            content:
              prompt +
              (attempt
                ? `\n\nThe previous draft had only ${wordCount(bestScript)} words. Produce a complete expanded recap within the requested word range, adding source-supported explanations rather than repeating ideas.`
                : ""),
          },
        ],
        max_tokens: Math.ceil(target.maxWords * 2.2),
        temperature: 0.4,
        taskType: "summarization",
      });
      const text = llmMessageText(response.choices[0]?.message?.content)
        .replace(/[#*_`>|]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      const truncated = text.split(/\s+/).slice(0, target.maxWords).join(" ");
      const sentenceEnd = Math.max(
        truncated.lastIndexOf(". "),
        truncated.lastIndexOf("? "),
        truncated.lastIndexOf("! ")
      );
      const bounded =
        wordCount(text) <= target.maxWords
          ? text
          : sentenceEnd >= truncated.length * 0.7
            ? truncated.slice(0, sentenceEnd + 1)
            : truncated + ".";
      if (wordCount(bounded) > wordCount(bestScript)) bestScript = bounded;
      if (wordCount(bestScript) >= target.minWords) return bestScript;
    }
  } catch (error) {
    console.warn(
      "[audio-recap] Script generation failed, using the summary:",
      error
    );
  }
  // A short source or unavailable model must not be padded with invented material.
  return bestScript.length >= 200
    ? bestScript
    : scriptFromSummary(title, summary, keyPoints);
}

function removeOldAudio(url: string | null | undefined) {
  if (!url?.startsWith("/uploads/audio/")) return;
  try {
    fs.unlinkSync(resolveUploadPath(url.replace("/uploads/", "")));
  } catch {
    // Already gone.
  }
}

function present(row: AudioRecap | undefined, summaryUpdatedAt?: Date | null) {
  if (!row) return null;
  return {
    script: row.script,
    audioUrl: row.audioUrl,
    audioBytes: row.audioBytes,
    durationSeconds: row.durationSeconds,
    updatedAt: row.updatedAt,
    stale:
      !!summaryUpdatedAt &&
      summaryUpdatedAt.getTime() > row.updatedAt.getTime(),
  };
}

export async function getRecap(userId: number, documentId: number) {
  await assertAccess(userId, documentId);
  const db = await database();
  const [row] = await db
    .select()
    .from(audioRecaps)
    .where(eq(audioRecaps.documentId, documentId))
    .limit(1);
  const summary = await queries.getDocumentSummary(documentId);
  return {
    recap: present(row, summary?.updatedAt),
    hasSummary: !!summary,
    serverSpeech: ttsConfig().enabled,
    generating: inFlight.has(documentId),
  };
}

async function buildRecap(
  documentId: number,
  title: string
): Promise<AudioRecap> {
  const summary =
    (await queries.getDocumentSummary(documentId)) ??
    (await documentAi.generateSummaryForDocument(documentId));
  const doc = await documentAi.ensureDocumentText(documentId);
  const script = await writeRecapScript(
    title,
    summary.summary,
    summary.keyPoints ?? [],
    doc.extractedText ?? ""
  );

  let audioUrl: string | null = null;
  let audioBytes: number | null = null;
  let durationSeconds: number | null = Math.round(
    (script.split(/\s+/).length * 60) / RECAP_WORDS_PER_MINUTE
  );
  let voice: string | null = null;
  try {
    const speech = await synthesizeSpeech(script);
    const key = `audio/recap-doc-${documentId}-${Date.now()}.wav`;
    const file = resolveUploadPath(key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await fs.promises.writeFile(file, speech.wav);
    audioUrl = `/uploads/${key}`;
    audioBytes = speech.wav.length;
    durationSeconds = speech.durationSeconds;
    voice = speech.voice;
  } catch (error) {
    console.warn(
      `[audio-recap] Server speech unavailable for document ${documentId}; the app will read the script aloud.`,
      error
    );
  }

  const db = await database();
  const [existing] = await db
    .select()
    .from(audioRecaps)
    .where(eq(audioRecaps.documentId, documentId))
    .limit(1);
  const now = new Date();
  const values = {
    script,
    audioUrl,
    audioBytes,
    durationSeconds,
    voice,
    updatedAt: now,
  };
  if (existing) {
    removeOldAudio(existing.audioUrl);
    const [row] = await db
      .update(audioRecaps)
      .set(values)
      .where(eq(audioRecaps.id, existing.id))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(audioRecaps)
    .values({ documentId, createdAt: now, ...values })
    .returning();
  return row;
}

export async function generateRecap(userId: number, documentId: number) {
  const doc = await assertAccess(userId, documentId);
  const flags = await getFeatureFlags();
  if (!flags.voiceOutput || !flags.summarization) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Audio recaps are turned off by an administrator.",
    });
  }
  let job = inFlight.get(documentId);
  if (!job) {
    job = buildRecap(documentId, doc.title).finally(() =>
      inFlight.delete(documentId)
    );
    inFlight.set(documentId, job);
  }
  const row = await job;
  const summary = await queries.getDocumentSummary(documentId);
  return present(row, summary?.updatedAt)!;
}
