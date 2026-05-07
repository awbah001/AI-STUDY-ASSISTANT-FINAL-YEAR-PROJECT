import { createClient } from "@libsql/client";

const dbPath = process.env.DATABASE_URL || "file:./data/app.db";
const client = createClient({ url: dbPath });

async function checkSchema() {
  const usersInfo = await client.execute("PRAGMA table_info(users)");
  console.log("Users columns:", usersInfo.rows.map(r => r.name));
  
  const docsInfo = await client.execute("PRAGMA table_info(documents)");
  console.log("Documents columns:", docsInfo.rows.map(r => r.name));
  
  process.exit(0);
}

checkSchema().catch(err => {
  console.error(err);
  process.exit(1);
});
