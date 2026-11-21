import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import type { Document } from "../../drizzle/schema";
import { resolveUploadPath } from "../_core/uploads";

export async function localMaterialRevision(doc: Document) {
  if (!doc.fileUrl.startsWith("/uploads/")) return null;
  const file = resolveUploadPath(doc.fileUrl.slice("/uploads/".length));
  if ((await stat(file)).size > 60 * 1024 * 1024) return null;
  return createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
}
