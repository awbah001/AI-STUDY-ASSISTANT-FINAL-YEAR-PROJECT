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

async function restoreAdmin() {
  const email = "awbah001@gmail.com";
  const password = "easy24006";
  const name = "Admin User";
  
  const passwordHash = await hashPassword(password);
  const openId = `local:${email.toLowerCase()}`;
  
  console.log(`Restoring admin user: ${email}`);
  
  try {
    // Delete if exists (just in case)
    await client.execute({
      sql: "DELETE FROM users WHERE email = ?",
      args: [email]
    });
    
    await client.execute({
      sql: `INSERT INTO users (openId, name, email, loginMethod, passwordHash, role, createdAt, updatedAt, lastSignedIn, isBanned) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        openId, 
        name, 
        email, 
        "local", 
        passwordHash, 
        "admin", 
        Date.now(), 
        Date.now(), 
        Date.now(),
        0
      ]
    });
    
    console.log("Admin account restored successfully!");
    console.log(`You can now log in with email: ${email} and your previous password.`);
  } catch (e) {
    console.error("Failed to restore admin account:");
    console.error(e);
  }
  
  process.exit(0);
}

restoreAdmin();
