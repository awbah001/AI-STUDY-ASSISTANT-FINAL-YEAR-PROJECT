import { TRPCError } from "@trpc/server";
import { eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { adminAuditLogs, studentProfiles } from "../drizzle/schema";
import {
  MAX_PROGRAMME_YEARS,
  MIN_PROGRAMME_YEARS,
  SEMESTERS,
  academicYearOptions,
  type Term,
} from "../shared/academics";
import { studentTermSchema } from "../shared/studentLearning";
import { zReason } from "../shared/validation";
import { adminProcedure, protectedProcedure, router, studentProcedure } from "./_core/trpc";
import * as academics from "./academics";
import { getDb } from "./db";
import { getSystemSettings, saveSystemSettings, userHasPermission } from "./settings";

const zName = (label: string) =>
  z.string().trim().min(2, `${label} must be at least 2 characters.`).max(120, `${label} must be at most 120 characters.`);
const zId = z.number().int().positive();
const zLevel = z.number().int().min(MIN_PROGRAMME_YEARS).max(MAX_PROGRAMME_YEARS);
const zSemester = z.enum(SEMESTERS);

async function currentTerm(): Promise<Term> {
  const { academic } = await getSystemSettings();
  return { academicYear: academic.academicYear.trim(), semester: academic.semester.trim() };
}

async function requirePermission(user: Parameters<typeof userHasPermission>[0], permission: string) {
  if (!(await userHasPermission(user, permission))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to perform this action." });
  }
}

async function audit(adminId: number, action: string, targetType: string, targetId: number, reason?: string, metadata?: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  await db.insert(adminAuditLogs).values({ adminId, action, targetType, targetId, reason: reason ?? null, metadata: metadata ?? null });
}

const adminRouter = router({
  catalogue: adminProcedure.query(async () => {
    const db = await getDb();
    const [faculties, counts] = await Promise.all([
      academics.getCatalogue(true),
      db
        ? db
            .select({ programmeId: studentProfiles.programmeId, count: sql<number>`cast(count(*) as integer)` })
            .from(studentProfiles)
            .where(isNotNull(studentProfiles.programmeId))
            .groupBy(studentProfiles.programmeId)
        : [],
    ]);
    return {
      faculties,
      studentCounts: Object.fromEntries(counts.map((c) => [c.programmeId, c.count])) as Record<number, number>,
      term: await currentTerm(),
    };
  }),

  saveFaculty: adminProcedure
    .input(z.object({ id: zId.optional(), name: zName("Faculty name") }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user, "system.configure");
      const row = await academics.saveFaculty(input);
      await audit(ctx.user.id, input.id ? "faculty.renamed" : "faculty.created", "faculty", row.id, undefined, { name: input.name });
      return row;
    }),

  saveDepartment: adminProcedure
    .input(z.object({ id: zId.optional(), facultyId: zId, name: zName("Department name") }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user, "system.configure");
      const row = await academics.saveDepartment(input);
      await audit(ctx.user.id, input.id ? "department.updated" : "department.created", "department", row.id, undefined, { name: input.name });
      return row;
    }),

  saveProgramme: adminProcedure
    .input(
      z.object({
        id: zId.optional(),
        departmentId: zId,
        name: zName("Programme name"),
        durationYears: z
          .number()
          .int()
          .min(MIN_PROGRAMME_YEARS, `A programme lasts at least ${MIN_PROGRAMME_YEARS} year.`)
          .max(MAX_PROGRAMME_YEARS, `A programme lasts at most ${MAX_PROGRAMME_YEARS} years.`),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user, "system.configure");
      const row = await academics.saveProgramme(input);
      await audit(ctx.user.id, input.id ? "programme.updated" : "programme.created", "programme", row.id, undefined, {
        name: input.name,
        durationYears: input.durationYears,
        isActive: input.isActive,
      });
      return row;
    }),

  deleteItem: adminProcedure
    .input(z.object({ kind: z.enum(["faculty", "department", "programme"]), id: zId }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user, "system.configure");
      const result = await academics.deleteCatalogueItem(input.kind, input.id);
      await audit(ctx.user.id, `${input.kind}.deleted`, input.kind, input.id);
      return result;
    }),

  courseTags: adminProcedure.query(async () =>
    [...(await academics.courseTags()).entries()].map(([courseId, tags]) => ({ courseId, ...tags }))
  ),

  setCourseTags: adminProcedure
    .input(z.object({ courseId: zId, programmeIds: z.array(zId).max(50), level: zLevel.nullable(), semester: zSemester.nullable() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user, "courses.edit");
      const { courseId, ...tags } = input;
      const result = await academics.setCourseTags(courseId, tags);
      await audit(ctx.user.id, "course.tags_updated", "course", courseId, undefined, tags);
      return result;
    }),

  setStudentAcademic: adminProcedure
    .input(
      z.object({
        userId: zId,
        programmeId: zId,
        level: zLevel,
        semester: zSemester.optional(),
        academicYear: z.string().trim().max(40).optional(),
        status: z.enum(["active", "completed"]).optional(),
        reason: zReason,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user, "users.edit");
      const { reason, ...values } = input;
      const result = await academics.setStudentAcademic(values);
      await audit(ctx.user.id, "student.academic_updated", "user", input.userId, reason, {
        programmeId: input.programmeId,
        level: input.level,
        status: input.status,
      });
      return result;
    }),

  previewNewTerm: adminProcedure.query(async () => academics.previewNewTerm(await currentTerm())),

  startNewTerm: adminProcedure
    .input(z.object({ expected: z.object({ academicYear: z.string(), semester: z.string() }), reason: zReason }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.user, "system.configure");
      const summary = await academics.startNewTerm(await currentTerm(), input.expected);
      await saveSystemSettings({ academic: { academicYear: summary.next.academicYear, semester: summary.next.semester } }, ctx.user.id);
      await audit(ctx.user.id, "term.started", "settings", 0, input.reason, {
        from: summary.current,
        to: { academicYear: summary.next.academicYear, semester: summary.next.semester },
        students: summary.students,
        promoted: summary.promoted,
        completed: summary.completed,
        notPromoted: summary.notPromoted,
      });
      return summary;
    }),
});

export const academicsRouter = router({
  /** Programme lists and the institution's current term, for profile setup and filters. */
  catalogue: protectedProcedure.query(async () => {
    const term = await currentTerm();
    return {
      faculties: await academics.getCatalogue(false),
      term,
      yearOptions: academicYearOptions(term.academicYear),
    };
  }),

  suggestedCourses: studentProcedure
    .input(z.object({ programmeId: zId, level: zLevel, semester: zSemester }))
    .query(({ input }) => academics.suggestedCourses(input)),

  /** Students keep their semester and academic year up to date; programme and level are set by the admin. */
  updateMyTerm: studentProcedure.input(studentTermSchema).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [profile] = await db.select({ userId: studentProfiles.userId }).from(studentProfiles).where(eq(studentProfiles.userId, ctx.user.id)).limit(1);
    if (!profile) throw new TRPCError({ code: "BAD_REQUEST", message: "Complete your student profile first." });
    await db
      .update(studentProfiles)
      .set({ semester: input.semester, academicYear: input.academicYear.trim(), updatedAt: new Date() })
      .where(eq(studentProfiles.userId, ctx.user.id));
    return { ok: true };
  }),

  admin: adminRouter,
});
