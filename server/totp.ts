import { createHmac, randomBytes, createHash } from "crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotp(secret: string, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter & 0xffffffff, 4);
  const hmac = createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpUri(secret: string, email: string, issuer = "Cognify"): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export function verifyTotp(secret: string, token: string): boolean {
  const trimmed = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(trimmed)) return false;
  const now = Math.floor(Date.now() / 1000 / 30);
  for (const window of [-1, 0, 1]) {
    if (hotp(secret, now + window) === trimmed) return true;
  }
  return false;
}

export function generateRecoveryCodes(): { plain: string[]; hashes: string[] } {
  const plain = Array.from({ length: 8 }, () => randomBytes(5).toString("hex"));
  const hashes = plain.map((code) => createHash("sha256").update(code).digest("hex"));
  return { plain, hashes };
}

export function consumeRecoveryCode(hashes: string[], code: string): string[] | null {
  const digest = createHash("sha256").update(code.trim().toLowerCase()).digest("hex");
  const idx = hashes.indexOf(digest);
  if (idx < 0) return null;
  return hashes.filter((_, i) => i !== idx);
}
