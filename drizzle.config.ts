import { defineConfig } from "drizzle-kit";

let connectionString = process.env.DATABASE_URL || "file:./data/app.db";
// Convert MySQL URLs to file-based SQLite URLs
if (connectionString.startsWith("mysql://") || connectionString.startsWith("mysql2://")) {
  connectionString = "file:./data/app.db";
}
// Remove SSL parameter if present (LibSQL doesn't support it)
if (connectionString.includes("?ssl=")) {
  connectionString = connectionString.split("?")[0];
}

// Ensure data directory exists
import { mkdirSync } from "fs";
import { dirname } from "path";
try {
  mkdirSync(dirname(connectionString.replace("file:", "")), { recursive: true });
} catch (e) {
  // Directory might already exist
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: connectionString,
  },
});
