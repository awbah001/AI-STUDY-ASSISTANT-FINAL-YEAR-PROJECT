import { createClient } from "@libsql/client";

const dbPath = process.env.DATABASE_URL || "file:./data/app.db";
const client = createClient({ url: dbPath });

async function testDocs() {
  try {
    const result = await client.execute(`select "id", "userId", "title", "isPublic" from "documents" limit 1`);
    console.log("Documents query successful");
  } catch (e) {
    console.error("Documents query failed:");
    console.error(e);
  }
  process.exit(0);
}

testDocs().catch(err => {
  console.error(err);
  process.exit(1);
});
