import { createClient } from "@libsql/client";
import crypto from "crypto";

const dbPath = process.env.DATABASE_URL || "file:./data/app.db";
const client = createClient({ url: dbPath });

const SCRYPT_KEYLEN = 64;

async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, key) => {
      if (err) reject(err);
      else resolve(key as Buffer);
    });
  });
  return `${salt.toString("base64")}:${derivedKey.toString("base64")}`;
}

async function createStudent() {
  const email = "student@cognify.com";
  const password = "student123";
  const name = "Test Student";

  const passwordHash = await hashPassword(password);
  const openId = `local:${email.toLowerCase()}`;

  console.log(`Creating student account: ${email}`);

  try {
    await client.execute({
      sql: "DELETE FROM users WHERE email = ?",
      args: [email],
    });

    await client.execute({
      sql: `INSERT INTO users (openId, name, email, loginMethod, passwordHash, role, createdAt, updatedAt, lastSignedIn, isBanned)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [openId, name, email, "local", passwordHash, "user", Date.now(), Date.now(), Date.now(), 0],
    });

    console.log("\n✅ Student account created!");
    console.log("─────────────────────────────");
    console.log(`  Email    : ${email}`);
    console.log(`  Password : ${password}`);
    console.log("─────────────────────────────");
    console.log("Use these to log in on the mobile app.\n");
  } catch (e) {
    console.error("Failed:", e);
  }

  process.exit(0);
}

createStudent();
