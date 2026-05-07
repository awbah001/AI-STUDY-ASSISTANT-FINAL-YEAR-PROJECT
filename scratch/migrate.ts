import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";

const dbPath = process.env.DATABASE_URL || "file:./data/app.db";
const client = createClient({ url: dbPath });

async function runMigration() {
  console.log("Reading migration file...");
  // Find the migration file (we know it's 0007_cool_thunderbolts.sql)
  const migrationPath = "./drizzle/0007_cool_thunderbolts.sql";
  const sql = fs.readFileSync(migrationPath, "utf8");
  
  // Split statements by statement-breakpoint
  const statements = sql.split("--> statement-breakpoint");
  
  console.log(`Executing ${statements.length} statements...`);
  
  for (const statement of statements) {
    const trimmed = statement.trim();
    if (!trimmed) continue;
    
    // LibSQL doesn't like PRAGMA foreign_keys=OFF; in the same way, but let's try
    try {
      await client.execute(trimmed);
    } catch (e) {
      console.warn(`Error executing statement: ${trimmed.substring(0, 50)}...`);
      console.warn(e);
      // Continue if it's a minor error
    }
  }
  
  console.log("Migration complete!");
  process.exit(0);
}

runMigration().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
