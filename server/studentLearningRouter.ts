import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  assignmentSubmissions,
  assignments,
  courses,
  documents,
  progressTracking,
  quizQuestions,
  quizzes,
  studentActivities,
  studentProfiles,
  studySessions,
} from "../drizzle/schema";
import { academicProfileSchema, FOCUS_GOALS, LEARN_MODES, ONBOARDING_STEPS, type OnboardingStep } from "../shared/studentLearning";
import { studentProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import * as lecturerQueries from "./lecturerQueries";
import * as queries from "./queries";
import {
  ACTIVITY_TYPES,
  recordStudentActivity,
  type ActivityType,
} from "./studentActivity";
import {
  buildInsights,
  derivePersona,
  documentProgressPct,
  pickRecommendation,
  type ContinueLearning,
  type WeakTopic,
} from "./recommendations";

const academicSchema = z.object({
  faculty: z.string().trim().max(120, "Faculty must be at most 120 characters.").optional().nullable(),
  department: z.string().trim().max(120, "Department must be at most 120 characters.").optional().nullable(),
  programme: z.string().trim().max(120, "Programme must be at most 120 characters.").optional().nullable(),
  academicLevel: z.string().trim().max(80).optional().nullable(),
  semester: z.string().trim().max(40).optional().nullable(),
  academicYear: z.string().trim().max(40).optional().nullable(),
});

function isStep(value: string | null | undefined): OnboardingStep {
  return (ONBOARDING_STEPS as readonly string[]).includes(value ?? "")
    ? (value as OnboardingStep)
    : "welcome";
}

function isOnboardingComplete(row: typeof studentProfiles.$inferSelect) {
  return Boolean(row.onboardingCompletedAt) && academicProfileSchema.safeParse(row).success;
}

/** Only call this when a student self-registers (email signup or first Google account). */
export async function beginStudentOnboarding(userId: number) {
  const dbConn = await getDb();
  if (!dbConn) return;
  const now = new Date();
  const existing = await dbConn.select().from(studentProfiles).where(eq(studentProfiles.userId, userId)).limit(1);
  if (existing[0]) {
    if (isOnboardingComplete(existing[0])) return;
    await dbConn
      .update(studentProfiles)
      .set({ onboardingRequired: true, onboardingStep: "welcome", updatedAt: now })
      .where(eq(studentProfiles.userId, userId));
    return;
  }
  await dbConn.insert(studentProfiles).values({
    userId,
    onboardingRequired: true,
    onboardingStep: "welcome",
    onboardingCompletedAt: null,
    updatedAt: now,
  });
}

async function getOrCreateProfile(userId: number) {
  const dbConn = await getDb();
  if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const existing = await dbConn.select().from(studentProfiles).where(eq(studentProfiles.userId, userId)).limit(1);
  if (existing[0]) return existing[0];

  // All students, including admin-created accounts, complete their academic profile.
  const now = new Date();
  await dbConn.insert(studentProfiles).values({
    userId,
    onboardingRequired: true,
    onboardingStep: "academic",
    onboardingCompletedAt: null,
    updatedAt: now,
  });
  const created = await dbConn.select().from(studentProfiles).where(eq(studentProfiles.userId, userId)).limit(1);
  return created[0]!;
}

function serializeProfile(row: typeof studentProfiles.$inferSelect) {
  return {
    studentNumber: row.studentNumber,
    faculty: row.faculty,
    department: row.department,
    programme: row.programme,
    academicLevel: row.academicLevel,
    semester: row.semester,
    academicYear: row.academicYear,
    learnModes: row.learnModes ?? [],
    focusGoals: row.focusGoals ?? [],
    onboardingStep: isStep(row.onboardingStep),
    onboardingCompleted: isOnboardingComplete(row),
    onboardingCompletedAt: row.onboardingCompletedAt,
    lastCourseId: row.lastCourseId,
    lastDocumentId: row.lastDocumentId,
    lastQuizId: row.lastQuizId,
  };
}

export async function assertPendingStudentOnboarding(userId: number) {
  const profile = await getOrCreateProfile(userId);
  if (isOnboardingComplete(profile)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Onboarding is only available to newly registered students.",
    });
  }
  return profile;
}

async function requirePendingOnboarding(userId: number) {
  return assertPendingStudentOnboarding(userId);
}

export const studentLearningRouter = router({
  completeProfileSetup: studentProcedure.input(academicProfileSchema).mutation(async ({ ctx, input }) => {
    const dbConn = await getDb();
    if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await requirePendingOnboarding(ctx.user.id);
    await dbConn.update(studentProfiles).set({
      ...input,
      onboardingStep: "done",
      onboardingRequired: false,
      onboardingCompletedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(studentProfiles.userId, ctx.user.id));
    return { ok: true };
  }),
  onboardingStatus: studentProcedure.query(async ({ ctx }) => {
    const profile = await getOrCreateProfile(ctx.user.id);
    const [enrolled, catalog] = await Promise.all([
      lecturerQueries.getStudentEnrolledCourses(ctx.user.id),
      lecturerQueries.listActiveCourseCatalog(),
    ]);
    return {
      completed: isOnboardingComplete(profile),
      step: isStep(profile.onboardingStep),
      profile: serializeProfile(profile),
      enrolledCourses: enrolled,
      catalog,
      studentName: ctx.user.name,
    };
  }),

  saveAcademic: studentProcedure.input(academicSchema).mutation(async ({ ctx, input }) => {
    const dbConn = await getDb();
    if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await requirePendingOnboarding(ctx.user.id);
    await dbConn
      .update(studentProfiles)
      .set({
        faculty: input.faculty?.trim() || null,
        department: input.department?.trim() || null,
        programme: input.programme?.trim() || null,
        academicLevel: input.academicLevel?.trim() || null,
        semester: input.semester?.trim() || null,
        academicYear: input.academicYear?.trim() || null,
        onboardingStep: "courses",
        updatedAt: new Date(),
      })
      .where(eq(studentProfiles.userId, ctx.user.id));
    return { ok: true, step: "courses" as const };
  }),

  confirmCourses: studentProcedure
    .input(z.object({ courseIds: z.array(z.number().int().positive()).max(40) }))
    .mutation(async ({ ctx, input }) => {
      await requirePendingOnboarding(ctx.user.id);
      const already = await lecturerQueries.getStudentEnrolledCourses(ctx.user.id);
      const alreadyIds = new Set(already.map((c) => c.id));
      const toAdd = input.courseIds.filter((id) => !alreadyIds.has(id));
      if (toAdd.length) {
        await lecturerQueries.enrollStudentInCourses(ctx.user.id, toAdd);
      }
      const dbConn = await getDb();
      if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await dbConn
        .update(studentProfiles)
        .set({ onboardingStep: "preferences", updatedAt: new Date() })
        .where(eq(studentProfiles.userId, ctx.user.id));
      return { ok: true, step: "preferences" as const };
    }),

  savePreferences: studentProcedure
    .input(
      z.object({
        learnModes: z.array(z.string()).max(LEARN_MODES.length),
        focusGoals: z.array(z.string()).max(FOCUS_GOALS.length),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const dbConn = await getDb();
      if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await requirePendingOnboarding(ctx.user.id);
      const modes = input.learnModes.filter((id) => LEARN_MODES.some((m) => m.id === id));
      const goals = input.focusGoals.filter((id) => FOCUS_GOALS.some((g) => g.id === id));
      await dbConn
        .update(studentProfiles)
        .set({
          learnModes: modes,
          focusGoals: goals,
          onboardingStep: "ai",
          updatedAt: new Date(),
        })
        .where(eq(studentProfiles.userId, ctx.user.id));
      return { ok: true, step: "ai" as const };
    }),

  completeOnboarding: studentProcedure.mutation(async ({ ctx }) => {
    const dbConn = await getDb();
    if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const profile = await requirePendingOnboarding(ctx.user.id);
    if (!academicProfileSchema.safeParse(profile).success) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Complete all academic profile fields before continuing." });
    }
    await dbConn
      .update(studentProfiles)
      .set({
        onboardingStep: "done",
        onboardingRequired: false,
        onboardingCompletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(studentProfiles.userId, ctx.user.id));
    return { ok: true };
  }),

  recordActivity: studentProcedure
    .input(
      z.object({
        type: z.custom<ActivityType>((v) => ACTIVITY_TYPES.includes(v as ActivityType)),
        courseId: z.number().int().positive().optional(),
        documentId: z.number().int().positive().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.courseId) {
        const enrolled = await lecturerQueries.isStudentEnrolled(ctx.user.id, input.courseId);
        if (!enrolled) throw new TRPCError({ code: "FORBIDDEN" });
      }
      await recordStudentActivity({
        userId: ctx.user.id,
        type: input.type as ActivityType,
        courseId: input.courseId,
        documentId: input.documentId,
        metadata: input.metadata,
      });
      return { ok: true };
    }),

  dashboard: studentProcedure.query(async ({ ctx }) => {
    const dbConn = await getDb();
    if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const profile = await getOrCreateProfile(ctx.user.id);
    const userId = ctx.user.id;

    const [enrolled, progress, analytics, catalog] = await Promise.all([
      lecturerQueries.getStudentEnrolledCourses(userId),
      queries.getUserProgressWithTitles(userId),
      Promise.all([
        queries.getCurrentStudyStreak(userId),
        queries.getTotalStudyTime(userId),
        queries.getDailyStudyData(userId),
      ]),
      lecturerQueries.listActiveCourseCatalog(),
    ]);
    const [streak, totalStudyTime, dailyData] = analytics;
    const courseIds = enrolled.map((c) => c.id);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [pendingAssignments, submissions, missedQuestions, weekSessions, recentActivity] = await Promise.all([
      courseIds.length
        ? dbConn
            .select({
              id: assignments.id,
              title: assignments.title,
              courseId: assignments.courseId,
              dueDate: assignments.dueDate,
              courseTitle: courses.title,
            })
            .from(assignments)
            .innerJoin(courses, eq(assignments.courseId, courses.id))
            .where(inArray(assignments.courseId, courseIds))
            .orderBy(assignments.dueDate)
            .limit(20)
        : Promise.resolve([]),
      courseIds.length
        ? dbConn
            .select()
            .from(assignmentSubmissions)
            .where(and(eq(assignmentSubmissions.studentId, userId), inArray(assignmentSubmissions.courseId, courseIds)))
        : Promise.resolve([]),
      dbConn
        .select({
          question: quizQuestions.question,
          isCorrect: quizQuestions.isCorrect,
          documentId: documents.id,
          documentTitle: documents.title,
          subject: documents.subject,
          courseId: documents.courseId,
          score: quizzes.score,
          quizId: quizzes.id,
        })
        .from(quizQuestions)
        .innerJoin(quizzes, eq(quizQuestions.quizId, quizzes.id))
        .innerJoin(documents, eq(quizzes.documentId, documents.id))
        .where(eq(quizzes.userId, userId)),
      dbConn
        .select({ count: sql<number>`cast(count(*) as integer)` })
        .from(studySessions)
        .where(and(eq(studySessions.userId, userId), gte(studySessions.startTime, weekAgo))),
      dbConn
        .select({
          id: studentActivities.id,
          type: studentActivities.type,
          courseId: studentActivities.courseId,
          documentId: studentActivities.documentId,
          createdAt: studentActivities.createdAt,
        })
        .from(studentActivities)
        .where(eq(studentActivities.userId, userId))
        .orderBy(desc(studentActivities.createdAt))
        .limit(12),
    ]);

    const now = Date.now();
    const subByAssignment = new Map(submissions.map((s) => [s.assignmentId, s]));
    const upcoming = pendingAssignments
      .map((item) => {
        const sub = subByAssignment.get(item.id);
        const due = item.dueDate ? new Date(item.dueDate).getTime() : null;
        let status: "Not Started" | "Submitted" | "Graded" | "Overdue" | "In Progress" = "Not Started";
        if (sub?.status === "graded") status = "Graded";
        else if (sub?.status === "submitted" || sub?.status === "late") status = "Submitted";
        else if (due !== null && due < now) status = "Overdue";
        return {
          id: item.id,
          title: item.title,
          courseId: item.courseId,
          courseTitle: item.courseTitle,
          dueDate: item.dueDate,
          status,
          href: `/course/${item.courseId}`,
        };
      })
      .filter((item) => item.status !== "Graded" && item.status !== "Submitted")
      .slice(0, 6);

    const overdue = upcoming.filter((item) => item.status === "Overdue");

    const topicMap = new Map<string, WeakTopic>();
    const parseScore = (value: unknown): number | null => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && value.trim()) {
        const n = parseFloat(value);
        return Number.isFinite(n) ? n : null;
      }
      return null;
    };
    for (const row of missedQuestions) {
      const topic = (row.subject || row.documentTitle || "Course topic").trim();
      const key = `${row.courseId ?? 0}:${topic.toLowerCase()}`;
      const score = parseScore(row.score);
      const current = topicMap.get(key) ?? {
        topic,
        courseId: row.courseId,
        courseTitle: enrolled.find((c) => c.id === row.courseId)?.title ?? null,
        documentId: row.documentId,
        misses: 0,
        attempts: 0,
        lastScore: score,
      };
      current.attempts += 1;
      if (row.isCorrect === false) current.misses += 1;
      if (score !== null) current.lastScore = score;
      topicMap.set(key, current);
    }
    const weakTopics = [...topicMap.values()]
      .filter((t) => t.misses > 0 && (t.lastScore === null || t.lastScore < 70 || t.misses / Math.max(t.attempts, 1) >= 0.4))
      .sort((a, b) => b.misses - a.misses || (a.lastScore ?? 100) - (b.lastScore ?? 100))
      .slice(0, 5);

    const lastDocId = profile.lastDocumentId;
    const lastProgress = lastDocId
      ? progress.find((p) => p.documentId === lastDocId)
      : progress[0];
    const lastDoc = lastProgress
      ? await queries.getDocumentById(lastProgress.documentId)
      : null;
    const lastCourse = lastDoc?.courseId
      ? enrolled.find((c) => c.id === lastDoc.courseId) ?? catalog.find((c) => c.id === lastDoc.courseId)
      : enrolled.find((c) => c.id === profile.lastCourseId) ?? enrolled[0];

    let continueLearning: ContinueLearning = null;
    if (lastDoc && lastProgress) {
      continueLearning = {
        courseId: lastDoc.courseId,
        courseTitle: lastCourse?.title ?? lastDoc.title,
        documentId: lastDoc.id,
        documentTitle: lastDoc.title,
        progressPct: documentProgressPct({
          flashcardsReviewed: lastProgress.flashcardsReviewed ?? 0,
          quizzesAttempted: lastProgress.quizzesAttempted ?? 0,
          totalStudyTimeMinutes: lastProgress.totalStudyTimeMinutes ?? 0,
        }),
        href: `/document/${lastDoc.id}`,
      };
    } else if (lastCourse) {
      continueLearning = {
        courseId: lastCourse.id,
        courseTitle: lastCourse.title,
        documentId: null,
        documentTitle: null,
        progressPct: 0,
        href: `/course/${lastCourse.id}`,
      };
    }

    const scored = progress.filter((p) => (p.quizzesAttempted ?? 0) > 0);
    const quizAccuracy =
      scored.length > 0
        ? Math.round(scored.reduce((s, p) => s + (p.averageQuizScore ?? 0), 0) / scored.length)
        : null;
    const quizAttempts = progress.reduce((s, p) => s + (p.quizzesAttempted ?? 0), 0);
    const completedPct =
      progress.length === 0
        ? 0
        : Math.round(
            progress.reduce(
              (s, p) =>
                s +
                documentProgressPct({
                  flashcardsReviewed: p.flashcardsReviewed ?? 0,
                  quizzesAttempted: p.quizzesAttempted ?? 0,
                  totalStudyTimeMinutes: p.totalStudyTimeMinutes ?? 0,
                }),
              0
            ) / progress.length
          );

    const persona = derivePersona({
      quizAttempts,
      overdueCount: overdue.length,
      weakCount: weakTopics.length,
      quizAccuracy,
      streak,
    });

    const recommendation = pickRecommendation({
      overdue: overdue.map((o) => ({ title: o.title, courseId: o.courseId, href: o.href, dueDate: o.dueDate })),
      weakTopics,
      continueLearning,
      enrolledCount: enrolled.length,
    });

    const dueSoon = upcoming
      .filter((u) => u.dueDate && u.status !== "Overdue")
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0];
    const dueSoonDays =
      dueSoon?.dueDate != null
        ? Math.max(0, Math.ceil((new Date(dueSoon.dueDate).getTime() - now) / 86_400_000))
        : null;

    const lastCourseOpen = recentActivity.find((a) => a.type === "COURSE_OPENED" && a.courseId);
    const daysSinceCourse = lastCourseOpen?.createdAt
      ? Math.floor((now - new Date(lastCourseOpen.createdAt).getTime()) / 86_400_000)
      : null;

    const quizScores = missedQuestions
      .map((q) => parseScore(q.score))
      .filter((s): s is number => s !== null);
    const uniqueQuizScores = quizScores.length >= 2 ? [quizScores[quizScores.length - 1], quizScores[0]] : [];
    const quizDelta =
      uniqueQuizScores.length === 2 ? uniqueQuizScores[0] - uniqueQuizScores[1] : null;

    const insights = buildInsights({
      weekSessions: weekSessions[0]?.count ?? 0,
      quizDelta,
      weakTopics,
      daysSinceCourse,
      courseTitle: lastCourse?.title ?? null,
      dueSoonTitle: dueSoon?.title ?? null,
      dueSoonDays,
    });

    const today = [
      ...upcoming.slice(0, 2).map((u) => ({
        id: `asgn-${u.id}`,
        title: u.title,
        detail: `${u.courseTitle} · ${u.status}`,
        href: u.href,
      })),
      ...(weakTopics[0]
        ? [
            {
              id: "weak-1",
              title: `Review ${weakTopics[0].topic}`,
              detail: "From recent quiz results",
              href: weakTopics[0].documentId ? `/document/${weakTopics[0].documentId}` : "/(tabs)/quizzes",
            },
          ]
        : []),
      ...(continueLearning
        ? [
            {
              id: "continue",
              title: continueLearning.documentTitle
                ? `Continue ${continueLearning.documentTitle}`
                : `Open ${continueLearning.courseTitle}`,
              detail: continueLearning.progressPct ? `${continueLearning.progressPct}% complete` : "Start this course",
              href: continueLearning.href,
            },
          ]
        : []),
    ].slice(0, 4);

    const greeting =
      persona === "behind"
        ? "Catch up on overdue work first."
        : persona === "strong"
          ? "You are on track — keep the streak going."
          : persona === "new"
            ? "Here is a good place to start."
            : "Here is what you should focus on today.";

    return {
      student: {
        id: userId,
        name: ctx.user.name,
        persona,
        greeting,
      },
      onboardingCompleted: isOnboardingComplete(profile),
      continueLearning,
      today,
      progress: {
        courses: enrolled.length,
        completedPct,
        quizAccuracy,
        streak,
        studyMinutes: totalStudyTime,
        quizAttempts,
        dailyData,
      },
      upcoming,
      recommendation,
      weakTopics,
      insights,
      recentActivity,
      catalogEmpty: catalog.length === 0 && enrolled.length === 0,
    };
  }),
});
