import fs from "fs/promises";
import path from "path";

const UPLOADS_ROOT = path.resolve(process.cwd(), "data", "uploads");

/**
 * Load PDF bytes from a local `/uploads/...` URL or a remote http(s) URL.
 */
export async function loadPdfBufferFromUrl(fileUrl: string): Promise<Buffer> {
  const trimmed = fileUrl.trim();
  if (trimmed.startsWith("/uploads/")) {
    const key = trimmed.replace(/^\/uploads\//, "");
    const filePath = path.join(UPLOADS_ROOT, key.replace(/\.\./g, ""));
    return fs.readFile(filePath);
  }
  try {
    const u = new URL(trimmed);
    if (u.protocol === "http:" || u.protocol === "https:") {
      if (u.pathname.startsWith("/uploads/")) {
        const key = u.pathname.replace(/^\/uploads\//, "");
        const filePath = path.join(UPLOADS_ROOT, key.replace(/\.\./g, ""));
        return fs.readFile(filePath);
      }
      const res = await fetch(trimmed);
      if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    }
  } catch {
    // fall through
  }
  throw new Error("Unsupported PDF URL; expected /uploads/... or http(s) URL");
}
