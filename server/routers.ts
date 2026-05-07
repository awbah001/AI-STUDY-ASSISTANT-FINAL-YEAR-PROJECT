import { ONE_YEAR_MS } from "../shared/const";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure, adminProcedure } from "./_core/trpc";
import { sql } from "drizzle-orm";
import { users, documents, flashcards, quizzes, progressTracking } from "../drizzle/schema";
import { z } from "zod";
import * as queries from "./queries";
import * as llmUtils from "./llmUtils";
import { TRPCError } from "@trpc/server";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { hashPassword, localOpenIdForEmail, normalizeEmail, verifyPassword } from "./_core/localAuth";
import type { User, ProgressTracking } from "../drizzle/schema";
import * as documentAi from "./documentAiService";

function stripSensitiveUser(u: User) {
  const { passwordHash: _p, ...safe } = u;
  return safe;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => {
      const u = opts.ctx.user;
      if (!u) return null;
      return stripSensitiveUser(u);
    }),
    signup: publicProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100),
          email: z.string().email(),
          password: z.string().min(8).max(200),
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
          lastSignedIn: new Date(),
        });

        if (!user) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create account.",
          });
        }

        const token = await sdk.createSessionToken(openId, {
          name: user.name || "",
          expiresInMs: ONE_YEAR_MS,
        });
        return { token, user: stripSensitiveUser(user) } as const;
      }),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ input }) => {
        const email = normalizeEmail(input.email);
        const user = await db.getUserByEmail(email);
        const stored = user?.passwordHash ?? null;
        const ok = stored ? await verifyPassword(input.password, stored) : false;

        if (!user || !ok) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password.",
          });
        }

        const token = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
          expiresInMs: ONE_YEAR_MS,
        });

        // Keep `lastSignedIn` fresh.
        await db.upsertUser({
          openId: user.openId,
          lastSignedIn: new Date(),
        });

        return { token, user: stripSensitiveUser(user) } as const;
      }),
    logout: publicProcedure.mutation(() => ({ success: true } as const)),

    updateProfile: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100).optional(),
          avatarUrl: z.union([z.string().max(2048), z.literal("")]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        if (!user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Not signed in." });
        }
        const patch: { name?: string; avatarUrl?: string | null } = {};
        if (input.name !== undefined) patch.name = input.name;
        if (input.avatarUrl !== undefined) {
          patch.avatarUrl = input.avatarUrl === "" ? null : input.avatarUrl;
        }
        if (Object.keys(patch).length === 0) {
          return db.getUserByOpenId(user.openId);
        }
        const updated = await db.updateUserByOpenId(user.openId, patch);
        if (!updated) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update profile." });
        }
        return stripSensitiveUser(updated);
      }),

    changePassword: protectedProcedure
      .input(
        z.object({
          currentPassword: z.string().min(1).max(200),
          newPassword: z.string().min(8).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        if (!user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Not signed in." });
        }
        if (user.loginMethod !== "local" || !user.passwordHash) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Password change is only available for accounts that use email and password.",
          });
        }
        const ok = await verifyPassword(input.currentPassword, user.passwordHash);
        if (!ok) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Current password is incorrect.",
          });
        }
        const passwordHash = await hashPassword(input.newPassword);
        const updated = await db.updateUserByOpenId(user.openId, { passwordHash });
        if (!updated) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update password." });
        }
        return { success: true as const };
      }),
  }),

  documents: router({
    extractDocumentText: publicProcedure
      .input(z.object({ fileUrl: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const extractedText = await llmUtils.extractDocumentText(input.fileUrl);
          return extractedText;
        } catch (error) {
          console.error("Document extraction error:", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to extract document text" });
        }
      }),
    list: protectedProcedure.query(({ ctx }) => queries.getUserDocuments(ctx.user.id)),
    favorites: protectedProcedure.query(({ ctx }) => queries.getUserFavoriteDocuments(ctx.user.id)),
    search: protectedProcedure
      .input(z.object({ query: z.string() }))
      .query(({ ctx, input }) => queries.searchUserDocuments(ctx.user.id, input.query)),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const doc = await queries.getDocumentById(input.id);
        if (!doc || doc.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        return doc;
      }),
    toggleFavorite: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const doc = await queries.getDocumentById(input.id);
        if (!doc || doc.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        return queries.toggleDocumentFavorite(input.id);
      }),
    create: protectedProcedure
      .input(z.object({
        title: z.string(),
        description: z.string().optional(),
        fileName: z.string(),
        fileSize: z.number(),
        fileUrl: z.string(),
        fileKey: z.string(),
        mimeType: z.string().optional(),
        extractedText: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const doc = await queries.createDocument({
          userId: ctx.user.id,
          title: input.title,
          description: input.description,
          fileName: input.fileName,
          fileSize: input.fileSize,
          fileUrl: input.fileUrl,
          fileKey: input.fileKey,
          extractedText: input.extractedText,
          mimeType: input.mimeType || "application/pdf",
        });
        await queries.getOrCreateProgress(doc.id, ctx.user.id);
        if (doc.extractedText?.trim()) {
          try {
            await llmUtils.indexDocumentForRag(doc.id, doc.extractedText);
          } catch (e) {
            console.error("RAG indexing failed:", e);
          }
        }
        return doc;
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const doc = await queries.getDocumentById(input.id);
        if (!doc || doc.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Document not found or access denied." });
        }
        await queries.deleteDocument(input.id);
        return { success: true };
      }),
  }),

  chat: router({
    history: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const doc = await queries.getDocumentById(input.documentId);
        if (!doc || doc.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        const messages = await queries.getDocumentChatHistory(input.documentId);
        return messages.reverse();
      }),
    send: protectedProcedure
      .input(z.object({ documentId: z.number(), message: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const doc = await queries.getDocumentById(input.documentId);
        if (!doc || doc.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        await queries.createChatMessage({
          documentId: input.documentId,
          userId: ctx.user.id,
          role: "user",
          content: input.message,
        });

        let aiResponse: string;
        const slash = documentAi.parseSlashCommand(input.message);

        try {
          if (slash?.type === "summary") {
            await documentAi.generateSummaryForDocument(input.documentId);
            aiResponse =
              "I've generated an **AI summary** of this document. Open the **AI Actions** tab to read it.";
          } else if (slash?.type === "flashcards") {
            const saved = await documentAi.generateFlashcardsForDocument(
              input.documentId,
              ctx.user.id,
              slash.count
            );
            aiResponse = `I've added **${saved.length} AI flashcards**. Open the **Flashcards** tab to study them.`;
          } else if (slash?.type === "quiz") {
            const quiz = await documentAi.generateQuizForDocument(
              input.documentId,
              ctx.user.id,
              slash.count
            );
            aiResponse = `I've created a new **AI quiz** (${quiz.totalQuestions} questions). Open the **Quizzes** tab to take it.`;
          } else {
            const history = await queries.getDocumentChatHistory(input.documentId);
            aiResponse = await llmUtils.generateDocumentAwareResponse(
              input.documentId,
              input.message,
              doc.extractedText || "",
              doc.title,
              history
            );
          }
        } catch (err) {
          if (err instanceof TRPCError) {
            aiResponse = err.message;
          } else {
            console.error(err);
            aiResponse =
              "Something went wrong while running the AI. Check that LM Studio is running and try again.";
          }
        }

        await queries.createChatMessage({
          documentId: input.documentId,
          userId: ctx.user.id,
          role: "assistant",
          content: aiResponse,
        });
        return { userMessage: input.message, aiResponse };
      }),
  }),

  summary: router({
    get: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const doc = await queries.getDocumentById(input.documentId);
        if (!doc || doc.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        return queries.getDocumentSummary(input.documentId);
      }),
    generate: protectedProcedure
      .input(
        z.object({
          documentId: z.number(),
          topic: z
            .string()
            .trim()
            .min(2, "Topic must be at least 2 characters.")
            .max(120, "Topic must be 120 characters or fewer.")
            .optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const doc = await queries.getDocumentById(input.documentId);
        if (!doc || doc.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        return documentAi.generateSummaryForDocument(input.documentId, input.topic);
      }),
  }),

  flashcards: router({
    list: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const doc = await queries.getDocumentById(input.documentId);
        if (!doc || doc.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        return queries.getDocumentFlashcards(input.documentId);
      }),
    generate: protectedProcedure
      .input(
        z.object({
          documentId: z.number(),
          count: z.number().min(3).max(30).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const doc = await queries.getDocumentById(input.documentId);
        if (!doc || doc.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        return documentAi.generateFlashcardsForDocument(
          input.documentId,
          ctx.user.id,
          input.count ?? 10
        );
      }),
    toggleFavorite: protectedProcedure
      .input(z.object({ flashcardId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const card = await queries.toggleFlashcardFavorite(input.flashcardId);
        if (!card) throw new TRPCError({ code: "NOT_FOUND" });
        if (card.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        return card;
      }),
    markReviewed: protectedProcedure
      .input(z.object({ flashcardId: z.number(), studyTimeMinutes: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const card = await queries.updateFlashcardReview(input.flashcardId);
        if (!card) throw new TRPCError({ code: "NOT_FOUND" });
        if (card.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        const progress = await queries.getOrCreateProgress(card.documentId, ctx.user.id);
        const reviewedCount = (progress.flashcardsReviewed || 0) + 1;

        // Update study time if provided
        const studyTimeUpdates: Partial<ProgressTracking> = {};
        if (input.studyTimeMinutes) {
          studyTimeUpdates.totalStudyTimeMinutes = (progress.totalStudyTimeMinutes || 0) + input.studyTimeMinutes;
        }

        await queries.updateProgressActivity(card.documentId, ctx.user.id, {
          flashcardsReviewed: reviewedCount,
          ...studyTimeUpdates,
        });

        // Create study session record
        if (input.studyTimeMinutes && input.studyTimeMinutes > 0) {
          await queries.createStudySession({
            userId: ctx.user.id,
            documentId: card.documentId,
            startTime: new Date(Date.now() - input.studyTimeMinutes * 60 * 1000), // Approximate start time
            endTime: new Date(),
            durationMinutes: input.studyTimeMinutes,
            activityType: "flashcard",
          });
        }

        return card;
      }),
  }),

  quizzes: router({
    list: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const doc = await queries.getDocumentById(input.documentId);
        if (!doc || doc.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        return queries.getDocumentQuizzes(input.documentId);
      }),
    generate: protectedProcedure
      .input(
        z.object({
          documentId: z.number(),
          questionCount: z.number().min(3).max(20).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const doc = await queries.getDocumentById(input.documentId);
        if (!doc || doc.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        return documentAi.generateQuizForDocument(
          input.documentId,
          ctx.user.id,
          input.questionCount ?? 5
        );
      }),
    get: protectedProcedure
      .input(z.object({ quizId: z.number() }))
      .query(async ({ ctx, input }) => {
        const quiz = await queries.getQuizById(input.quizId);
        if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
        const doc = await queries.getDocumentById(quiz.documentId);
        if (!doc || doc.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        const questions = await queries.getQuizQuestions(input.quizId);
        return { ...quiz, questions };
      }),
    submitQuiz: protectedProcedure
      .input(z.object({ quizId: z.number(), score: z.number(), studyTimeMinutes: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const quiz = await queries.updateQuizScore(input.quizId, input.score, new Date());
        if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
        const progress = await queries.getOrCreateProgress(quiz.documentId, ctx.user.id);
        const newAttempts = (progress.quizzesAttempted || 0) + 1;
        const currentAvg = parseFloat(progress.averageQuizScore?.toString() || "0");
        const newAvg = (currentAvg * (newAttempts - 1) + input.score) / newAttempts;
        
        // Update study time if provided
        const studyTimeUpdates: Partial<ProgressTracking> = {};
        if (input.studyTimeMinutes) {
          studyTimeUpdates.totalStudyTimeMinutes = (progress.totalStudyTimeMinutes || 0) + input.studyTimeMinutes;
        }

        await queries.updateProgressActivity(quiz.documentId, ctx.user.id, {
          quizzesAttempted: newAttempts,
          averageQuizScore: newAvg,
          ...studyTimeUpdates,
        });

        // Create study session record
        if (input.studyTimeMinutes && input.studyTimeMinutes > 0) {
          await queries.createStudySession({
            userId: ctx.user.id,
            documentId: quiz.documentId,
            startTime: new Date(Date.now() - input.studyTimeMinutes * 60 * 1000), // Approximate start time
            endTime: new Date(),
            durationMinutes: input.studyTimeMinutes,
            activityType: "quiz",
          });
        }

        return quiz;
      }),
  }),

  progress: router({
    get: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const doc = await queries.getDocumentById(input.documentId);
        if (!doc || doc.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        return queries.getOrCreateProgress(input.documentId, ctx.user.id);
      }),
    stats: protectedProcedure.query(({ ctx }) => queries.getUserProgress(ctx.user.id)),
    analytics: protectedProcedure.query(async ({ ctx }) => {
      const [subjectPerformance, weeklyData, monthlyData, currentStreak, totalStudyTime, recommendedRevision] = await Promise.all([
        queries.getSubjectPerformance(ctx.user.id),
        queries.getWeeklyStudyData(ctx.user.id),
        queries.getMonthlyStudyData(ctx.user.id),
        queries.getCurrentStudyStreak(ctx.user.id),
        queries.getTotalStudyTime(ctx.user.id),
        queries.getRecommendedRevision(ctx.user.id),
      ]);

      return {
        subjectPerformance,
        weeklyData,
        monthlyData,
        currentStreak,
        totalStudyTime,
        recommendedRevision,
      };
    }),
  }),

  studySessions: router({
    start: protectedProcedure
      .input(z.object({
        documentId: z.number().optional(),
        activityType: z.enum(["quiz", "flashcard", "reading", "chat"])
      }))
      .mutation(async ({ ctx, input }) => {
        return queries.createStudySession({
          userId: ctx.user.id,
          documentId: input.documentId,
          startTime: new Date(),
          activityType: input.activityType,
        });
      }),
    end: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        durationMinutes: z.number()
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await queries.updateStudySession(
          input.sessionId,
          new Date(),
          input.durationMinutes
        );
        if (!session || session.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return session;
      }),
    getRecent: protectedProcedure.query(({ ctx }) => queries.getUserStudySessions(ctx.user.id)),
  }),

  admin: router({
    getAnalytics: adminProcedure.query(async () => {
      const dbConn = await db.getDb();
      if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      const [[{ count: userCount }], [{ count: docCount }], [{ count: flashcardCount }], [{ count: quizCount }]] = await Promise.all([
        dbConn.select({ count: sql<number>`cast(count(${users.id}) as integer)` }).from(users),
        dbConn.select({ count: sql<number>`cast(count(${documents.id}) as integer)` }).from(documents),
        dbConn.select({ count: sql<number>`cast(count(${flashcards.id}) as integer)` }).from(flashcards),
        dbConn.select({ count: sql<number>`cast(count(${quizzes.id}) as integer)` }).from(quizzes),
      ]);

      // Fetch recent activities
      const recentActivities = await dbConn
        .select({
          id: documents.id,
          userId: documents.userId,
          userName: users.name,
          userInitials: sql<string>`substr(${users.name}, 1, 1) || substr(${users.name}, instr(${users.name}, ' ') + 1, 1)`,
          action: sql<string>`'uploaded'`,
          target: documents.title,
          targetType: sql<string>`'document'`,
          createdAt: documents.createdAt,
        })
        .from(documents)
        .leftJoin(users, sql`${documents.userId} = ${users.id}`)
        .orderBy(sql`${documents.createdAt} DESC`)
        .limit(10);

      const recentQuizzes = await dbConn
        .select({
          id: quizzes.id,
          userId: quizzes.userId,
          userName: users.name,
          userInitials: sql<string>`substr(${users.name}, 1, 1) || substr(${users.name}, instr(${users.name}, ' ') + 1, 1)`,
          action: sql<string>`'created'`,
          target: quizzes.title,
          targetType: sql<string>`'quiz'`,
          createdAt: quizzes.createdAt,
        })
        .from(quizzes)
        .leftJoin(users, sql`${quizzes.userId} = ${users.id}`)
        .orderBy(sql`${quizzes.createdAt} DESC`)
        .limit(10);

      const recentFlashcards = await dbConn
        .select({
          id: flashcards.id,
          userId: flashcards.userId,
          userName: users.name,
          userInitials: sql<string>`substr(${users.name}, 1, 1) || substr(${users.name}, instr(${users.name}, ' ') + 1, 1)`,
          action: sql<string>`'generated'`,
          target: documents.title,
          targetType: sql<string>`'flashcard'`,
          createdAt: flashcards.createdAt,
        })
        .from(flashcards)
        .leftJoin(users, sql`${flashcards.userId} = ${users.id}`)
        .leftJoin(documents, sql`${flashcards.documentId} = ${documents.id}`)
        .orderBy(sql`${flashcards.createdAt} DESC`)
        .limit(10);

      const recentSignups = await dbConn
        .select({
          id: users.id,
          userId: users.id,
          userName: users.name,
          userInitials: sql<string>`substr(${users.name}, 1, 1) || substr(${users.name}, instr(${users.name}, ' ') + 1, 1)`,
          action: sql<string>`'joined'`,
          target: sql<string>`'the platform'`,
          targetType: sql<string>`'user'`,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(sql`${users.createdAt} DESC`)
        .limit(10);

      // Combine and sort by date
      const combined = [...recentActivities, ...recentQuizzes, ...recentFlashcards, ...recentSignups];
      const allActivities = combined
        .sort((a, b) => ((b.createdAt as Date)?.getTime() || 0) - ((a.createdAt as Date)?.getTime() || 0))
        .slice(0, 6);

      // Fetch top performers
      const topPerformers = await dbConn
        .select({
          userId: progressTracking.userId,
          userEmail: users.email,
          userName: users.name,
          userInitials: sql<string>`substr(${users.name}, 1, 1) || substr(${users.name}, instr(${users.name}, ' ') + 1, 1)`,
          engagementScore: sql<number>`cast((coalesce(${progressTracking.quizzesAttempted}, 0) * 50 + coalesce(${progressTracking.flashcardsReviewed}, 0) * 30) as integer)`,
          quizzesAttempted: progressTracking.quizzesAttempted,
        })
        .from(progressTracking)
        .leftJoin(users, sql`${progressTracking.userId} = ${users.id}`)
        .orderBy(sql`(coalesce(${progressTracking.quizzesAttempted}, 0) * 50 + coalesce(${progressTracking.flashcardsReviewed}, 0) * 30) DESC`)
        .limit(5);

      // Fetch all users with engagement scores
      const allUsers = await dbConn
        .selectDistinct({
          userId: users.id,
          userEmail: users.email,
          userName: users.name,
          userInitials: sql<string>`case when instr(${users.name}, ' ') > 0 then substr(${users.name}, 1, 1) || substr(${users.name}, instr(${users.name}, ' ') + 1, 1) else substr(${users.name}, 1, 1) end`,
          engagementScore: sql<number>`cast((coalesce(${progressTracking.quizzesAttempted}, 0) * 50 + coalesce(${progressTracking.flashcardsReviewed}, 0) * 30) as integer)`,
          quizzesAttempted: sql`coalesce(${progressTracking.quizzesAttempted}, 0)`,
          createdAt: users.createdAt,
        })
        .from(users)
        .leftJoin(progressTracking, sql`${users.id} = ${progressTracking.userId}`)
        .orderBy(sql`${users.createdAt} DESC`);

      // Fetch all documents with owner names
      const allDocuments = await dbConn
        .select({
          id: documents.id,
          title: documents.title,
          fileName: documents.fileName,
          isPublic: documents.isPublic,
          createdAt: documents.createdAt,
          userId: documents.userId,
          userName: users.name,
        })
        .from(documents)
        .leftJoin(users, sql`${documents.userId} = ${users.id}`)
        .orderBy(sql`${documents.createdAt} DESC`);

      return {
        userCount,
        docCount,
        flashcardCount,
        quizCount,
        recentActivities: allActivities,
        topPerformers,
        allUsers,
        allDocuments,
      };
    }),



    deleteUser: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        await queries.deleteUser(input.userId);
        return { success: true };
      }),

    toggleUserBan: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        const user = await queries.toggleUserBan(input.userId);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });
        return stripSensitiveUser(user);
      }),

    deleteDocument: adminProcedure
      .input(z.object({ documentId: z.number() }))
      .mutation(async ({ input }) => {
        await queries.deleteDocument(input.documentId);
        return { success: true };
      }),

    toggleDocumentPublic: adminProcedure
      .input(z.object({ documentId: z.number() }))
      .mutation(async ({ input }) => {
        const doc = await queries.getDocumentById(input.documentId);
        if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
        const updated = await queries.updateDocument(input.documentId, { isPublic: !doc.isPublic });
        return updated;
      }),

    getSystemPerformance: adminProcedure.query(async () => {
      // Mock or real performance data
      return {
        cpuUsage: Math.random() * 20 + 5,
        memoryUsage: Math.random() * 40 + 20,
        uptimeSeconds: process.uptime(),
        responseTimeMs: Math.random() * 50 + 10,
        activeSessions: Math.floor(Math.random() * 50) + 1,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
