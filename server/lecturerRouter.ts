import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { lecturerProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as lecturerQueries from "./lecturerQueries";
import * as queries from "./queries";
import * as llmUtils from "./llmUtils";
import * as documentAi from "./documentAiService";
import * as db from "./db";
import { hashPassword, localOpenIdForEmail, normalizeEmail } from "./_core/localAuth";
import { sdk } from "./_core/sdk";
import { ONE_YEAR_MS } from "../shared/const";
import type { User } from "../drizzle/schema";

function stripSensitiveUser(u: User) {
  const { passwordHash: _p, ...safe } = u;
  return safe;
}

const materialTypeSchema = z.enum(["notes", "pdf", "slides", "assignment", "other"]);

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
        const { courseId, materialType, ...docData } = input;
        const doc = await lecturerQueries.createCourseDocument(ctx.user.id, courseId, {
          ...docData,
          materialType: materialType ?? "other",
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
        })
      )
      .mutation(({ ctx, input }) =>
        lecturerQueries.createAssignment(ctx.user.id, input)
      ),
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
      .mutation(({ ctx, input }) =>
        lecturerQueries.createAnnouncement(ctx.user.id, input)
      ),
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
  }),
});

/** Student-facing course enrollment */
export const studentCoursesRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    lecturerQueries.getStudentEnrolledCourses(ctx.user.id)
  ),
  enroll: protectedProcedure
    .input(z.object({ code: z.string().min(4).max(10) }))
    .mutation(({ ctx, input }) =>
      lecturerQueries.enrollStudentByCode(ctx.user.id, input.code)
    ),
  materials: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(({ ctx, input }) =>
      lecturerQueries.getStudentCourseDocuments(ctx.user.id, input.courseId)
    ),
  announcements: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const enrolled = await lecturerQueries.isStudentEnrolled(ctx.user.id, input.courseId);
      if (!enrolled) throw new TRPCError({ code: "FORBIDDEN" });
      const course = await lecturerQueries.getCourseById(input.courseId);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      return lecturerQueries.getCourseAnnouncements(input.courseId, course.lecturerId);
    }),
});
