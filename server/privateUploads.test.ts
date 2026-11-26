import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import * as schema from "../drizzle/schema";
import { getDb } from "./db";
import { sdk } from "./_core/sdk";
import { registerPrivateUploads, uploadKey } from "./privateUploads";
import { resolveUploadPath } from "./_core/uploads";

vi.mock("./db", () => ({ getDb: vi.fn() }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: vi.fn() } }));
vi.mock("./lecturerQueries", () => ({
  getCourseById: vi.fn(async () => ({ lecturerId: 7, isActive: true })),
  isStudentEnrolled: vi.fn(async (id: number) => id === 1),
}));
let client: Client;
let server: Server;
let base: string;
let key: string;
beforeEach(async () => {
  client = createClient({ url: "file::memory:" });
  vi.mocked(getDb).mockResolvedValue(drizzle(client));
  for (const table of [schema.users, schema.courses, schema.documents, schema.assignments, schema.assignmentSubmissions, schema.generatedSlides, schema.generatedVideos]) {
    const config = getTableConfig(table);
    await client.execute(`CREATE TABLE "${config.name}" (${config.columns.map(c => `"${c.name}" ${c.getSQLType()}${c.primary ? " PRIMARY KEY" : ""}`).join(",")})`);
  }
  key = `1/documents/privacy-${randomUUID()}.txt`;
  await mkdir(resolveUploadPath("1/documents"), { recursive: true });
  await writeFile(resolveUploadPath(key), "Private lecture material");
  await client.execute({ sql: "INSERT INTO documents (id,userId,isPublic,fileUrl,fileKey) VALUES (1,1,0,?,?)", args: [`/uploads/${key}`, key] });
  vi.mocked(sdk.authenticateRequest).mockImplementation(async req => {
    const value = req.headers.authorization;
    if (!value || value === "Bearer revoked") throw new Error("No session");
    return { id: Number(value.slice(7)), role: "user", isBanned: false } as schema.User;
  });
  const app = express();
  app.use(express.json());
  registerPrivateUploads(app);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.on("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterEach(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  client.close();
  await unlink(resolveUploadPath(key));
});

describe("private upload delivery", () => {
  it("denies anonymous and other-account direct URLs, including HEAD", async () => {
    expect((await fetch(`${base}/uploads/${key}`)).status).toBe(401);
    expect((await fetch(`${base}/uploads/${key}`, { headers: { Authorization: "Bearer 2" } })).status).toBe(404);
    expect((await fetch(`${base}/uploads/${key}`, { method: "HEAD" })).status).toBe(401);
  });
  it("serves owners without shared caching and allows enrolled course readers", async () => {
    const result = await fetch(`${base}/uploads/${key}`, { headers: { Authorization: "Bearer 1" } });
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(await result.text()).toBe("Private lecture material");
    await client.execute("UPDATE documents SET userId=9,courseId=4 WHERE id=1");
    expect((await fetch(`${base}/uploads/${key}`, { headers: { Authorization: "Bearer 1" } })).status).toBe(200);
    expect((await fetch(`${base}/uploads/${key}`, { headers: { Authorization: "Bearer 2" } })).status).toBe(404);
  });
  it("issues opaque file-specific tickets and checks permissions again on download", async () => {
    const result = await fetch(`${base}/api/storage/access`, { method: "POST", headers: { Authorization: "Bearer 1", "Content-Type": "application/json" }, body: JSON.stringify({ url: `/uploads/${key}` }) });
    expect(result.status).toBe(200);
    const { url } = await result.json();
    expect(new URL(url, base).searchParams.get("ticket")).toMatch(/^[a-f0-9]{64}$/);
    expect((await fetch(base + url)).status).toBe(200);
    expect((await fetch(base + url.replace("privacy-", "another-"))).status).toBe(404);
    await client.execute("UPDATE documents SET userId=9 WHERE id=1");
    expect((await fetch(base + url)).status).toBe(404);
  });
  it("does not expose submissions to other students in the same course", async () => {
    await client.execute("DELETE FROM documents");
    await client.execute({ sql: "INSERT INTO assignmentSubmissions(id,studentId,courseId,fileUrl) VALUES(1,2,4,?)", args: [`/uploads/${key}`] });
    expect((await fetch(`${base}/uploads/${key}`, { headers: { Authorization: "Bearer 1" } })).status).toBe(404);
    expect((await fetch(`${base}/uploads/${key}`, { headers: { Authorization: "Bearer 7" } })).status).toBe(200);
  });
  it("expires access tickets", async () => {
    const result = await fetch(`${base}/api/storage/access`, { method: "POST", headers: { Authorization: "Bearer 1", "Content-Type": "application/json" }, body: JSON.stringify({ url: `/uploads/${key}` }) });
    const { url } = await result.json();
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 301_000);
    try { expect((await fetch(base + url)).status).toBe(404); }
    finally { clock.mockRestore(); }
  });
  it("allows only published artwork under the publishing account's artwork path", async () => {
    const artwork = `1/avatars/${randomUUID()}.png`;
    await mkdir(resolveUploadPath("1/avatars"), { recursive: true });
    await writeFile(resolveUploadPath(artwork), "fixture image");
    try {
      await client.execute({ sql: "INSERT INTO users(id,avatarUrl) VALUES(2,?)", args: [`/uploads/${artwork}`] });
      expect((await fetch(`${base}/uploads/${artwork}`)).status).toBe(401);
      await client.execute("UPDATE users SET id=1");
      expect((await fetch(`${base}/uploads/${artwork}`)).status).toBe(200);
    } finally { await unlink(resolveUploadPath(artwork)); }
  });
  it("rejects traversal and refuses to publish documents through an arbitrary avatar URL", async () => {
    expect(() => uploadKey("/uploads/1/../2/private.txt")).toThrow();
    expect(() => uploadKey("/uploads/%2e%2e/private.txt")).toThrow();
    await client.execute({ sql: "INSERT INTO users(id,avatarUrl) VALUES(1,?)", args: [`/uploads/${key}`] });
    expect((await fetch(`${base}/uploads/${key}`)).status).toBe(401);
  });
});
