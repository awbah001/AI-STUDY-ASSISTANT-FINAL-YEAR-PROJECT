import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";
import { is } from "drizzle-orm";
import { SQLiteTable, getTableConfig } from "drizzle-orm/sqlite-core";
import * as schema from "../../drizzle/schema";

// Never let a test which forgets to mock getDb open the developer's app.db.
// Vitest runs this setup independently for each test file.
mkdirSync("tmp", { recursive: true });
process.env.DATABASE_URL = `file:./tmp/suite-${randomUUID()}.db`;
// Build an empty schema from the same table definitions used by the application.
// Suites provide their own synthetic records or mocks; no developer data is copied.
const client = createClient({ url: process.env.DATABASE_URL });
try {
  for (const table of Object.values(schema)) {
    if (!is(table, SQLiteTable)) continue;
    const config = getTableConfig(table);
    await client.execute(`CREATE TABLE "${config.name}" (${config.columns.map(column =>
      `"${column.name}" ${column.getSQLType()}${column.primary ? " PRIMARY KEY" : ""}`
    ).join(",")})`);
  }
} finally { client.close(); }
