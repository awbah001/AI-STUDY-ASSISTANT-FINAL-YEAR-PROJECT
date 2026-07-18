import type { Document } from "../drizzle/schema";
import * as lecturerQueries from "./lecturerQueries";

/** Whether a user may read or interact with a document. */
export async function canAccessDocument(userId: number, doc: Document): Promise<boolean> {
  if (doc.userId === userId) return true;
  if (doc.isPublic) return true;

  if (doc.courseId) {
    const course = await lecturerQueries.getCourseById(doc.courseId);
    if (course?.lecturerId === userId) return true;
    return lecturerQueries.isStudentEnrolled(userId, doc.courseId);
  }

  return false;
}
