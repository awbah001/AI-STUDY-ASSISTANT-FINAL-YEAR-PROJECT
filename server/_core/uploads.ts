import path from "path";

export const UPLOADS_ROOT = path.resolve(process.cwd(), "data", "uploads");

const ALLOWED_EXT = new Set([
  "pdf",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "txt",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
]);

const ALLOWED_TOP_DIRS = new Set([
  "avatars",
  "submissions",
  "courses",
  "documents",
  "uploads",
  "files",
]);

/**
 * Resolve a key under data/uploads and reject path traversal.
 */
export function resolveUploadPath(relativeKey: string): string {
  const normalized = relativeKey.replace(/\\/g, "/").replace(/^\/+/, "");
  const full = path.resolve(UPLOADS_ROOT, normalized);
  const rootWithSep = UPLOADS_ROOT.endsWith(path.sep)
    ? UPLOADS_ROOT
    : `${UPLOADS_ROOT}${path.sep}`;
  if (full !== UPLOADS_ROOT && !full.startsWith(rootWithSep)) {
    throw new Error("Invalid upload path");
  }
  return full;
}

/**
 * Ignore client-supplied directories except a small allowlist, and always
 * prefix with the authenticated user id so one account cannot overwrite another.
 */
export function sanitizeUploadKey(userId: number, requestedKey: string): string {
  const cleaned = requestedKey
    .replace(/\\/g, "/")
    .replace(/\.\./g, "")
    .replace(/^\/+/, "");
  const parts = cleaned.split("/").filter(Boolean);
  const base = parts.pop() || "file.bin";
  const ext = (base.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error("File type not allowed");
  }
  const safeSegments = parts
    .filter((p) => /^[a-zA-Z0-9._-]+$/.test(p))
    .slice(0, 4);
  const folder =
    safeSegments[0] && ALLOWED_TOP_DIRS.has(safeSegments[0])
      ? safeSegments.join("/")
      : "files";
  const safeBase = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
  return `${userId}/${folder}/${Date.now()}-${safeBase}`;
}
