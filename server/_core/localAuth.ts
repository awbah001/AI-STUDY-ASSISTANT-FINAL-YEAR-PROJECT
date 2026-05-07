import crypto from "crypto";

const SCRYPT_KEYLEN = 64;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function localOpenIdForEmail(email: string) {
  return `local:${normalizeEmail(email)}`;
}

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, key) => {
      if (err) reject(err);
      else resolve(key as Buffer);
    });
  });

  return `${salt.toString("base64")}:${derivedKey.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [saltB64, hashB64] = stored.split(":");
  if (!saltB64 || !hashB64) return false;

  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");

  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, expected.length, (err, key) => {
      if (err) reject(err);
      else resolve(key as Buffer);
    });
  });

  return crypto.timingSafeEqual(expected, derivedKey);
}

