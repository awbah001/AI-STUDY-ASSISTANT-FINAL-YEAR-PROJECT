import { createClient } from "@libsql/client";

const dbPath = process.env.DATABASE_URL || "file:./data/app.db";
const client = createClient({ url: dbPath });

async function testQuery() {
  const email = "awbah001@gmail.com";
  try {
    const result = await client.execute({
      sql: `select "id", "openId", "name", "email", "loginMethod", "passwordHash", "avatarUrl", "role", "isBanned", "createdAt", "updatedAt", "lastSignedIn" from "users" where "users"."email" = ? limit ?`,
      args: [email, 1]
    });
    console.log("Query successful, rows found:", result.rows.length);
  } catch (e) {
    console.error("Query failed with error:");
    console.error(e);
  }
  process.exit(0);
}

testQuery().catch(err => {
  console.error(err);
  process.exit(1);
});
