import { mkdirSync } from "node:fs";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { getDb } from "../db";
import * as queries from "../queries";
import { getAiService } from "../ai";
import { retrieveRelevantChunkHits } from "./index";
import { loadVectorStore } from "./faissFlat";
import { embedText } from "./embeddings";
import {
  resolveScopedDocuments,
  retrieveScopedEvidence,
  runScopedChat,
  validateScopedClaims,
  MISSING_SCOPED_EVIDENCE,
  scopeKey,
} from "./scopedChat";
import { runScopedRagMigration } from "../migrations/addScopedRag";
import type { User, Document } from "../../drizzle/schema";

vi.mock("../db", () => ({ getDb: vi.fn() }));
vi.mock("../queries", () => ({
  getDocumentById: vi.fn(),
  getDocumentChatHistory: vi.fn(),
  getGeneralChatHistory: vi.fn(),
  createChatMessage: vi.fn(),
  createGeneralChatMessage: vi.fn(),
}));
vi.mock("../ai", () => ({ getAiService: vi.fn() }));
vi.mock("./embeddings", () => ({ embedText: vi.fn(async () => [1, 0]) }));
vi.mock("./index", () => ({ retrieveRelevantChunkHits: vi.fn() }));
vi.mock("./faissFlat", () => ({ loadVectorStore: vi.fn() }));

let client: Client;
let dbFile: string;
let files: string[];
let docs: Document[];
const student = { id: 21, role: "user" } as User;
const text = "Photosynthesis converts light energy into chemical energy.";
const revision = createHash("sha256").update(text).digest("hex");
const generate = vi.fn();

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(embedText).mockResolvedValue([1, 0]);
  dbFile = `tmp/scoped-rag-${randomUUID()}.db`;
  mkdirSync("tmp", { recursive: true });
  client = createClient({ url: `file:./${dbFile}` });
  vi.mocked(getDb).mockResolvedValue(drizzle(client));
  await client.executeMultiple(`
    CREATE TABLE courses (id integer PRIMARY KEY, lecturerId integer, isActive integer);
    CREATE TABLE courseEnrollments (courseId integer, studentId integer);
    CREATE TABLE documents (id integer PRIMARY KEY, userId integer, title text, description text, subject text, fileUrl text, fileKey text, fileName text, fileSize integer, mimeType text, extractedText text, isFavorite integer, isPublic integer, courseId integer, materialType text, processingStatus text, processingError text, reportCount integer, moderationNote text, createdAt integer, updatedAt integer);
    CREATE TABLE chatMessages (id integer PRIMARY KEY, content text);
    CREATE TABLE generalChatMessages (id integer PRIMARY KEY, content text);
    INSERT INTO chatMessages VALUES (1,'Legacy history is retained');
    INSERT INTO courses VALUES (10,7,1),(20,8,1),(30,7,0);
    INSERT INTO courseEnrollments VALUES (10,21),(30,21),(20,22);
  `);
  await runScopedRagMigration(client);
  await runScopedRagMigration(client);
  files = [];
  await mkdir("data/uploads/documents", { recursive: true });
  const combinations = [
    [1, 7, 10, 0],
    [2, 8, 20, 1],
    [3, 22, 10, 1],
    [4, 21, null, 0],
    [5, 7, 30, 0],
  ];
  docs = [];
  for (const [id, owner, courseId, isPublic] of combinations) {
    const name = `scope-test-${randomUUID()}.txt`;
    const file = `data/uploads/documents/${name}`;
    files.push(file);
    await writeFile(file, text);
    const doc = {
      id,
      userId: owner,
      courseId,
      isPublic: !!isPublic,
      fileUrl: `/uploads/documents/${name}`,
      fileKey: `documents/${name}`,
      fileName: name,
      title: `Material ${id}`,
      extractedText: text,
    } as Document;
    docs.push(doc);
    await client.execute({
      sql: "INSERT INTO documents (id,userId,courseId,isPublic,fileUrl,fileKey,fileName,title,extractedText) VALUES (?,?,?,?,?,?,?,?,?)",
      args: [
        id!,
        owner!,
        courseId,
        isPublic!,
        doc.fileUrl,
        doc.fileKey,
        doc.fileName,
        doc.title,
        text,
      ],
    });
  }
  vi.mocked(queries.getDocumentById).mockImplementation(async id =>
    docs.find(d => d.id === id)
  );
  vi.mocked(queries.getDocumentChatHistory).mockResolvedValue([]);
  vi.mocked(queries.getGeneralChatHistory).mockResolvedValue([]);
  vi.mocked(loadVectorStore).mockResolvedValue({
    dim: 1,
    chunks: [text],
    vectors: [[1]],
    revision,
  });
  vi.mocked(retrieveRelevantChunkHits).mockImplementation(async id => [
    { documentId: id, chunk: text, score: 0.8, revision },
  ]);
  generate.mockResolvedValue({
    content: JSON.stringify({
      claims: [
        {
          text: "Light energy is converted into chemical energy.",
          evidenceIds: [1],
        },
      ],
    }),
  });
  vi.mocked(getAiService).mockReturnValue({ generate } as any);
});
afterEach(async () => {
  client?.close();
  await Promise.all(files.map(f => unlink(f)));
  for (const suffix of ["", "-wal", "-shm"])
    await unlink(dbFile + suffix).catch(() => undefined);
});

describe("scoped course authority and isolation", () => {
  it("includes only current lecturer material from active enrolled courses", async () => {
    expect(
      (await resolveScopedDocuments(student, { type: "enrolled" })).map(
        d => d.id
      )
    ).toEqual([1]);
    await expect(
      resolveScopedDocuments(student, { type: "course", courseId: 20 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      resolveScopedDocuments(student, { type: "course", courseId: 30 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      resolveScopedDocuments(student, { type: "document", documentId: 2 })
    ).rejects.toThrow();
    await expect(
      resolveScopedDocuments(student, { type: "document", documentId: 3 })
    ).rejects.toThrow();
  });
  it("allows an explicit personal document without treating it as enrolled course material", async () => {
    expect(
      (
        await resolveScopedDocuments(student, {
          type: "document",
          documentId: 4,
        })
      ).map(d => d.id)
    ).toEqual([4]);
    await expect(
      resolveScopedDocuments(
        { ...student, id: 22 },
        { type: "document", documentId: 4 }
      )
    ).rejects.toThrow();
    await expect(
      resolveScopedDocuments(
        { ...student, role: "lecturer" },
        { type: "enrolled" }
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("authorizes before retrieval or generation", async () => {
    await expect(
      runScopedChat(student, {
        documentId: 0,
        message: "Read the private file",
        retrievalScope: { type: "course", courseId: 20 },
      })
    ).rejects.toThrow();
    expect(retrieveRelevantChunkHits).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });
  it("does not silently change an unauthorized requested scope", async () => {
    await expect(
      retrieveScopedEvidence(
        student,
        { type: "document", documentId: 2 },
        "Question"
      )
    ).rejects.toThrow();
    expect(loadVectorStore).not.toHaveBeenCalled();
  });
});

describe("fresh evidence, context and references", () => {
  it("embeds a scoped question once across multiple authorized materials", async () => {
    await client.execute("UPDATE documents SET userId=7 WHERE id=3");
    const result = await retrieveScopedEvidence(student, { type: "enrolled" }, "Photosynthesis");
    expect(result.sources.map(source => source.documentId)).toEqual([1, 3]);
    expect(embedText).toHaveBeenCalledTimes(1);
    expect(retrieveRelevantChunkHits).toHaveBeenCalledTimes(2);
    for (const call of vi.mocked(retrieveRelevantChunkHits).mock.calls) expect(call[3]).toEqual([1, 0]);
  });
  it("does not call the model without supporting retrieval", async () => {
    vi.mocked(retrieveRelevantChunkHits).mockResolvedValue([]);
    const result = await runScopedChat(student, {
      documentId: 0,
      message: "Unsupported topic",
      retrievalScope: { type: "enrolled" },
    });
    expect(result.aiResponse).toBe(MISSING_SCOPED_EVIDENCE);
    expect(generate).not.toHaveBeenCalled();
  });
  it("rejects stale and unversioned indexes without using their content", async () => {
    vi.mocked(loadVectorStore).mockResolvedValueOnce({
      dim: 1,
      chunks: ["Stale"],
      vectors: [[1]],
    });
    expect(
      (
        await retrieveScopedEvidence(
          student,
          { type: "document", documentId: 1 },
          "Question"
        )
      ).sources
    ).toEqual([]);
    await writeFile(files[0], "Changed material");
    expect(
      (
        await retrieveScopedEvidence(
          student,
          { type: "document", documentId: 1 },
          "Question"
        )
      ).sources
    ).toEqual([]);
    expect(retrieveRelevantChunkHits).not.toHaveBeenCalled();
  });
  it("uses only same-scope past user questions and never treats past assistant answers as evidence", async () => {
    vi.mocked(queries.getGeneralChatHistory).mockResolvedValue([
      {
        role: "assistant",
        content: "REVOKED_PRIVATE_INFORMATION",
        retrievalContext: { key: "course:10" },
      },
      {
        role: "user",
        content: "Where is photosynthesis?",
        retrievalContext: { key: "course:10" },
      },
      {
        role: "user",
        content: "OTHER_SCOPE_CANARY",
        retrievalContext: { key: "course:20" },
      },
    ] as any);
    const result = await runScopedChat(student, {
      documentId: 0,
      message: "What energy does it convert?",
      retrievalScope: { type: "course", courseId: 10 },
    });
    const payload = JSON.stringify(generate.mock.calls[0][0]);
    expect(payload).toContain("Where is photosynthesis?");
    expect(payload).not.toContain("REVOKED_PRIVATE_INFORMATION");
    expect(payload).not.toContain("OTHER_SCOPE_CANARY");
    expect(result.retrievalContext.key).toBe("course:10");
    expect(queries.createGeneralChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        retrievalContext: expect.objectContaining({ key: "course:10" }),
      })
    );
  });
  it("rejects invented evidence IDs and ungrounded model output", async () => {
    generate.mockResolvedValue({
      content: JSON.stringify({
        claims: [{ text: "Unsupported answer", evidenceIds: [999] }],
      }),
    });
    const result = await runScopedChat(student, {
      documentId: 0,
      message: "Question",
      retrievalScope: { type: "enrolled" },
    });
    expect(result.aiResponse).toBe(MISSING_SCOPED_EVIDENCE);
    expect(result.sources).toEqual([]);
  });
  it("builds source labels from authorized records and gives the model no tools", async () => {
    const result = await runScopedChat(student, {
      documentId: 0,
      message: "Explain",
      retrievalScope: { type: "enrolled" },
    });
    expect(result.aiResponse).toContain("Material 1");
    expect(result.sources[0].documentId).toBe(1);
    expect(generate.mock.calls[0][0].tools).toBeUndefined();
    expect(generate.mock.calls[0][0].messages[0].content).toContain(
      "untrusted data"
    );
  });
  it("refuses to save a reply when enrollment is revoked during generation", async () => {
    generate.mockImplementationOnce(async () => {
      await client.execute(
        "DELETE FROM courseEnrollments WHERE studentId=21 AND courseId=10"
      );
      return {
        content: JSON.stringify({
          claims: [{ text: "Answer", evidenceIds: [1] }],
        }),
      };
    });
    await expect(
      runScopedChat(student, {
        documentId: 0,
        message: "Question",
        retrievalScope: { type: "enrolled" },
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(queries.createGeneralChatMessage).not.toHaveBeenCalled();
  });
  it("refuses to save a reply when source bytes change during generation", async () => {
    generate.mockImplementationOnce(async () => {
      await writeFile(files[0], "Replacement");
      return {
        content: JSON.stringify({
          claims: [{ text: "Answer", evidenceIds: [1] }],
        }),
      };
    });
    await expect(
      runScopedChat(student, {
        documentId: 0,
        message: "Question",
        retrievalScope: { type: "enrolled" },
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("keeps existing history through repeatable additive migration", async () => {
    expect(
      (
        await client.execute(
          "SELECT content,retrievalContext FROM chatMessages"
        )
      ).rows[0]
    ).toMatchObject({
      content: "Legacy history is retained",
      retrievalContext: null,
    });
  });
  it("does not retain model-supplied navigation links", () => {
    expect(
      validateScopedClaims(
        { claims: [{ text: "https://invalid.example", evidenceIds: [1] }] },
        [{ documentId: 1 } as any]
      )
    ).toBeNull();
    const answer = validateScopedClaims(
      {
        claims: [
          {
            text: "[Fake source](https://evil.example) <script>bad</script>",
            evidenceIds: [1],
          },
        ],
      },
      [
        {
          documentId: 1,
          documentTitle: "Actual material",
          courseId: 10,
          excerpt: text,
          sourceId: "a".repeat(24),
        },
      ]
    );
    expect(answer?.answer).not.toContain("https://");
    expect(answer?.answer).not.toContain("<script>");
    expect(scopeKey({ type: "document", documentId: 1 })).not.toBe(
      scopeKey({ type: "course", courseId: 1 })
    );
  });
});
