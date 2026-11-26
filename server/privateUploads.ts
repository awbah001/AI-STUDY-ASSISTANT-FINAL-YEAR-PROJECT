import express, { type Express, type Request, type Response } from "express";
import { eq, or } from "drizzle-orm";
import { parse, serialize } from "cookie";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { sdk } from "./_core/sdk";
import { UPLOADS_ROOT, resolveUploadPath } from "./_core/uploads";
import { getDb } from "./db";
import { documents, users, courses, assignments, assignmentSubmissions, generatedSlides, generatedVideos, type User } from "../drizzle/schema";
import { canAccessDocument } from "./documentAccess";
import { getCourseById, isStudentEnrolled } from "./lecturerQueries";

const COOKIE = "cognify_files";
const tickets = new Map<string, { key: string; session: string; expires: number }>();

export function setFileSession(req: Request, res: Response) {
  const auth = req.headers.authorization;
  if (!auth?.toLowerCase().startsWith("bearer ")) return;
  res.append("Set-Cookie", serialize(COOKIE, auth.slice(7).trim(), {
    httpOnly: true, sameSite: "lax", secure: req.secure || process.env.NODE_ENV === "production",
    path: "/uploads", maxAge: 600,
  }));
}

export function clearFileSession(res: Response) {
  res.clearCookie(COOKIE, { path: "/uploads" });
}

export function uploadKey(value: string) {
  if (!value.startsWith("/uploads/") || /[?#%\\]/.test(value)) throw new Error("Invalid upload path");
  const key = value.slice(9);
  if (!key || key.split("/").some(segment => !segment || segment === "." || segment === "..")) throw new Error("Invalid upload path");
  resolveUploadPath(key);
  return key;
}

async function courseAccess(user: User, courseId: number) {
  const course = await getCourseById(courseId);
  return course?.lecturerId === user.id || Boolean(course?.isActive && await isStudentEnrolled(user.id, courseId));
}

export async function mayReadUpload(user: User | null, key: string) {
  const db = await getDb();
  if (!db) return false;
  const url = `/uploads/${key}`;
  // Publishing an avatar cannot be used to expose another account's file.
  if (/\.(?:png|jpe?g|gif|webp)$/i.test(key)) {
    const artworkUsers = await db.select({ id: users.id }).from(users).where(eq(users.avatarUrl, url));
    if (artworkUsers.some(row => key.startsWith(`${row.id}/avatars/`))) return true;
    const artworkCourses = await db.select({ lecturerId: courses.lecturerId }).from(courses).where(eq(courses.coverImageUrl, url));
    if (artworkCourses.some(row => key.startsWith(`${row.lecturerId}/courses/`))) return true;
  }
  if (!user || user.isBanned) return false;
  if (user.role === "admin") return true;
  const docs = await db.select().from(documents).where(or(eq(documents.fileUrl, url), eq(documents.fileKey, key)));
  if (docs.length) {
    for (const doc of docs) if (await canAccessDocument(user.id, doc)) return true;
    return false;
  }
  const submissions = await db.select().from(assignmentSubmissions).where(or(eq(assignmentSubmissions.fileUrl, url), eq(assignmentSubmissions.fileKey, key)));
  if (submissions.length) {
    for (const submission of submissions) {
      const course = await getCourseById(submission.courseId);
      if (submission.studentId === user.id || course?.lecturerId === user.id) return true;
    }
    return false;
  }
  const attached = await db.select().from(assignments).where(or(eq(assignments.fileUrl, url), eq(assignments.fileKey, key)));
  if (attached.length) {
    for (const assignment of attached) if (await courseAccess(user, assignment.courseId)) return true;
    return false;
  }
  const decks = await db.select({ doc: documents }).from(generatedSlides).innerJoin(documents, eq(documents.id, generatedSlides.documentId)).where(eq(generatedSlides.fileUrl, url));
  if (decks.length) {
    for (const row of decks) if (await canAccessDocument(user.id, row.doc)) return true;
    return false;
  }
  if (key.startsWith("video/")) {
    const videos = await db.select({ video: generatedVideos, doc: documents }).from(generatedVideos).innerJoin(documents, eq(documents.id, generatedVideos.documentId)).where(eq(generatedVideos.userId, user.id));
    for (const { video, doc } of videos) {
      if (key.startsWith(path.posix.dirname(video.playerUrl.slice(9)) + "/") && await canAccessDocument(user.id, doc)) return true;
    }
    return false;
  }
  // Staged uploads can be opened by their uploader before metadata is saved.
  return key.startsWith(`${user.id}/`);
}

export function registerPrivateUploads(app: Express) {
  app.post("/api/storage/access", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const key = uploadKey(String(req.body?.url ?? ""));
      if (!await mayReadUpload(user, key)) { res.status(404).json({ error: "File unavailable" }); return; }
      for (const [id, value] of tickets) if (value.expires <= Date.now()) tickets.delete(id);
      if (tickets.size >= 10_000) { res.status(503).json({ error: "Please try again shortly" }); return; }
      const ticket = randomBytes(32).toString("hex");
      tickets.set(ticket, { key, session: req.headers.authorization!.slice(7).trim(), expires: Date.now() + 300_000 });
      res.setHeader("Cache-Control", "no-store");
      res.json({ url: `/uploads/${key}?ticket=${encodeURIComponent(ticket)}` });
    } catch { res.status(401).json({ error: "Sign in to open this file" }); }
  });
  app.use("/uploads", async (req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    try {
      const key = uploadKey(`/uploads${decodeURIComponent(req.path)}`);
      let auth = req.headers.authorization;
      if (typeof req.query.ticket === "string") {
        const ticket = tickets.get(req.query.ticket);
        if (!ticket || ticket.expires <= Date.now() || ticket.key !== key) throw new Error("Invalid file ticket");
        auth = `Bearer ${ticket.session}`;
      }
      auth ??= parse(req.headers.cookie ?? "")[COOKIE] ? `Bearer ${parse(req.headers.cookie ?? "")[COOKIE]}` : undefined;
      let user: User | null = null;
      if (auth) {
        user = await sdk.authenticateRequest({ ...req, headers: { ...req.headers, authorization: auth } } as Request);
      }
      if (!await mayReadUpload(user, key)) { res.status(user ? 404 : 401).json({ error: "File unavailable" }); return; }
      if (user && auth && req.query.ticket) setFileSession({ ...req, headers: { ...req.headers, authorization: auth } } as Request, res);
      next();
    } catch { res.status(404).json({ error: "File unavailable" }); }
  }, express.static(UPLOADS_ROOT, { index: false, dotfiles: "deny", fallthrough: false }));
}
