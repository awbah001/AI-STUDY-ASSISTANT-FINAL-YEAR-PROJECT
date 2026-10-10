import type { User } from "../../drizzle/schema";
import * as calendar from "../calendar";
import * as lecturerQueries from "../lecturerQueries";
import * as queries from "../queries";

export type StudentSystemSnapshot = {
  generatedAt: string;
  active: {
    courseId?: number;
    documentId?: number;
    documentTitle?: string | null;
  };
  enrolledCourses: Array<{
    id: number;
    code: string | null;
    title: string;
    subject: string | null;
    documentCount: number;
    documents: Array<{ id: number; title: string }>;
    upcomingAssignments: Array<{
      id: number;
      title: string;
      dueDate: string | null;
    }>;
  }>;
  progress: {
    weakerAreas: Array<{
      documentId: number;
      title: string | null;
      averageQuizScore: number | null;
      quizzesAttempted: number | null;
    }>;
    recentDocuments: Array<{
      documentId: number;
      title: string | null;
      averageQuizScore: number | null;
      flashcardsReviewed: number | null;
    }>;
  };
  upcomingCalendar: Array<{
    id: number;
    title: string;
    type: string;
    startsAt: string;
  }>;
};

/**
 * Authorized read of the student's system state for the agent.
 * Never includes other students' data — enrollment + ownership checks only.
 */
export async function buildStudentSystemSnapshot(
  user: User,
  active?: { courseId?: number; documentId?: number; documentTitle?: string | null }
): Promise<StudentSystemSnapshot> {
  const now = Date.now();
  const enrolled =
    user.role === "user" ? await lecturerQueries.getStudentEnrolledCourses(user.id) : [];

  const enrolledCourses: StudentSystemSnapshot["enrolledCourses"] = [];
  for (const row of enrolled.slice(0, 12)) {
    const course = await lecturerQueries.getCourseById(row.id);
    if (!course) continue;

    const docs =
      user.role === "user"
        ? await lecturerQueries.getStudentCourseDocuments(user.id, course.id)
        : await lecturerQueries.getCourseDocuments(course.id, course.lecturerId);

    const assignments = await lecturerQueries.getCourseAssignments(course.id, course.lecturerId);
    const upcoming = assignments
      .filter((a) => a.dueDate && new Date(a.dueDate).getTime() >= now - 12 * 60 * 60 * 1000)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 6)
      .map((a) => ({
        id: a.id,
        title: a.title,
        dueDate: a.dueDate ? new Date(a.dueDate).toISOString() : null,
      }));

    enrolledCourses.push({
      id: course.id,
      code: course.code ?? null,
      title: course.title,
      subject: course.subject ?? null,
      documentCount: docs.length,
      documents: docs.slice(0, 10).map((d) => ({ id: d.id, title: d.title })),
      upcomingAssignments: upcoming,
    });
  }

  const progressRows = await queries.getUserProgressWithTitles(user.id);
  const weakerAreas = [...progressRows]
    .filter((r) => (r.quizzesAttempted ?? 0) > 0)
    .sort((a, b) => (a.averageQuizScore ?? 100) - (b.averageQuizScore ?? 100))
    .slice(0, 5)
    .map((r) => ({
      documentId: r.documentId,
      title: r.documentTitle ?? null,
      averageQuizScore: r.averageQuizScore ?? null,
      quizzesAttempted: r.quizzesAttempted ?? null,
    }));

  const calendarRows =
    user.role === "user"
      ? await calendar.listCalendarEvents(user.id, now, now + 30 * 24 * 60 * 60 * 1000)
      : [];

  return {
    generatedAt: new Date(now).toISOString(),
    active: {
      courseId: active?.courseId,
      documentId: active?.documentId,
      documentTitle: active?.documentTitle ?? null,
    },
    enrolledCourses,
    progress: {
      weakerAreas,
      recentDocuments: progressRows.slice(0, 10).map((r) => ({
        documentId: r.documentId,
        title: r.documentTitle ?? null,
        averageQuizScore: r.averageQuizScore ?? null,
        flashcardsReviewed: r.flashcardsReviewed ?? null,
      })),
    },
    upcomingCalendar: calendarRows.slice(0, 12).map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      startsAt: new Date(Number(e.startsAt)).toISOString(),
    })),
  };
}

export function formatSnapshotForPrompt(snapshot: StudentSystemSnapshot): string {
  const lines: string[] = [
    "Authorized system snapshot for this student (use these IDs; do not invent others):",
  ];
  if (snapshot.active.courseId) lines.push(`- Active courseId: ${snapshot.active.courseId}`);
  if (snapshot.active.documentId) {
    lines.push(
      `- Active documentId: ${snapshot.active.documentId}${
        snapshot.active.documentTitle ? ` (${snapshot.active.documentTitle})` : ""
      }`
    );
  }
  if (!snapshot.enrolledCourses.length) {
    lines.push("- Enrolled courses: none");
  } else {
    lines.push("- Enrolled courses:");
    for (const c of snapshot.enrolledCourses) {
      lines.push(
        `  • courseId=${c.id} ${c.code ? `[${c.code}] ` : ""}${c.title} (${c.documentCount} documents)`
      );
      if (c.documents.length) {
        lines.push(
          `    materials: ${c.documents.map((d) => `doc ${d.id} “${d.title}”`).join("; ")}`
        );
      }
      if (c.upcomingAssignments.length) {
        lines.push(
          `    assignments: ${c.upcomingAssignments
            .map((a) => `${a.title} due ${a.dueDate?.slice(0, 10) ?? "n/a"}`)
            .join("; ")}`
        );
      }
    }
  }
  if (snapshot.progress.weakerAreas.length) {
    lines.push(
      `- Weaker areas: ${snapshot.progress.weakerAreas
        .map((w) => `${w.title ?? "doc " + w.documentId} (avg ${w.averageQuizScore ?? "?"}%)`)
        .join("; ")}`
    );
  }
  if (snapshot.upcomingCalendar.length) {
    lines.push(
      `- Upcoming calendar: ${snapshot.upcomingCalendar
        .map((e) => `${e.type} “${e.title}” @ ${e.startsAt.slice(0, 16)}`)
        .join("; ")}`
    );
  }
  return lines.join("\n");
}
