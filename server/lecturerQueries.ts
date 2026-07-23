import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  announcements,
  assignments,
  chatMessages,
  courseEnrollments,
  courses,
  documents,
  flashcards,
  progressTracking,
  quizzes,
  studySessions,
  users,
  type Course,
  type Document,
  type InsertAnnouncement,
  type InsertAssignment,
  type InsertCourse,
  type InsertDocument,
} from "../drizzle/schema";
import { getDb } from "./db";

function generateCourseCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function getCourseById(id: number): Promise<Course | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
  return rows[0];
}

export async function getCourseOwnedBy(lecturerId: number, courseId: number): Promise<Course | undefined> {
  const course = await getCourseById(courseId);
  if (!course || course.lecturerId !== lecturerId) return undefined;
  return course;
}

export async function getLecturerCourses(lecturerId: number): Promise<Course[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(courses)
    .where(eq(courses.lecturerId, lecturerId))
    .orderBy(desc(courses.createdAt));
}

export async function createCourse(
  lecturerId: number,
  data: Pick<InsertCourse, "title" | "subject" | "description">
): Promise<Course> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let code = generateCourseCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await db.select().from(courses).where(eq(courses.code, code)).limit(1);
    if (!existing[0]) break;
    code = generateCourseCode();
  }

  const inserted = await db
    .insert(courses)
    .values({
      lecturerId,
      title: data.title,
      subject: data.subject ?? null,
      description: data.description ?? null,
      code,
    })
    .returning();
  if (!inserted[0]) throw new Error("Failed to create course");
  return inserted[0];
}

export async function updateCourse(
  courseId: number,
  lecturerId: number,
  patch: Partial<Pick<InsertCourse, "title" | "subject" | "description" | "isActive">>
): Promise<Course | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const owned = await getCourseOwnedBy(lecturerId, courseId);
  if (!owned) return undefined;

  await db
    .update(courses)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(courses.id, courseId));

  return getCourseById(courseId);
}

export async function deleteCourse(courseId: number, lecturerId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const owned = await getCourseOwnedBy(lecturerId, courseId);
  if (!owned) return false;

  await db.delete(announcements).where(eq(announcements.courseId, courseId));
  await db.delete(assignments).where(eq(assignments.courseId, courseId));
  await db.delete(courseEnrollments).where(eq(courseEnrollments.courseId, courseId));
  await db
    .update(documents)
    .set({ courseId: null })
    .where(eq(documents.courseId, courseId));
  await db.delete(courses).where(eq(courses.id, courseId));
  return true;
}

export async function isStudentEnrolled(studentId: number, courseId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select()
    .from(courseEnrollments)
    .where(
      and(eq(courseEnrollments.courseId, courseId), eq(courseEnrollments.studentId, studentId))
    )
    .limit(1);
  return rows.length > 0;
}

export async function enrollStudentByEmail(
  courseId: number,
  lecturerId: number,
  email: string
): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  if (!db) return { success: false, message: "Database unavailable" };

  const owned = await getCourseOwnedBy(lecturerId, courseId);
  if (!owned) return { success: false, message: "Course not found" };

  const normalized = email.trim().toLowerCase();
  const studentRows = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  const student = studentRows[0];
  if (!student) return { success: false, message: "No student account with this email" };
  if (student.role !== "user") {
    return { success: false, message: "Only student accounts can be enrolled" };
  }

  const existing = await isStudentEnrolled(student.id, courseId);
  if (existing) return { success: false, message: "Student already enrolled" };

  await db.insert(courseEnrollments).values({ courseId, studentId: student.id });
  return { success: true, message: "Student enrolled successfully" };
}

export async function removeStudentFromCourse(
  courseId: number,
  lecturerId: number,
  studentId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const owned = await getCourseOwnedBy(lecturerId, courseId);
  if (!owned) return false;

  await db
    .delete(courseEnrollments)
    .where(
      and(eq(courseEnrollments.courseId, courseId), eq(courseEnrollments.studentId, studentId))
    );
  return true;
}

export async function getCourseStudents(courseId: number, lecturerId: number) {
  const db = await getDb();
  if (!db) return [];
  const owned = await getCourseOwnedBy(lecturerId, courseId);
  if (!owned) return [];

  return db
    .select({
      enrollmentId: courseEnrollments.id,
      studentId: users.id,
      name: users.name,
      email: users.email,
      enrolledAt: courseEnrollments.enrolledAt,
    })
    .from(courseEnrollments)
    .innerJoin(users, eq(courseEnrollments.studentId, users.id))
    .where(eq(courseEnrollments.courseId, courseId))
    .orderBy(desc(courseEnrollments.enrolledAt));
}

export async function getAllLecturerStudents(lecturerId: number) {
  const db = await getDb();
  if (!db) return [];

  const lecturerCourses = await getLecturerCourses(lecturerId);
  const courseIds = lecturerCourses.map((c) => c.id);
  if (courseIds.length === 0) return [];

  return db
    .selectDistinct({
      studentId: users.id,
      name: users.name,
      email: users.email,
      courseId: courses.id,
      courseTitle: courses.title,
      enrolledAt: courseEnrollments.enrolledAt,
    })
    .from(courseEnrollments)
    .innerJoin(users, eq(courseEnrollments.studentId, users.id))
    .innerJoin(courses, eq(courseEnrollments.courseId, courses.id))
    .where(inArray(courseEnrollments.courseId, courseIds))
    .orderBy(desc(courseEnrollments.enrolledAt));
}

export async function getCourseDocuments(courseId: number, lecturerId: number): Promise<Document[]> {
  const db = await getDb();
  if (!db) return [];
  const owned = await getCourseOwnedBy(lecturerId, courseId);
  if (!owned) return [];

  return db
    .select()
    .from(documents)
    .where(eq(documents.courseId, courseId))
    .orderBy(desc(documents.createdAt));
}

export async function createCourseDocument(
  lecturerId: number,
  courseId: number,
  data: Omit<InsertDocument, "userId" | "courseId"> & {
    materialType?: InsertDocument["materialType"];
  }
): Promise<Document> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const owned = await getCourseOwnedBy(lecturerId, courseId);
  if (!owned) throw new Error("Course not found");

  const inserted = await db
    .insert(documents)
    .values({
      ...data,
      userId: lecturerId,
      courseId,
      isPublic: false,
    })
    .returning();
  if (!inserted[0]) throw new Error("Failed to create document");
  return inserted[0];
}

export async function getCourseAssignments(courseId: number, lecturerId: number) {
  const db = await getDb();
  if (!db) return [];
  const owned = await getCourseOwnedBy(lecturerId, courseId);
  if (!owned) return [];

  return db
    .select()
    .from(assignments)
    .where(eq(assignments.courseId, courseId))
    .orderBy(desc(assignments.dueDate));
}

export async function createAssignment(
  lecturerId: number,
  data: Omit<InsertAssignment, "lecturerId">
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const owned = await getCourseOwnedBy(lecturerId, data.courseId);
  if (!owned) throw new Error("Course not found");

  const inserted = await db
    .insert(assignments)
    .values({ ...data, lecturerId })
    .returning();
  return inserted[0];
}

export async function updateAssignment(
  assignmentId: number,
  lecturerId: number,
  patch: Partial<Pick<InsertAssignment, "title" | "description" | "dueDate" | "documentId">>
) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(assignments).where(eq(assignments.id, assignmentId)).limit(1);
  const assignment = rows[0];
  if (!assignment || assignment.lecturerId !== lecturerId) return undefined;

  await db
    .update(assignments)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(assignments.id, assignmentId));

  const updated = await db.select().from(assignments).where(eq(assignments.id, assignmentId)).limit(1);
  return updated[0];
}

export async function deleteAssignment(assignmentId: number, lecturerId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select().from(assignments).where(eq(assignments.id, assignmentId)).limit(1);
  const assignment = rows[0];
  if (!assignment || assignment.lecturerId !== lecturerId) return false;
  await db.delete(assignments).where(eq(assignments.id, assignmentId));
  return true;
}

export async function getCourseAnnouncements(courseId: number, lecturerId: number) {
  const db = await getDb();
  if (!db) return [];
  const owned = await getCourseOwnedBy(lecturerId, courseId);
  if (!owned) return [];

  return db
    .select()
    .from(announcements)
    .where(eq(announcements.courseId, courseId))
    .orderBy(desc(announcements.createdAt));
}

export async function getLecturerAnnouncements(lecturerId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: announcements.id,
      title: announcements.title,
      content: announcements.content,
      createdAt: announcements.createdAt,
      courseId: courses.id,
      courseTitle: courses.title,
    })
    .from(announcements)
    .innerJoin(courses, eq(announcements.courseId, courses.id))
    .where(eq(announcements.lecturerId, lecturerId))
    .orderBy(desc(announcements.createdAt));
}

export async function createAnnouncement(
  lecturerId: number,
  data: Omit<InsertAnnouncement, "lecturerId">
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const owned = await getCourseOwnedBy(lecturerId, data.courseId);
  if (!owned) throw new Error("Course not found");

  const inserted = await db
    .insert(announcements)
    .values({ ...data, lecturerId })
    .returning();
  return inserted[0];
}

export async function deleteAnnouncement(announcementId: number, lecturerId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, announcementId))
    .limit(1);
  const ann = rows[0];
  if (!ann || ann.lecturerId !== lecturerId) return false;
  await db.delete(announcements).where(eq(announcements.id, announcementId));
  return true;
}

export async function getLecturerDashboardStats(lecturerId: number) {
  const db = await getDb();
  if (!db) {
    return {
      courseCount: 0,
      studentCount: 0,
      documentCount: 0,
      assignmentCount: 0,
      announcementCount: 0,
      quizCount: 0,
      flashcardCount: 0,
    };
  }

  const lecturerCourses = await getLecturerCourses(lecturerId);
  const courseIds = lecturerCourses.map((c) => c.id);

  if (courseIds.length === 0) {
    return {
      courseCount: 0,
      studentCount: 0,
      documentCount: 0,
      assignmentCount: 0,
      announcementCount: 0,
      quizCount: 0,
      flashcardCount: 0,
    };
  }

  const [[{ studentCount }], [{ documentCount }], [{ assignmentCount }], [{ announcementCount }]] =
    await Promise.all([
      db
        .select({ studentCount: sql<number>`cast(count(distinct ${courseEnrollments.studentId}) as integer)` })
        .from(courseEnrollments)
        .where(inArray(courseEnrollments.courseId, courseIds)),
      db
        .select({ documentCount: sql<number>`cast(count(${documents.id}) as integer)` })
        .from(documents)
        .where(inArray(documents.courseId, courseIds)),
      db
        .select({ assignmentCount: sql<number>`cast(count(${assignments.id}) as integer)` })
        .from(assignments)
        .where(inArray(assignments.courseId, courseIds)),
      db
        .select({ announcementCount: sql<number>`cast(count(${announcements.id}) as integer)` })
        .from(announcements)
        .where(inArray(announcements.courseId, courseIds)),
    ]);

  const courseDocs = await db
    .select({ id: documents.id })
    .from(documents)
    .where(inArray(documents.courseId, courseIds));
  const docIds = courseDocs.map((d) => d.id);

  let quizCount = 0;
  let flashcardCount = 0;
  if (docIds.length > 0) {
    const [[q], [f]] = await Promise.all([
      db
        .select({ count: sql<number>`cast(count(${quizzes.id}) as integer)` })
        .from(quizzes)
        .where(inArray(quizzes.documentId, docIds)),
      db
        .select({ count: sql<number>`cast(count(${flashcards.id}) as integer)` })
        .from(flashcards)
        .where(inArray(flashcards.documentId, docIds)),
    ]);
    quizCount = q?.count ?? 0;
    flashcardCount = f?.count ?? 0;
  }

  return {
    courseCount: lecturerCourses.length,
    studentCount: studentCount ?? 0,
    documentCount: documentCount ?? 0,
    assignmentCount: assignmentCount ?? 0,
    announcementCount: announcementCount ?? 0,
    quizCount,
    flashcardCount,
  };
}

export async function getCourseStudentPerformance(courseId: number, lecturerId: number) {
  const db = await getDb();
  if (!db) return [];
  const owned = await getCourseOwnedBy(lecturerId, courseId);
  if (!owned) return [];

  const courseDocs = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.courseId, courseId));
  const docIds = courseDocs.map((d) => d.id);

  const students = await getCourseStudents(courseId, lecturerId);

  const results = await Promise.all(
    students.map(async (student) => {
      let avgScore = 0;
      let quizzesAttempted = 0;
      let flashcardsReviewed = 0;
      let studyMinutes = 0;
      let chatCount = 0;

      if (docIds.length > 0) {
        const progressRows = await db
          .select()
          .from(progressTracking)
          .where(
            and(
              eq(progressTracking.userId, student.studentId),
              inArray(progressTracking.documentId, docIds)
            )
          );
        if (progressRows.length > 0) {
          quizzesAttempted = progressRows.reduce((s, p) => s + p.quizzesAttempted, 0);
          flashcardsReviewed = progressRows.reduce((s, p) => s + p.flashcardsReviewed, 0);
          studyMinutes = progressRows.reduce((s, p) => s + p.totalStudyTimeMinutes, 0);
          const scores = progressRows
            .map((p) => p.averageQuizScore ?? 0)
            .filter((s) => s > 0);
          avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        }

        const [chatRow] = await db
          .select({ count: sql<number>`cast(count(${chatMessages.id}) as integer)` })
          .from(chatMessages)
          .where(
            and(
              eq(chatMessages.userId, student.studentId),
              inArray(chatMessages.documentId, docIds)
            )
          );
        chatCount = chatRow?.count ?? 0;
      }

      const engagementScore = Math.round(
        quizzesAttempted * 30 + flashcardsReviewed * 20 + chatCount * 5 + studyMinutes * 0.5
      );

      return {
        studentId: student.studentId,
        name: student.name,
        email: student.email,
        enrolledAt: student.enrolledAt,
        avgQuizScore: Math.round(avgScore * 10) / 10,
        quizzesAttempted,
        flashcardsReviewed,
        studyMinutes,
        chatCount,
        engagementScore,
      };
    })
  );

  return results.sort((a, b) => b.engagementScore - a.engagementScore);
}

export async function getLecturerEngagementOverview(lecturerId: number) {
  const db = await getDb();
  if (!db) return [];
  const lecturerCourses = await getLecturerCourses(lecturerId);

  return Promise.all(
    lecturerCourses.map(async (course) => {
      const students = await getCourseStudentPerformance(course.id, lecturerId);
      const avgEngagement =
        students.length > 0
          ? Math.round(students.reduce((s, st) => s + st.engagementScore, 0) / students.length)
          : 0;
      return {
        courseId: course.id,
        courseTitle: course.title,
        studentCount: students.length,
        avgEngagement,
      };
    })
  );
}

export async function getStudentProgressReport(
  courseId: number,
  lecturerId: number,
  studentId: number
) {
  const owned = await getCourseOwnedBy(lecturerId, courseId);
  if (!owned) return null;
  const enrolled = await isStudentEnrolled(studentId, courseId);
  if (!enrolled) return null;

  const performance = await getCourseStudentPerformance(courseId, lecturerId);
  const student = performance.find((p) => p.studentId === studentId);
  if (!student) return null;

  const db = await getDb();
  if (!db) return { student, recentSessions: [] };

  const courseDocs = await db
    .select({ id: documents.id, title: documents.title })
    .from(documents)
    .where(eq(documents.courseId, courseId));
  const docIds = courseDocs.map((d) => d.id);

  let recentSessions: { activityType: string; durationMinutes: number | null; startTime: Date }[] = [];
  if (docIds.length > 0) {
    recentSessions = await db
      .select({
        activityType: studySessions.activityType,
        durationMinutes: studySessions.durationMinutes,
        startTime: studySessions.startTime,
      })
      .from(studySessions)
      .where(
        and(
          eq(studySessions.userId, studentId),
          inArray(studySessions.documentId, docIds)
        )
      )
      .orderBy(desc(studySessions.startTime))
      .limit(10);
  }

  return { student, course: owned, documents: courseDocs, recentSessions };
}

/** Student: enroll by course code */
export async function enrollStudentByCode(studentId: number, code: string) {
  const db = await getDb();
  if (!db) return { success: false, message: "Database unavailable" };

  const normalized = code.trim().toUpperCase();
  const courseRows = await db.select().from(courses).where(eq(courses.code, normalized)).limit(1);
  const course = courseRows[0];
  if (!course || !course.isActive) {
    return { success: false, message: "Invalid or inactive course code" };
  }

  const existing = await isStudentEnrolled(studentId, course.id);
  if (existing) return { success: false, message: "Already enrolled in this course" };

  await db.insert(courseEnrollments).values({ courseId: course.id, studentId });
  return { success: true, message: "Enrolled successfully", course };
}

export async function getStudentEnrolledCourses(studentId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: courses.id,
      title: courses.title,
      subject: courses.subject,
      code: courses.code,
      description: courses.description,
      enrolledAt: courseEnrollments.enrolledAt,
      lecturerName: users.name,
    })
    .from(courseEnrollments)
    .innerJoin(courses, eq(courseEnrollments.courseId, courses.id))
    .innerJoin(users, eq(courses.lecturerId, users.id))
    .where(eq(courseEnrollments.studentId, studentId))
    .orderBy(desc(courseEnrollments.enrolledAt));
}

export async function getStudentCourseDocuments(studentId: number, courseId: number) {
  const enrolled = await isStudentEnrolled(studentId, courseId);
  if (!enrolled) return [];

  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(documents)
    .where(eq(documents.courseId, courseId))
    .orderBy(desc(documents.createdAt));
}

// ── Quiz management for lecturers ─────────────────────────────────────────────

import { quizQuestions } from "../drizzle/schema";

/** All quizzes for documents belonging to a course the lecturer owns */
export async function getCourseQuizzes(courseId: number, lecturerId: number) {
  const db = await getDb();
  if (!db) return [];
  const owned = await getCourseOwnedBy(lecturerId, courseId);
  if (!owned) return [];

  const courseDocs = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.courseId, courseId));
  const docIds = courseDocs.map((d) => d.id);
  if (docIds.length === 0) return [];

  return db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      totalQuestions: quizzes.totalQuestions,
      documentId: quizzes.documentId,
      createdAt: quizzes.createdAt,
    })
    .from(quizzes)
    .where(inArray(quizzes.documentId, docIds))
    .orderBy(desc(quizzes.createdAt));
}

/** Quiz with all questions — used to preview a quiz the lecturer created */
export async function getCourseQuizWithQuestions(
  quizId: number,
  courseId: number,
  lecturerId: number
) {
  const db = await getDb();
  if (!db) return null;
  const owned = await getCourseOwnedBy(lecturerId, courseId);
  if (!owned) return null;

  const quizRows = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  const quiz = quizRows[0];
  if (!quiz) return null;

  // Verify the quiz belongs to a document in this course
  const docRows = await db
    .select({ courseId: documents.courseId })
    .from(documents)
    .where(eq(documents.id, quiz.documentId))
    .limit(1);
  if (docRows[0]?.courseId !== courseId) return null;

  const questions = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(quizQuestions.id);

  return { ...quiz, questions };
}

/** Delete a quiz and its questions — lecturer only */
export async function deleteCourseQuiz(
  quizId: number,
  courseId: number,
  lecturerId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const owned = await getCourseOwnedBy(lecturerId, courseId);
  if (!owned) return false;

  const quizRows = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  const quiz = quizRows[0];
  if (!quiz) return false;

  const docRows = await db
    .select({ courseId: documents.courseId })
    .from(documents)
    .where(eq(documents.id, quiz.documentId))
    .limit(1);
  if (docRows[0]?.courseId !== courseId) return false;

  await db.delete(quizQuestions).where(eq(quizQuestions.quizId, quizId));
  await db.delete(quizzes).where(eq(quizzes.id, quizId));
  return true;
}

/** Student: list quizzes for a course they are enrolled in */
export async function getStudentCourseQuizzes(studentId: number, courseId: number) {
  const enrolled = await isStudentEnrolled(studentId, courseId);
  if (!enrolled) return [];

  const db = await getDb();
  if (!db) return [];

  const courseDocs = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.courseId, courseId));
  const docIds = courseDocs.map((d) => d.id);
  if (docIds.length === 0) return [];

  return db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      totalQuestions: quizzes.totalQuestions,
      documentId: quizzes.documentId,
      score: quizzes.score,
      completedAt: quizzes.completedAt,
      createdAt: quizzes.createdAt,
    })
    .from(quizzes)
    .where(inArray(quizzes.documentId, docIds))
    .orderBy(desc(quizzes.createdAt));
}

// ── Quiz attempts per quiz for lecturer view ───────────────────────────────────

export async function getQuizAttemptsByCourse(courseId: number, lecturerId: number) {
  const db = await getDb();
  if (!db) return [];
  const owned = await getCourseOwnedBy(lecturerId, courseId);
  if (!owned) return [];

  const courseDocs = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.courseId, courseId));
  const docIds = courseDocs.map((d) => d.id);
  if (docIds.length === 0) return [];

  // Get all quizzes for this course
  const courseQuizzes = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      totalQuestions: quizzes.totalQuestions,
      createdAt: quizzes.createdAt,
    })
    .from(quizzes)
    .where(inArray(quizzes.documentId, docIds))
    .orderBy(desc(quizzes.createdAt));

  // For each quiz, get all student attempts with scores
  const results = await Promise.all(
    courseQuizzes.map(async (quiz) => {
      const attempts = await db
        .select({
          quizId: quizzes.id,
          studentId: users.id,
          studentName: users.name,
          studentEmail: users.email,
          score: quizzes.score,
          completedAt: quizzes.completedAt,
        })
        .from(quizzes)
        .innerJoin(users, eq(quizzes.userId, users.id))
        .where(eq(quizzes.id, quiz.id));

      const completed = attempts.filter((a) => a.completedAt !== null);
      const avgScore =
        completed.length > 0
          ? completed.reduce((s, a) => s + Number(a.score ?? 0), 0) / completed.length
          : 0;

      return {
        ...quiz,
        attempts: completed.map((a) => ({
          studentId: a.studentId,
          studentName: a.studentName,
          studentEmail: a.studentEmail,
          score: a.score ? Number(a.score) : null,
          completedAt: a.completedAt,
        })),
        attemptCount: completed.length,
        avgScore: Math.round(avgScore * 10) / 10,
      };
    })
  );

  return results;
}
