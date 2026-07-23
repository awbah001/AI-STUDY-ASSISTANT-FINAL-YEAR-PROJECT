import { createClient } from "@libsql/client";

const client = createClient({ url: "file:./data/app.db" });

async function run() {
  try {
    await client.execute("ALTER TABLE users ADD COLUMN expoPushToken TEXT");
    console.log("✅ expoPushToken column added to users table");
  } catch (e: any) {
    if (e.message?.includes("duplicate column")) {
      console.log("Column already exists — skipping");
    } else {
      console.error("Error:", e.message);
    }
  }
  process.exit(0);
}

run();
