import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";

describe("database startup migration readiness", () => {
  it("makes concurrent callers wait for annotation schema initialization", async () => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = `file:./tmp/reader-startup-${randomUUID()}.db`;
    vi.resetModules();
    try {
      const { getDb } = await import("./db");
      const first = getDb();
      const second = getDb().then(async db => {
        expect(db).not.toBeNull();
        // This request must not run against a connection whose startup migrations are pending.
        const rows = await db!.all(sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'documentAnnotations'`);
        expect(rows).toHaveLength(1);
        return db;
      });
      expect(await second).toBe(await first);
    } finally {
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
