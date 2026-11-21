import { eq, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { documents } from "../drizzle/schema";
import { getDb } from "./db";
import { canAccessDocument } from "./documentAccess";
import { resolveUploadPath } from "./_core/uploads";

export async function assertUploadExtractionAccess(
  userId: number,
  fileUrl: string
) {
  if (!fileUrl.startsWith("/uploads/") || /[?#%\\]/.test(fileUrl))
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid local upload path.",
    });
  const key = fileUrl.slice("/uploads/".length);
  try {
    resolveUploadPath(key);
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid local upload path.",
    });
  }
  // New uploads can be extracted before their document metadata is inserted.
  if (
    key.startsWith(`${userId}/`) &&
    !key.split("/").some(s => s === ".." || s === ".")
  )
    return;
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const rows = await db
    .select({
      userId: documents.userId,
      isPublic: documents.isPublic,
      courseId: documents.courseId,
    })
    .from(documents)
    .where(or(eq(documents.fileUrl, fileUrl), eq(documents.fileKey, key)));
  for (const doc of rows) if (await canAccessDocument(userId, doc)) return;
  throw new TRPCError({ code: "NOT_FOUND", message: "Upload unavailable." });
}
