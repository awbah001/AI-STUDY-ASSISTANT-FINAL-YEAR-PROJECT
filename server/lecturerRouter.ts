import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { lecturerProcedure, protectedProcedure, publicProcedure, router, studentProcedure } from "./_core/trpc";
import * as lecturerQueries from "./lecturerQueries";
import * as queries from "./queries";
import * as llmUtils from "./llmUtils";
import * as documentAi from "./documentAiService";
import * as db from "./db";
import { hashPassword, localOpenIdForEmail, normalizeEmail } from "./_core/localAuth";
import { sdk } from "./_core/sdk";
import { ONE_YEAR_MS } from "../shared/const";
import { isAllowedStudyDocument, STUDY_DOC_ERROR } from "../shared/studyDocuments";
import type { User } from "../drizzle/schema";
import { assessmentTemplates, assignmentSubmissions, assignments, courseEnrollments, notifications, progressTracking, users } from "../drizzle/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

function stripSensitiveUser(u: User) {
  const { passwordHash: _p, ...safe } = u;
  return safe;
}

const materialTypeSchema = z.enum(["pdf", "docx", "pptx"]);

export const lecturerRouter = router({
  signup: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        email: z.string().email(),
        password: z.string().min(8).max(200),
        department: z.string().max(120).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const email = normalizeEmail(input.email);
      const existing = await db.getUserByEmail(email);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists.",
        });
      }

      const passwordHash = await hashPassword(input.password);
      const openId = localOpenIdForEmail(email);

      const user = await db.createUser({
        openId,
        name: input.name,
        email,
        loginMethod: "local",
        passwordHash,
        role: "lecturer",
        lastSignedIn: new Date(),
      });

      if (!user) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create lecturer account.",
        });
      }

      const token = await sdk.createSessionToken(openId, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });
      return { token, user: stripSensitiveUser(user) } as const;
    }),

  dashboardStats: lecturerProcedure.query(({ ctx }) =>
    lecturerQueries.getLecturerDashboardStats(ctx.user.id)
  ),

  courses: router({
    list: lecturerProcedure.query(({ ctx }) =>
      lecturerQueries.getLecturerCourses(ctx.user.id)
    ),
    get: lecturerProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        const course = await lecturerQueries.getCourseOwnedBy(ctx.user.id, input.courseId);
        if (!course) throw new TRPCError({ code: "NOT_FOUND" });
        return course;
      }),
    create: lecturerProcedure
      .input(
        z.object({
          title: z.string().min(1).max(200),
          subject: z.string().max(100).optional(),
          description: z.string().max(2000).optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        lecturerQueries.createCourse(ctx.user.id, input)
      ),
    update: lecturerProcedure
      .input(
        z.object({
          courseId: z.number(),
          title: z.string().min(1).max(200).optional(),
          subject: z.string().max(100).optional(),
          description: z.string().max(2000).optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { courseId, ...patch } = input;
        const updated = await lecturerQueries.updateCourse(courseId, ctx.user.id, patch);
        if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
        return updated;
      }),
    delete: lecturerProcedure
      .input(z.object({ courseId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const ok = await lecturerQueries.deleteCourse(input.courseId, ctx.user.id);
        if (!ok) throw new TRPCError({ code: "NOT_FOUND" });
        return { success: true as const };
      }),
  }),

  students: router({
    listAll: lecturerProcedure.query(({ ctx }) =>
      lecturerQueries.getAllLecturerStudents(ctx.user.id)
    ),
    listByCourse: lecturerProcedure
      .input(z.object({ courseId: z.number() }))
      .query(({ ctx, input }) =>
        lecturerQueries.getCourseStudents(input.courseId, ctx.user.id)
      ),
    enroll: lecturerProcedure
      .input(z.object({ courseId: z.number(), email: z.string().email() }))
      .mutation(({ ctx, input }) =>
        lecturerQueries.enrollStudentByEmail(input.courseId, ctx.user.id, input.email)
      ),
    remove: lecturerProcedure
      .input(z.object({ courseId: z.number(), studentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const ok = await lecturerQueries.removeStudentFromCourse(
          input.courseId,
          ctx.user.id,
          input.studentId
        );
        if (!ok) throw new TRPCError({ code: "NOT_FOUND" });
        return { success: true as const };
      }),
    progressReport: lecturerProcedure
      .input(z.object({ courseId: z.number(), studentId: z.number() }))
      .query(({ ctx, input }) =>
        lecturerQueries.getStudentProgressReport(
          input.courseId,
          ctx.user.id,
          input.studentId
        )
      ),
  }),

  materials: router({
    list: lecturerProcedure
      .input(z.object({ courseId: z.number() }))
      .query(({ ctx, input }) =>
        lecturerQueries.getCourseDocuments(input.courseId, ctx.user.id)
      ),
    upload: lecturerProcedure
      .input(
        z.object({
          courseId: z.number(),
          title: z.string(),
          description: z.string().optional(),
          fileName: z.string(),
          fileSize: z.number(),
          fileUrl: z.string(),
          fileKey: z.string(),
          mimeType: z.string().optional(),
          extractedText: z.string().optional(),
          materialType: materialTypeSchema.optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isAllowedStudyDocument(input.fileName, input.mimeType)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: STUDY_DOC_ERROR });
        }
        const { courseId, materialType, ...docData } = input;
        const doc = await lecturerQueries.createCourseDocument(ctx.user.id, courseId, {
          ...docData,
          materialType: materialType ?? "pdf",
          mimeType: docData.mimeType || "application/pdf",
        });
        if (doc.extractedText?.trim()) {
          try {
            await llmUtils.indexDocumentForRag(doc.id, doc.extractedText);
          } catch (e) {
            console.error("RAG indexing failed:", e);
          }
        }
        return doc;
      }),
    delete: lecturerProcedure
      .input(z.object({ documentId: z.number(), courseId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const course = await lecturerQueries.getCourseOwnedBy(ctx.user.id, input.courseId);
        if (!course) throw new TRPCError({ code: "NOT_FOUND" });
        const doc = await queries.getDocumentById(input.documentId);
        if (!doc || doc.courseId !== input.courseId || doc.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        await queries.deleteDocument(input.documentId);
        return { success: true as const };
      }),
    generateQuiz: lecturerProcedure
      .input(
        z.object({
          documentId: z.number(),
          courseId: z.number(),
          questionCount: z.number().min(3).max(20).default(5),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const course = await lecturerQueries.getCourseOwnedBy(ctx.user.id, input.courseId);
        if (!course) throw new TRPCError({ code: "NOT_FOUND" });
        const doc = await queries.getDocumentById(input.documentId);
        if (!doc || doc.courseId !== input.courseId) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return documentAi.generateQuizForDocument(
          input.documentId,
          ctx.user.id,
          input.questionCount
        );
      }),
    generateFlashcards: lecturerProcedure
      .input(
        z.object({
          documentId: z.number(),
          courseId: z.number(),
          count: z.number().min(3).max(30).default(10),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const course = await lecturerQueries.getCourseOwnedBy(ctx.user.id, input.courseId);
        if (!course) throw new TRPCError({ code: "NOT_FOUND" });
        const doc = await queries.getDocumentById(input.documentId);
        if (!doc || doc.courseId !== input.courseId) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return documentAi.generateFlashcardsForDocument(
          input.documentId,
          ctx.user.id,
          input.count
        );
      }),
    generateSummary: lecturerProcedure
      .input(
        z.object({
          documentId: z.number(),
          courseId: z.number(),
          topic: z.string().max(120).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const course = await lecturerQueries.getCourseOwnedBy(ctx.user.id, input.courseId);
        if (!course) throw new TRPCError({ code: "NOT_FOUND" });
        const doc = await queries.getDocumentById(input.documentId);
        if (!doc || doc.courseId !== input.courseId) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return documentAi.generateSummaryForDocument(input.documentId, input.topic);
      }),
  }),

  assignments: router({
    list: lecturerProcedure
      .input(z.object({ courseId: z.number() }))
      .query(({ ctx, input }) =>
        lecturerQueries.getCourseAssignments(input.courseId, ctx.user.id)
      ),
    create: lecturerProcedure
      .input(
        z.object({
          courseId: z.number(),
          title: z.string().min(1).max(200),
          description: z.string().max(2000).optional(),
          dueDate: z.date().optional(),
          documentId: z.number().optional(),
          fileUrl: z.string().optional(),
          fileKey: z.string().optional(),
          fileName: z.string().optional(),
          fileSize: z.number().optional(),
          mimeType: z.string().optional(),
          rubric: z.array(z.object({ criterion: z.string().min(1).max(120), maxPoints: z.number().positive().max(1000) })).max(12).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.fileName && !isAllowedStudyDocument(input.fileName, input.mimeType)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: STUDY_DOC_ERROR });
        }
        const assignment = await lecturerQueries.createAssignment(ctx.user.id, input);
        const studentIds = await lecturerQueries.getEnrolledStudentIds(input.courseId, ctx.user.id);
        if (studentIds.length) {
          const due = assignment.dueDate ? ` Due ${assignment.dueDate.toLocaleString()}.` : "";
          await Promise.all(studentIds.map((userId) => queries.createNotification({
            userId,
            title: `New assignment: ${assignment.title}`,
            body: `${assignment.description?.slice(0, 180) ?? "A new assignment is available."}${due}`,
            data: { type: "assignment_created", assignmentId: assignment.id, courseId: input.courseId },
          })));
        }
        return assignment;
      }),
    reviewQueue: lecturerProcedure
      .input(z.object({ courseId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const dbConn = await db.getDb(); if (!dbConn) return [];
        const owned = await lecturerQueries.getLecturerCourses(ctx.user.id);
        const ids = owned.map(c => c.id);
        if (!ids.length) return [];
        const courseIds = input?.courseId ? [input.courseId] : ids;
        if (input?.courseId && !ids.includes(input.courseId)) throw new TRPCError({ code: "FORBIDDEN" });
        return dbConn.select({ id: assignmentSubmissions.id, status: assignmentSubmissions.status, submittedAt: assignmentSubmissions.submittedAt, grade: assignmentSubmissions.grade, feedback: assignmentSubmissions.feedback, rubricScores: assignmentSubmissions.rubricScores, fileUrl: assignmentSubmissions.fileUrl, fileName: assignmentSubmissions.fileName, note: assignmentSubmissions.note, assignmentId: assignments.id, assignmentTitle: assignments.title, rubric: assignments.rubric, dueDate: assignments.dueDate, courseId: assignments.courseId, studentId: users.id, studentName: users.name, studentEmail: users.email }).from(assignmentSubmissions).innerJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id)).innerJoin(users, eq(assignmentSubmissions.studentId, users.id)).where(inArray(assignments.courseId, courseIds)).orderBy(desc(assignmentSubmissions.submittedAt));
      }),
    gradeSubmission: lecturerProcedure
      .input(z.object({ submissionId: z.number(), grade: z.number().min(0).max(1000), feedback: z.string().max(3000).optional(), rubricScores: z.array(z.object({ criterion: z.string(), score: z.number().min(0) })).optional() }))
      .mutation(async ({ ctx, input }) => {
        const dbConn = await db.getDb(); if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [submission] = await dbConn.select({ id: assignmentSubmissions.id, studentId: assignmentSubmissions.studentId, courseId: assignmentSubmissions.courseId, assignmentTitle: assignments.title }).from(assignmentSubmissions).innerJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id)).where(eq(assignmentSubmissions.id, input.submissionId));
        if (!submission || !(await lecturerQueries.getCourseOwnedBy(ctx.user.id, submission.courseId))) throw new TRPCError({ code: "NOT_FOUND" });
        await dbConn.update(assignmentSubmissions).set({ grade: String(input.grade), feedback: input.feedback ?? null, rubricScores: input.rubricScores, status: "graded", gradedAt: new Date() }).where(eq(assignmentSubmissions.id, input.submissionId));
        await dbConn.insert(notifications).values({ userId: submission.studentId, title: `Feedback: ${submission.assignmentTitle}`, body: input.feedback?.trim() || `Your assignment has been graded: ${input.grade}.`, data: { type: "assignment_graded", submissionId: input.submissionId, courseId: submission.courseId } });
        return { success: true };
      }),
    interventionStudents: lecturerProcedure.query(async ({ ctx }) => {
      const dbConn = await db.getDb(); if (!dbConn) return [];
      const owned = await lecturerQueries.getLecturerCourses(ctx.user.id); const ids = owned.map(c => c.id); if (!ids.length) return [];
      const cutoff = new Date(Date.now() - 14 * 86_400_000);
      return dbConn.select({ studentId: users.id, name: users.name, email: users.email, averageScore: sql<number>`coalesce(avg(${progressTracking.averageQuizScore}), 0)`, lastActivity: sql<Date>`max(${progressTracking.lastActivityAt})`, lateSubmissions: sql<number>`cast(sum(case when ${assignmentSubmissions.status} = 'late' then 1 else 0 end) as integer)` }).from(courseEnrollments).innerJoin(users, eq(courseEnrollments.studentId, users.id)).leftJoin(progressTracking, eq(users.id, progressTracking.userId)).leftJoin(assignmentSubmissions, and(eq(users.id, assignmentSubmissions.studentId), inArray(assignmentSubmissions.courseId, ids))).where(inArray(courseEnrollments.courseId, ids)).groupBy(users.id).having(sql`max(${progressTracking.lastActivityAt}) is null or max(${progressTracking.lastActivityAt}) < ${cutoff} or avg(${progressTracking.averageQuizScore}) < 50 or sum(case when ${assignmentSubmissions.status} = 'late' then 1 else 0 end) > 0`);
    }),
    missingSubmissions: lecturerProcedure.query(async ({ ctx }) => {
      const dbConn = await db.getDb(); if (!dbConn) return [];
      const owned = await lecturerQueries.getLecturerCourses(ctx.user.id); const ids = owned.map(c => c.id); if (!ids.length) return [];
      const dueAssignments = await dbConn.select({ id: assignments.id, title: assignments.title, courseId: assignments.courseId, dueDate: assignments.dueDate }).from(assignments).where(and(inArray(assignments.courseId, ids), sql`${assignments.dueDate} is not null and ${assignments.dueDate} < ${new Date()}`));
      if (!dueAssignments.length) return [];
      const enrolled = await dbConn.select({ courseId: courseEnrollments.courseId, studentId: users.id, studentName: users.name, studentEmail: users.email }).from(courseEnrollments).innerJoin(users, eq(courseEnrollments.studentId, users.id)).where(inArray(courseEnrollments.courseId, ids));
      const submissions = await dbConn.select({ assignmentId: assignmentSubmissions.assignmentId, studentId: assignmentSubmissions.studentId }).from(assignmentSubmissions).where(inArray(assignmentSubmissions.assignmentId, dueAssignments.map(a => a.id)));
      const submitted = new Set(submissions.map(s => `${s.assignmentId}:${s.studentId}`));
      return dueAssignments.flatMap(a => enrolled.filter(s => s.courseId === a.courseId && !submitted.has(`${a.id}:${s.studentId}`)).map(s => ({ ...s, assignmentId: a.id, assignmentTitle: a.title, dueDate: a.dueDate }))).slice(0, 100);
    }),
    templates: router({
      list: lecturerProcedure.query(async ({ ctx }) => { const dbConn = await db.getDb(); return dbConn ? dbConn.select().from(assessmentTemplates).where(eq(assessmentTemplates.lecturerId, ctx.user.id)).orderBy(desc(assessmentTemplates.createdAt)) : []; }),
      create: lecturerProcedure.input(z.object({ name: z.string().min(1).max(100), title: z.string().min(1).max(200), description: z.string().max(2000).optional(), rubric: z.array(z.object({ criterion: z.string().min(1), maxPoints: z.number().positive() })).max(12).optional() })).mutation(async ({ ctx, input }) => { const dbConn = await db.getDb(); if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" }); const [template] = await dbConn.insert(assessmentTemplates).values({ ...input, lecturerId: ctx.user.id }).returning(); return template; }),
      delete: lecturerProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => { const dbConn = await db.getDb(); if (!dbConn) return { success: false }; await dbConn.delete(assessmentTemplates).where(and(eq(assessmentTemplates.id, input.id), eq(assessmentTemplates.lecturerId, ctx.user.id))); return { success: true }; }),
    }),
    update: lecturerProcedure
      .input(
        z.object({
          assignmentId: z.number(),
          title: z.string().min(1).max(200).optional(),
          description: z.string().max(2000).optional(),
          dueDate: z.date().nullable().optional(),
          documentId: z.number().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { assignmentId, ...patch } = input;
        const updated = await lecturerQueries.updateAssignment(
          assignmentId,
          ctx.user.id,
          patch
        );
        if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
        return updated;
      }),
    delete: lecturerProcedure
      .input(z.object({ assignmentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const ok = await lecturerQueries.deleteAssignment(input.assignmentId, ctx.user.id);
        if (!ok) throw new TRPCError({ code: "NOT_FOUND" });
        return { success: true as const };
      }),
  }),

  announcements: router({
    list: lecturerProcedure.query(({ ctx }) =>
      lecturerQueries.getLecturerAnnouncements(ctx.user.id)
    ),
    listByCourse: lecturerProcedure
      .input(z.object({ courseId: z.number() }))
      .query(({ ctx, input }) =>
        lecturerQueries.getCourseAnnouncements(input.courseId, ctx.user.id)
      ),
    create: lecturerProcedure
      .input(
        z.object({
          courseId: z.number(),
          title: z.string().min(1).max(200),
          content: z.string().min(1).max(5000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const announcement = await lecturerQueries.createAnnouncement(ctx.user.id, input);

        // Fire push notifications AND persist inbox notifications asynchronously
        lecturerQueries.getEnrolledStudentPushTokens(input.courseId, ctx.user.id)
          .then(async (tokens) => {
            const course = await lecturerQueries.getCourseById(input.courseId);
            const title = `📢 ${course?.title ?? "Your course"}`;

            // Push notifications
            if (tokens.length > 0) {
              const { sendPushNotifications } = await import("./pushNotifications");
              await sendPushNotifications(tokens, title, input.title, {
                type: "announcement",
                courseId: input.courseId,
              });
            }

            // Persist to notification inbox for every enrolled student
            const enrolledStudentIds = await lecturerQueries.getEnrolledStudentIds(
              input.courseId,
              ctx.user.id
            );
            if (enrolledStudentIds.length > 0) {
              const queries = await import("./queries");
              await Promise.all(
                enrolledStudentIds.map((userId) =>
                  queries.createNotification({
                    userId,
                    title,
                    body: input.title,
                    data: { type: "announcement", courseId: input.courseId, announcementId: announcement.id },
                  })
                )
              );
            }
          })
          .catch((err) => console.error("[Push] Failed to send/persist announcement notifications:", err));

        return announcement;
      }),
    delete: lecturerProcedure
      .input(z.object({ announcementId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const ok = await lecturerQueries.deleteAnnouncement(
          input.announcementId,
          ctx.user.id
        );
        if (!ok) throw new TRPCError({ code: "NOT_FOUND" });
        return { success: true as const };
      }),
  }),

  analytics: router({
    coursePerformance: lecturerProcedure
      .input(z.object({ courseId: z.number() }))
      .query(({ ctx, input }) =>
        lecturerQueries.getCourseStudentPerformance(input.courseId, ctx.user.id)
      ),
    engagement: lecturerProcedure.query(({ ctx }) =>
      lecturerQueries.getLecturerEngagementOverview(ctx.user.id)
    ),
    quizAttempts: lecturerProcedure
      .input(z.object({ courseId: z.number() }))
      .query(({ ctx, input }) =>
        lecturerQueries.getQuizAttemptsByCourse(input.courseId, ctx.user.id)
      ),
  }),

  quizzes: router({
    list: lecturerProcedure
      .input(z.object({ courseId: z.number() }))
      .query(({ ctx, input }) =>
        lecturerQueries.getCourseQuizzes(input.courseId, ctx.user.id)
      ),
    get: lecturerProcedure
      .input(z.object({ quizId: z.number(), courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        const quiz = await lecturerQueries.getCourseQuizWithQuestions(
          input.quizId,
          input.courseId,
          ctx.user.id
        );
        if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
        return quiz;
      }),
    generate: lecturerProcedure
      .input(
        z.object({
          courseId: z.number(),
          documentId: z.number(),
          questionCount: z.number().min(3).max(20).default(5),
          title: z.string().max(200).optional(),
          dueDate: z.date().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const course = await lecturerQueries.getCourseOwnedBy(ctx.user.id, input.courseId);
        if (!course) throw new TRPCError({ code: "NOT_FOUND" });
        const doc = await queries.getDocumentById(input.documentId);
        if (!doc || doc.courseId !== input.courseId) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        const quiz = await documentAi.generateQuizForDocument(
          input.documentId,
          ctx.user.id,
          input.questionCount
        );
        // Optionally rename the quiz
        if (input.title?.trim() || input.dueDate) {
          const dbConn = await db.getDb();
          if (dbConn) {
            const { quizzes: quizzesTable } = await import("../drizzle/schema");
            await dbConn
              .update(quizzesTable)
              .set({ ...(input.title?.trim() ? { title: input.title.trim() } : {}), ...(input.dueDate ? { dueDate: input.dueDate } : {}) })
              .where((await import("drizzle-orm")).eq(quizzesTable.id, quiz.id));
          }
        }
        return quiz;
      }),
    delete: lecturerProcedure
      .input(z.object({ quizId: z.number(), courseId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const ok = await lecturerQueries.deleteCourseQuiz(
          input.quizId,
          input.courseId,
          ctx.user.id
        );
        if (!ok) throw new TRPCError({ code: "NOT_FOUND" });
        return { success: true as const };
      }),
  }),
});

/** Student-facing course enrollment */
export const studentCoursesRouter = router({
  list: studentProcedure.query(({ ctx }) =>
    lecturerQueries.getStudentEnrolledCourses(ctx.user.id)
  ),
  enroll: studentProcedure
    .input(z.object({ code: z.string().min(4).max(10) }))
    .mutation(({ ctx, input }) =>
      lecturerQueries.enrollStudentByCode(ctx.user.id, input.code)
    ),
  materials: studentProcedure
    .input(z.object({ courseId: z.number() }))
    .query(({ ctx, input }) =>
      lecturerQueries.getStudentCourseDocuments(ctx.user.id, input.courseId)
    ),
  announcements: studentProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const enrolled = await lecturerQueries.isStudentEnrolled(ctx.user.id, input.courseId);
      if (!enrolled) throw new TRPCError({ code: "FORBIDDEN" });
      const course = await lecturerQueries.getCourseById(input.courseId);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      return lecturerQueries.getCourseAnnouncements(input.courseId, course.lecturerId);
    }),
  quizzes: studentProcedure
    .input(z.object({ courseId: z.number() }))
    .query(({ ctx, input }) =>
      lecturerQueries.getStudentCourseQuizzes(ctx.user.id, input.courseId)
    ),
  allQuizzes: studentProcedure.query(({ ctx }) =>
    lecturerQueries.getStudentEnrolledCourseQuizzes(ctx.user.id)
  ),
  /** Student: list assignments for a course they're enrolled in */
  assignments: studentProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const enrolled = await lecturerQueries.isStudentEnrolled(ctx.user.id, input.courseId);
      if (!enrolled) throw new TRPCError({ code: "FORBIDDEN" });
      const course = await lecturerQueries.getCourseById(input.courseId);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      return lecturerQueries.getCourseAssignments(input.courseId, course.lecturerId);
    }),
});
