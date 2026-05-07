import { getDb } from "./server/db";
import { documents } from "./drizzle/schema";
import { eq } from "drizzle-orm";

async function check() {
  const db = await getDb();
  const allDocs = await db.select().from(documents);
  console.log("Documents in DB:");
  allDocs.forEach(d => {
    console.log(`ID: ${d.id}, Title: ${d.title}, Text Length: ${d.extractedText?.length ?? 0}`);
  });
  process.exit(0);
}

check();
