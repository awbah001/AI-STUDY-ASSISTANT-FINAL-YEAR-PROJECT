import { createHash } from "node:crypto";
import { readFile, stat, access } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import {
  documentAnnotations,
  flashcards,
  type Document,
  type User,
} from "../drizzle/schema";
import {
  isPageSelection,
  type ReaderSelection,
} from "../shared/documentReader";
import { resolveUploadPath } from "./_core/uploads";
import { canAccessDocument } from "./documentAccess";
import * as queries from "./queries";
import { getDb } from "./db";

const require = createRequire(import.meta.url);
export const PDFJS_ROOT = path.dirname(
  require.resolve("pdfjs-dist/package.json")
);
const MAX_PDF_BYTES = 60 * 1024 * 1024;

export async function requireReaderDocument(
  user: User,
  id: number
): Promise<Document> {
  const doc = await queries.getDocumentById(id);
  if (!doc || !(await canAccessDocument(user.id, doc))) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Document unavailable.",
    });
  }
  if (
    !doc.fileName.toLowerCase().endsWith(".pdf") ||
    !doc.fileUrl.startsWith("/uploads/")
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The learning reader requires a locally uploaded PDF.",
    });
  }
  return doc;
}

export async function readReaderPdf(doc: Document) {
  const file = resolveUploadPath(
    doc.fileUrl.slice("/uploads/".length).split(/[?#]/)[0]
  );
  const info = await stat(file);
  if (info.size > MAX_PDF_BYTES)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This PDF exceeds the 60 MB reader limit.",
    });
  const buffer = await readFile(file);
  if (!buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"))) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This file does not contain a valid PDF.",
    });
  }
  return {
    buffer,
    revision: createHash("sha256").update(buffer).digest("hex"),
  };
}

async function openPdf(buffer: Buffer) {
  const { getDocument, GlobalWorkerOptions } = await import(
    "pdfjs-dist/legacy/build/pdf.mjs"
  );
  GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")
  ).href;
  return getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    standardFontDataUrl:
      path.join(PDFJS_ROOT, "standard_fonts").replace(/\\/g, "/") + "/",
    cMapUrl: path.join(PDFJS_ROOT, "cmaps").replace(/\\/g, "/") + "/",
    cMapPacked: true,
    useSystemFonts: true,
  }).promise;
}

/** Internal indexing helper. Callers must authorize the document before invoking this. */
export async function pdfIndexSource(doc: Document) {
  const { buffer, revision } = await readReaderPdf(doc);
  const pdf = await openPdf(buffer);
  try {
    if (pdf.numPages > 2000) throw new Error("This PDF exceeds the 2,000-page indexing limit.");
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const content = await (await pdf.getPage(i)).getTextContent();
      pages.push(content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join(""));
    }
    return { pages, revision };
  } finally { await pdf.destroy(); }
}

export async function getReaderInfo(user: User, id: number) {
  const doc = await requireReaderDocument(user, id);
  const { buffer, revision } = await readReaderPdf(doc);
  const pdf = await openPdf(buffer);
  try {
    return {
      id: doc.id,
      title: doc.title,
      courseId: doc.courseId,
      revision,
      pages: pdf.numPages,
      ocrAvailable: await ocrAvailable(),
    };
  } finally {
    await pdf.destroy();
  }
}

export async function readVerifiedPage(
  user: User,
  input: Pick<ReaderSelection, "documentId" | "revision" | "page">
) {
  const doc = await requireReaderDocument(user, input.documentId);
  const { buffer, revision } = await readReaderPdf(doc);
  if (revision !== input.revision)
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "This document changed. Reopen it before using a saved selection.",
    });
  const pdf = await openPdf(buffer);
  try {
    if (input.page < 1 || input.page > pdf.numPages)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Page does not exist.",
      });
    const page = await pdf.getPage(input.page);
    const content = await page.getTextContent();
    const text = content.items
      .map(item => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
      .join("");
    return { doc, text };
  } finally {
    await pdf.destroy();
  }
}

export async function ocrAvailable() {
  if (!process.env.OCR_LANG_PATH) return false;
  try {
    await access(path.join(process.env.OCR_LANG_PATH, "eng.traineddata.gz"));
    return true;
  } catch {
    return false;
  }
}

let ocrBusy = false;
/** Pixels are rendered from the authorized original. No remote image URLs or client screenshots are trusted. */
export async function recognizeReaderRegion(
  user: User,
  selection: ReaderSelection
): Promise<string> {
  if (!selection.region)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Select a page region.",
    });
  if (!(await ocrAvailable()))
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Text recognition is unavailable. Select searchable text, or ask an administrator to configure OCR. Images have not been interpreted.",
    });
  if (ocrBusy)
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Text recognition is busy. Try again shortly.",
    });
  ocrBusy = true;
  let worker:
    | Awaited<ReturnType<typeof import("tesseract.js").createWorker>>
    | undefined;
  let pdf: Awaited<ReturnType<typeof openPdf>> | undefined;
  try {
    const doc = await requireReaderDocument(user, selection.documentId);
    const { buffer, revision } = await readReaderPdf(doc);
    if (revision !== selection.revision)
      throw new TRPCError({
        code: "CONFLICT",
        message: "Document changed. Reopen it.",
      });
    pdf = await openPdf(buffer);
    if (selection.page > pdf.numPages)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Page does not exist.",
      });
    const page = await pdf.getPage(selection.page);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({
      scale: Math.min(2, 1800 / Math.max(base.width, base.height)),
    });
    const { createCanvas } = await import("@napi-rs/canvas");
    const canvas = createCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height)
    );
    await page.render({
      canvas: canvas as any,
      canvasContext: canvas.getContext("2d") as any,
      viewport,
    }).promise;
    const r = selection.region;
    const x = Math.floor(r.x * canvas.width),
      y = Math.floor(r.y * canvas.height);
    const w = Math.max(
      1,
      Math.min(canvas.width - x, Math.ceil(r.width * canvas.width))
    );
    const h = Math.max(
      1,
      Math.min(canvas.height - y, Math.ceil(r.height * canvas.height))
    );
    const crop = createCanvas(w, h);
    crop.getContext("2d").drawImage(canvas, x, y, w, h, 0, 0, w, h);
    const { createWorker } = await import("tesseract.js");
    worker = await createWorker("eng", 1, {
      langPath: path.resolve(process.env.OCR_LANG_PATH!),
      cacheMethod: "none",
      gzip: true,
    });
    const activeWorker = worker;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        activeWorker.recognize(crop.toBuffer("image/png")),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () =>
              reject(
                new Error(
                  "Text recognition timed out. Select a smaller region."
                )
              ),
            30000
          );
        }),
      ]);
      const text = result.data.text.trim();
      if (text.length < 3 || result.data.confidence < 25)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "No reliable text was recognized. The image has not been interpreted. Try a clearer region or searchable PDF.",
        });
      return text.slice(0, 12000);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  } finally {
    try {
      if (worker) await worker.terminate();
    } finally {
      try {
        if (pdf) await pdf.destroy();
      } finally {
        ocrBusy = false;
      }
    }
  }
}

export async function verifyReaderSelection(
  user: User,
  selection: ReaderSelection
) {
  const page = await readVerifiedPage(user, selection);
  if (selection.region) {
    // Always recognize the actual region, even if the client also supplied text.
    return {
      ...page,
      excerpt: await recognizeReaderRegion(user, selection),
      recognition: "ocr" as const,
    };
  }
  if (!isPageSelection(page.text, selection.text))
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "The selection could not be verified on this page. Select it again.",
    });
  return { ...page, excerpt: selection.text, recognition: "text" as const };
}

export async function listReaderAnnotations(
  user: User,
  documentId: number,
  revision: string
) {
  await requireReaderDocument(user, documentId);
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Database unavailable.",
    });
  return db
    .select()
    .from(documentAnnotations)
    .where(
      and(
        eq(documentAnnotations.userId, user.id),
        eq(documentAnnotations.documentId, documentId),
        eq(documentAnnotations.revision, revision)
      )
    )
    .orderBy(desc(documentAnnotations.id))
    .limit(1000);
}

export async function saveReaderAnnotation(
  user: User,
  selection: ReaderSelection,
  kind: "highlight" | "note" | "flashcards",
  body: string,
  requestId: string,
  verified?: Awaited<ReturnType<typeof verifyReaderSelection>>
) {
  const context = verified ?? (await verifyReaderSelection(user, selection));
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Database unavailable.",
    });
  const rows = await db
    .insert(documentAnnotations)
    .values({
      userId: user.id,
      documentId: context.doc.id,
      revision: selection.revision,
      page: selection.page,
      kind,
      excerpt: context.excerpt,
      rects: selection.region ? [selection.region] : selection.rects,
      body,
      requestId,
      createdAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();
  if (rows[0]) return rows[0];
  const existing = await db
    .select()
    .from(documentAnnotations)
    .where(
      and(
        eq(documentAnnotations.userId, user.id),
        eq(documentAnnotations.requestId, requestId)
      )
    )
    .limit(1);
  if (
    existing[0]?.documentId !== selection.documentId ||
    existing[0]?.revision !== selection.revision ||
    existing[0]?.page !== selection.page ||
    existing[0]?.kind !== kind ||
    existing[0]?.excerpt !== context.excerpt
  ) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This save identifier was already used for another selection.",
    });
  }
  return existing[0];
}

/** Persist generated cards and their source receipt in one transaction. Retries cannot duplicate cards. */
export async function saveReaderFlashcards(
  user: User,
  selection: ReaderSelection,
  cards: Array<{ question: string; answer: string }>,
  requestId: string,
  context: Awaited<ReturnType<typeof verifyReaderSelection>>
) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  return db.transaction(async tx => {
    const body = `Created ${cards.length} flashcards from this selection. Open the document's Flashcards tab to study them.`;
    const [receipt] = await tx
      .insert(documentAnnotations)
      .values({
        userId: user.id,
        documentId: context.doc.id,
        revision: selection.revision,
        page: selection.page,
        kind: "flashcards",
        excerpt: context.excerpt,
        rects: selection.region ? [selection.region] : selection.rects,
        body,
        requestId,
        createdAt: new Date(),
      })
      .onConflictDoNothing()
      .returning();
    if (!receipt) {
      const [prior] = await tx
        .select()
        .from(documentAnnotations)
        .where(
          and(
            eq(documentAnnotations.userId, user.id),
            eq(documentAnnotations.requestId, requestId)
          )
        )
        .limit(1);
      if (
        prior?.documentId !== selection.documentId ||
        prior?.revision !== selection.revision ||
        prior?.page !== selection.page ||
        prior?.kind !== "flashcards" ||
        prior?.excerpt !== context.excerpt
      )
        throw new TRPCError({
          code: "CONFLICT",
          message: "This request identifier was already used.",
        });
      return prior.body;
    }
    for (const card of cards)
      await tx.insert(flashcards).values({
        documentId: context.doc.id,
        userId: user.id,
        question: card.question,
        answer: `${card.answer}\n\nSource: ${context.doc.title}, page ${selection.page}.`,
      });
    return body;
  });
}

export async function deleteReaderAnnotation(user: User, id: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const [record] = await db
    .select()
    .from(documentAnnotations)
    .where(
      and(
        eq(documentAnnotations.id, id),
        eq(documentAnnotations.userId, user.id)
      )
    )
    .limit(1);
  if (!record) throw new TRPCError({ code: "NOT_FOUND" });
  await requireReaderDocument(user, record.documentId);
  await db
    .delete(documentAnnotations)
    .where(
      and(
        eq(documentAnnotations.id, id),
        eq(documentAnnotations.userId, user.id)
      )
    );
  return { success: true };
}
