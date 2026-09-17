import type { User } from "../../drizzle/schema";
import * as lecturerQueries from "../lecturerQueries";
import * as queries from "../queries";
import { canAccessDocument } from "../documentAccess";

export async function assertCourseAccess(user: User, courseId: number): Promise<void> {
  if (user.role === "admin") {
    const course = await lecturerQueries.getCourseById(courseId);
    if (!course) throw new Error("Course not found.");
    return;
  }
  if (user.role === "lecturer") {
    const owned = await lecturerQueries.getCourseOwnedBy(user.id, courseId);
    if (!owned) throw new Error("You do not have access to this course.");
    return;
  }
  const enrolled = await lecturerQueries.isStudentEnrolled(user.id, courseId);
  if (!enrolled) throw new Error("You are not enrolled in this course.");
}

export async function assertDocumentToolAccess(user: User, documentId: number) {
  const doc = await queries.getDocumentById(documentId);
  if (!doc) throw new Error("Document not found.");
  const ok = await canAccessDocument(user.id, doc);
  if (!ok) throw new Error("You do not have access to this material.");
  return doc;
}

export async function resolveCourseFromMessage(user: User, message: string) {
  if (user.role !== "user") return undefined;
  const courses = await lecturerQueries.getStudentEnrolledCourses(user.id);
  const lower = message.toLowerCase();
  const match = courses.find((c) => {
    const hay = [c.code, c.title, c.subject].filter(Boolean).join(" ").toLowerCase();
    if (!hay) return false;
    if (c.code && lower.includes(String(c.code).toLowerCase())) return true;
    if (c.title && lower.includes(c.title.toLowerCase())) return true;
    if (c.subject && lower.includes(c.subject.toLowerCase())) return true;
    return false;
  });
  if (match) return match.id;
  if (courses.length === 1) return courses[0].id;
  return undefined;
}
