import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { getDb } from "./db";
import { createChatMessage, getDocumentChatHistory } from "./queries";

vi.mock("./db", () => ({ getDb: vi.fn() }));
let client: Client;
let file: string;
beforeEach(async () => {
  file = `tmp/chat-persistence-${randomUUID()}.db`;
  client = createClient({ url: `file:./${file}` });
  vi.mocked(getDb).mockResolvedValue(drizzle(client));
  await client.execute(
    "CREATE TABLE chatMessages (id integer PRIMARY KEY AUTOINCREMENT, userId integer NOT NULL,documentId integer NOT NULL,role text NOT NULL,content text NOT NULL,createdAt integer NOT NULL,retrievalContext text)"
  );
});
afterEach(async () => {
  client.close();
  await unlink(file).catch(() => {});
});
describe("concurrent document-chat persistence", () => {
  it("returns each writer's own inserted message during concurrent student requests", async () => {
    const requests = Array.from({ length: 20 }, (_, i) => ({
      userId: i + 1,
      documentId: i + 100,
      role: "user" as const,
      content: `Private question ${i}`,
    }));
    const results = await Promise.all(requests.map(createChatMessage));
    expect(new Set(results.map(row => row.id)).size).toBe(requests.length);
    results.forEach((row, i) => expect(row).toMatchObject(requests[i]));
    for (let i = 0; i < requests.length; i++)
      expect(
        await getDocumentChatHistory(requests[i].documentId, requests[i].userId)
      ).toEqual([results[i]]);
    expect(
      await getDocumentChatHistory(requests[0].documentId, requests[1].userId)
    ).toEqual([]);
  });
});
