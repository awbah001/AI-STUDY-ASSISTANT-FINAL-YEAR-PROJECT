import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { mkdirSync } from "fs";

const dbPath = "./data/app.db";
const dir = dirname(dbPath);
mkdirSync(dir, { recursive: true });

const client = createClient({
  url: `file:${resolve(dbPath)}`,
});

// Read the migration SQL
const migrationSQL = readFileSync("./drizzle/0000_narrow_wallop.sql", "utf-8");

// Split by statement breakpoint and execute each statement
const statements = migrationSQL
  .split("--> statement-breakpoint")
  .map(s => s.trim())
  .filter(s => s.length > 0);

console.log(`Executing ${statements.length} statements...`);

for (const statement of statements) {
  try {
    console.log(`Executing: ${statement.substring(0, 50)}...`);
    await client.execute(statement);
  } catch (error) {
    console.error(`Error executing statement: ${error.message}`);
  }
}

console.log("Migration complete!");
await client.close();
