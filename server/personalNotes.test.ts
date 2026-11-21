import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { getDb } from "./db";
import { personalNotesRouter } from "./personalNotesRouter";
import { runPersonalNotesMigration } from "./migrations/addPersonalNotes";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({ getDb: vi.fn() }));
vi.mock("./settings", () => ({ isMaintenanceMode: vi.fn(async () => false) }));
let client: Client;
let file: string;
function caller(id = 1, role = "user") {
  return personalNotesRouter.createCaller({
    user: { id, role },
    req: {},
    res: {},
  } as TrpcContext);
}
const input = () => ({
  title: "Biology revision",
  body: "Photosynthesis converts light energy.",
  requestId: randomUUID(),
});
beforeEach(async () => {
  file = `tmp/personal-notes-${randomUUID()}.db`;
  client = createClient({ url: `file:./${file}` });
  vi.mocked(getDb).mockResolvedValue(drizzle(client));
  await runPersonalNotesMigration(client);
  await client.executeMultiple(`CREATE TABLE chatMessages (id integer PRIMARY KEY,documentId integer,userId integer,role text,content text,createdAt integer,retrievalContext text);
    CREATE TABLE courses (id integer PRIMARY KEY,title text,code text,isActive integer);
    CREATE TABLE courseEnrollments (courseId integer,studentId integer);
    INSERT INTO courses VALUES (10,'Biology','BIO101',1),(20,'Networks','NET101',1),(30,'Archived','OLD101',0);
    INSERT INTO courseEnrollments VALUES (10,1),(20,2),(30,1);
    CREATE TABLE generalChatMessages (id integer PRIMARY KEY,userId integer,role text,content text,courseId integer,createdAt integer,retrievalContext text);
    INSERT INTO chatMessages VALUES (10,9,1,'assistant','Owned AI explanation',1,NULL),(11,9,2,'assistant','Private other response',1,NULL),(12,9,1,'user','User question',1,NULL);
    INSERT INTO generalChatMessages VALUES (10,1,'assistant','General explanation',NULL,1,NULL);`);
});
afterEach(async () => {
  client.close();
  await unlink(file).catch(() => {});
});
describe("private personal notes", () => {
  it("organizes and filters owned notes by course, topic and named collection", async () => {
    const api = caller();
    const note = await api.create({
      ...input(),
      courseId: 10,
      topic: "Cells",
      collection: "Exam revision",
    });
    await api.create(input());
    await caller(2).create({
      ...input(),
      courseId: 20,
      topic: "Secret topic",
      collection: "Private collection",
    });
    expect(
      (
        await api.list({
          courseId: 10,
          topic: "Cells",
          collection: "Exam revision",
        })
      ).items.map(n => n.id)
    ).toEqual([note.id]);
    expect((await api.list({ courseId: 0 })).total).toBe(1);
    expect((await api.list({ collection: "" })).total).toBe(1);
    expect((await api.list({ search: "Exam revision" })).total).toBe(1);
    const options = await api.organization();
    expect(options.courses.map(c => c.id)).toEqual([10]);
    expect(options.topics).toEqual(["Cells"]);
    expect(options.collections).toEqual(["Exam revision"]);
    await api.update({
      id: note.id,
      version: note.version,
      title: note.title,
      body: note.body,
      courseId: null,
      topic: "",
      collection: "",
    });
    expect((await api.list({ courseId: 10 })).total).toBe(0);
    expect((await api.organization()).collections).toEqual([]);
  });
  it("rejects unenrolled course assignments and preserves an old link after enrollment ends", async () => {
    const api = caller();
    for (const courseId of [20, 30, 999])
      await expect(api.create({ ...input(), courseId })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    const note = await api.create({ ...input(), courseId: 10 });
    await client.execute("DELETE FROM courseEnrollments WHERE studentId=1");
    const edited = await api.update({
      id: note.id,
      version: note.version,
      title: "Revised",
      body: note.body,
      courseId: 10,
      collection: "Retained",
    });
    expect(edited.courseId).toBe(10);
    expect((await api.organization()).linkedCourseIds).toEqual([10]);
    expect((await api.organization()).courses).toEqual([]);
    await expect(
      api.update({
        id: note.id,
        version: edited.version,
        title: "Bad",
        body: note.body,
        courseId: 20,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await runPersonalNotesMigration(client);
    expect((await api.list({})).items[0]).toMatchObject({
      courseId: 10,
      collection: "Retained",
    });
  });
  it("persists tags, searches them and sorts the complete result set", async () => {
    const api = caller();
    const first = await api.create({
      ...input(),
      title: "Zoology",
      tags: ["Week1", "Biology"],
    });
    const second = await api.create({
      ...input(),
      title: "Algorithms",
      tags: ["Computing"],
    });
    const matches = await api.list({ search: "Week1" });
    expect(matches.total).toBe(1);
    expect(matches.items[0].tags).toEqual(["Week1", "Biology"]);
    expect((await api.list({ order: "title" })).items.map(n => n.id)).toEqual([
      second.id,
      first.id,
    ]);
    await api.update({
      id: first.id,
      version: first.version,
      title: first.title,
      body: first.body,
      tags: ["Changed"],
    });
    expect((await api.list({ search: "Week1" })).total).toBe(0);
    expect((await api.list({ search: "Changed" })).items[0].id).toBe(first.id);
  });
  it("creates, searches, edits and deletes a personal note", async () => {
    const api = caller();
    const note = await api.create(input());
    expect((await api.list({ search: "light" })).items.map(n => n.id)).toEqual([
      note.id,
    ]);
    const edited = await api.update({
      id: note.id,
      version: note.version,
      title: "Edited",
      body: "New content",
    });
    expect(edited.version).toBe(2);
    expect((await api.list({ search: "light" })).items).toEqual([]);
    await api.remove({ id: note.id, version: edited.version });
    expect((await api.list({})).items).toEqual([]);
  });
  it("does not reveal or mutate another student's notes", async () => {
    const note = await caller().create(input());
    expect((await caller(2).list({})).items).toEqual([]);
    await expect(
      caller(2).update({
        id: note.id,
        version: 1,
        title: "Stolen",
        body: "Changed",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      caller(2).remove({ id: note.id, version: 1 })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await caller().list({})).items[0].title).toBe(note.title);
  });
  it("rejects stale edits and stale deletion without losing the newer content", async () => {
    const api = caller();
    const note = await api.create(input());
    await api.update({
      id: note.id,
      version: 1,
      title: "Latest",
      body: "Latest content",
    });
    await expect(
      api.update({ id: note.id, version: 1, title: "Old", body: "Old content" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(api.remove({ id: note.id, version: 1 })).rejects.toMatchObject(
      { code: "CONFLICT" }
    );
    expect((await api.list({})).items[0].body).toBe("Latest content");
  });
  it("deduplicates retries but rejects a reused request with changed content", async () => {
    const value = input();
    const first = await caller().create(value);
    expect((await caller().create(value)).id).toBe(first.id);
    await expect(
      caller().create({ ...value, tags: ["Changed"] })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      caller().create({ ...value, body: "Changed" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("copies only owned assistant messages and preserves the source", async () => {
    const note = await caller().saveResponse({
      documentId: 9,
      content: "Owned AI explanation",
    });
    expect(note).toMatchObject({
      body: "Owned AI explanation",
      sourceMessageId: 10,
      documentId: 9,
      sourceChannel: "document",
    });
    expect(
      (
        await caller().saveResponse({
          documentId: 9,
          content: "Owned AI explanation",
        })
      ).id
    ).toBe(note.id);
    for (const content of [
      "Private other response",
      "User question",
      "Invented response",
    ])
      await expect(
        caller().saveResponse({ documentId: 9, content })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      caller().saveResponse({ documentId: 8, content: "Owned AI explanation" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const general = await caller().saveResponse({
      documentId: 0,
      content: "General explanation",
    });
    expect(general.id).not.toBe(note.id);
    expect(general.documentId).toBeNull();
  });
  it("preserves notes on repeated migrations and treats search wildcards literally", async () => {
    await caller().create({ ...input(), title: "100% _correct_" });
    await caller().create(input());
    await runPersonalNotesMigration(client);
    expect((await caller().list({ search: "%" })).items).toHaveLength(1);
    expect((await caller().list({ search: "_" })).items).toHaveLength(1);
    expect((await caller().list({ search: "' OR 1=1 --" })).items).toHaveLength(
      0
    );
  });
  it("enforces student role and rejects empty notes", async () => {
    await expect(caller(1, "lecturer").list({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      caller().create({ ...input(), title: " " })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller().create({ ...input(), body: " " })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
