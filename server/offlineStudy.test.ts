import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { randomUUID } from "crypto";
import { existsSync, unlinkSync } from "fs";
import { getDb } from "./db";
import * as queries from "./queries";
import { canAccessDocument } from "./documentAccess";
import { syncOfflineStudyEvent } from "./offlineStudy";
import { runOfflineStudyMigration } from "./migrations/addOfflineStudy";
import type { OfflineStudyEvent } from "../shared/offlineStudy";

vi.mock("./db", () => ({ getDb: vi.fn() }));
vi.mock("./queries", () => ({ getDocumentById: vi.fn(), getDocumentQuizzes: vi.fn(), getQuizById: vi.fn(), getQuizQuestions: vi.fn(), getDocumentFlashcards: vi.fn(), getOrCreateProgress: vi.fn() }));
vi.mock("./documentAccess", () => ({ canAccessDocument: vi.fn() }));
vi.mock("./documentAiService", () => ({ ensureDocumentText: vi.fn() }));
vi.mock("./documentPreview", () => ({ createDocumentPreview: vi.fn(), previewHtml: vi.fn() }));
let client: Client;
let dbPath: string;
const event: OfflineStudyEvent = { eventId: "offline-test-1", documentId: 7, kind: "reading", occurredAt: Date.now() - 1000, minutes: 3 };
beforeEach(async () => {
  vi.resetAllMocks();
  dbPath = `scratch/offline-sync-${randomUUID()}.db`;
  client = createClient({ url: `file:./${dbPath}` });
  vi.mocked(getDb).mockResolvedValue(drizzle(client));
  await runOfflineStudyMigration(client);
  await client.executeMultiple(`
    CREATE TABLE progressTracking (id integer PRIMARY KEY, documentId integer, userId integer, quizzesAttempted integer DEFAULT 0, averageQuizScore real DEFAULT 0, flashcardsCreated integer DEFAULT 0, flashcardsReviewed integer DEFAULT 0, totalStudyTimeMinutes integer DEFAULT 0, currentStreak integer DEFAULT 0, longestStreak integer DEFAULT 0, lastStudyDate integer, lastActivityAt integer, createdAt integer, updatedAt integer);
    INSERT INTO progressTracking (id,documentId,userId) VALUES (1,7,3),(2,7,4);
    CREATE TABLE studySessions (id integer PRIMARY KEY AUTOINCREMENT,userId integer,documentId integer,startTime integer,endTime integer,durationMinutes integer,activityType text,createdAt integer);
    CREATE TABLE studentActivities (id integer PRIMARY KEY AUTOINCREMENT,userId integer,documentId integer,courseId integer,type text,metadata text,createdAt integer);
  `);
  vi.mocked(queries.getDocumentById).mockResolvedValue({ id: 7, userId: 3, courseId: 9 } as Awaited<ReturnType<typeof queries.getDocumentById>>);
  vi.mocked(canAccessDocument).mockResolvedValue(true);
  vi.mocked(queries.getDocumentQuizzes).mockResolvedValue([{ id: 11 }] as Awaited<ReturnType<typeof queries.getDocumentQuizzes>>);
  vi.mocked(queries.getQuizById).mockResolvedValue({ id: 11, documentId: 7 } as Awaited<ReturnType<typeof queries.getQuizById>>);
  vi.mocked(queries.getQuizQuestions).mockResolvedValue([{ id: 21, correctAnswer: "A" }, { id: 22, correctAnswer: "B" }] as Awaited<ReturnType<typeof queries.getQuizQuestions>>);
  vi.mocked(queries.getDocumentFlashcards).mockResolvedValue([{ id: 31 }, { id: 32 }] as Awaited<ReturnType<typeof queries.getDocumentFlashcards>>);
});
afterEach(() => {
  client.close();
  for (const suffix of ["", "-shm", "-wal"]) {
    try { if (existsSync(dbPath + suffix)) unlinkSync(dbPath + suffix); }
    catch (error) { if (!["EBUSY", "EPERM"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error; }
  }
});

describe("offline progress reconciliation", () => {
  it("records a retried session exactly once", async () => {
    await syncOfflineStudyEvent(3, event);
    await syncOfflineStudyEvent(3, event);
    expect((await client.execute("SELECT totalStudyTimeMinutes FROM progressTracking WHERE userId=3")).rows[0].totalStudyTimeMinutes).toBe(3);
    expect((await client.execute("SELECT count(*) AS n FROM studySessions")).rows[0].n).toBe(1);
  });
  it("keeps receipt keys separate for different accounts", async () => {
    await syncOfflineStudyEvent(3, event); await syncOfflineStudyEvent(4, event);
    expect((await client.execute("SELECT count(*) AS n FROM offlineStudyEvents")).rows[0].n).toBe(2);
  });
  it("rolls back the receipt when progress cannot commit", async () => {
    await client.execute("CREATE TRIGGER fail_progress BEFORE UPDATE ON progressTracking BEGIN SELECT RAISE(ABORT,'test failure'); END");
    await expect(syncOfflineStudyEvent(3, event)).rejects.toThrow();
    expect((await client.execute("SELECT count(*) AS n FROM offlineStudyEvents")).rows[0].n).toBe(0);
    await client.execute("DROP TRIGGER fail_progress");
    await syncOfflineStudyEvent(3, event);
    expect((await client.execute("SELECT totalStudyTimeMinutes FROM progressTracking WHERE userId=3")).rows[0].totalStudyTimeMinutes).toBe(3);
  });
  it("regrades quiz answers against the server's questions", async () => {
    await syncOfflineStudyEvent(3, { ...event, kind: "quiz", quizId: 11, answers: { "21": "A", "22": "wrong" } });
    const row = (await client.execute("SELECT quizzesAttempted,averageQuizScore FROM progressTracking WHERE userId=3")).rows[0];
    expect(row.quizzesAttempted).toBe(1); expect(row.averageQuizScore).toBe(50);
  });
  it("counts each reviewed card once per session", async () => {
    await syncOfflineStudyEvent(3, { ...event, kind: "flashcards", cardIds: [31, 31, 32] });
    expect((await client.execute("SELECT flashcardsReviewed FROM progressTracking WHERE userId=3")).rows[0].flashcardsReviewed).toBe(2);
  });
  it("rejects revoked access and cards from another document", async () => {
    vi.mocked(canAccessDocument).mockResolvedValueOnce(false);
    await expect(syncOfflineStudyEvent(3, event)).rejects.toThrow("no longer have access");
    await expect(syncOfflineStudyEvent(3, { ...event, kind: "flashcards", cardIds: [999] })).rejects.toThrow("no longer available");
    expect((await client.execute("SELECT count(*) AS n FROM offlineStudyEvents")).rows[0].n).toBe(0);
  });
});
