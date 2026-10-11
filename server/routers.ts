import { ONE_YEAR_MS } from "../shared/const";
import { EMAIL_DOMAIN_ERROR, isAllowedEmail } from "../shared/emailDomain";
import { LIMITS, MESSAGES, zEmail, zLoginPassword, zNewPassword, zOptionalText, zPersonName, zReason, zText } from "../shared/validation";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure, adminProcedure, studentProcedure } from "./_core/trpc";
import { lecturerRouter, studentCoursesRouter } from "./lecturerRouter";
import { studentLearningRouter } from "./studentLearningRouter";
import { audioRecapRouter, discussionsRouter, examsRouter, practiceRouter } from "./studentFeaturesRouter";
import { settingsRouter } from "./settingsRouter";
import { autonomousAgentRouter } from "./autonomousAgentRouter";
import { stripSensitiveUser } from "./userSafe";
import { getPasswordMinLength, getFeatureFlags } from "./settings";
import { verifyTotp, consumeRecoveryCode } from "./totp";
import * as lecturerQueries from "./lecturerQueries";
import { canAccessDocument } from "./documentAccess";
import { sql, and, desc, eq, gte, inArray, like, or } from "drizzle-orm";
import { users, documents, flashcards, quizzes, quizQuestions, progressTracking, studySessions, courses, courseEnrollments, assignments, assignmentSubmissions, learningGoals, adminAuditLogs, systemEvents, notifications } from "../drizzle/schema";
import { z } from "zod";
import * as queries from "./queries";
import * as llmUtils from "./llmUtils";
import { TRPCError } from "@trpc/server";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { hashPassword, localOpenIdForEmail, normalizeEmail, verifyPassword } from "./_core/localAuth";
import { googleOpenId, verifyGoogleIdToken } from "./_core/googleAuth";
import { ENV } from "./_core/env";
import type { User } from "../drizzle/schema";
import * as documentAi from "./documentAiService";
import { runLearningAgent } from "./agent";
import * as calendar from "./calendar";
import { PLAN_LIMITS, PLAN_SESSION_TYPES } from "../shared/studyPlan";

async function writeAdminAudit(adminId: number, action: string, targetType: string, targetId: number, reason?: string, metadata?: Record<string, unknown>) {
  const dbConn = await db.getDb();
  if (!dbConn) return;
  // This table is deliberately append-only: no update/delete endpoint is exposed.
  await dbConn.insert(adminAuditLogs).values({ adminId, action, targetType, targetId, reason, metadata });
}

function forbidSelfAction(actorId: number, targetId: number) {
  if (actorId === targetId) throw new TRPCError({ code: "FORBIDDEN", message: "You cannot moderate your own administrator account." });
}

/** Sends through Resend when configured; local development gets a server-only link. */
async function deliverPasswordReset(email: string, token: string, expiresAt: Date) {
  const appUrl = (process.env.APP_URL || "http://localhost:5000").replace(/\/$/, "");
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PASSWORD_RESET_FROM;
  if (apiKey && from) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [email], subject: "Reset your Course-Specific AI Learning Assistant password", html: `<p>Use this link to reset your Course-Specific AI Learning Assistant password. It expires in one hour.</p><p><a href="${resetUrl}">Reset password</a></p>` }),
      });
      if (response.ok) return;
      console.error("[PasswordReset] Email delivery failed:", await response.text());
    } catch (error) { console.error("[PasswordReset] Email delivery failed:", error); }
  }
  // Never return reset tokens via the public API. This fallback is intentionally server-only.
  console.log(`[PasswordReset] Local reset URL for ${email} (expires ${expiresAt.toISOString()}): ${resetUrl}`);
}

function chronologicalAgentHistory(
  messages: Array<{ id?: number; role: string; content: string; createdAt?: Date | number | null }>
) {
  return [...messages]
    .sort((a, b) => {
      if (typeof a.id === "number" && typeof b.id === "number" && a.id !== b.id) {
        return a.id - b.id;
      }
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return ta - tb;
    })
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
}

async function assertDocumentAccess(userId: number, documentId: number) {
  const doc = await queries.getDocumentById(documentId);
  if (!doc || !(await canAccessDocument(userId, doc))) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  return doc;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => {
      const u = opts.ctx.user;
      if (!u) return null;
      return stripSensitiveUser(u);
    }),
    login: publicProcedure
      .input(
        z.object({
          email: zEmail,
          password: zLoginPassword,
          totpCode: z.string().trim().min(6, MESSAGES.codeInvalid).max(64, MESSAGES.codeInvalid).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const email = normalizeEmail(input.email);
        if (!isAllowedEmail(email)) {
          throw new TRPCError({ code: "FORBIDDEN", message: EMAIL_DOMAIN_ERROR });
        }
        const user = await db.getUserByEmail(email);
        const stored = user?.passwordHash ?? null;
        const ok = stored ? await verifyPassword(input.password, stored) : false;

        if (!user || !ok) {
          await queries.recordSystemEvent({
            category: "auth",
            severity: "warning",
            message: "LOGIN_FAILED",
            userId: user?.id,
          }).catch(() => undefined);
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password.",
          });
        }

        if (user.isBanned) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This account has been suspended.",
          });
        }

        if (user.totpEnabled) {
          if (!input.totpCode) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "Two-factor authentication code required.",
            });
          }
          const totpOk = user.totpSecret ? verifyTotp(user.totpSecret, input.totpCode) : false;
          const remaining = totpOk ? null : consumeRecoveryCode(user.totpRecoveryHashes ?? [], input.totpCode);
          if (!totpOk && !remaining) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid authenticator code." });
          }
          if (remaining) {
            await db.updateUserByOpenId(user.openId, { totpRecoveryHashes: remaining });
          }
        }

        const token = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
          expiresInMs: ONE_YEAR_MS,
          tokenVersion: user.tokenVersion ?? 0,
        });

        // Keep `lastSignedIn` fresh.
        await db.upsertUser({
          openId: user.openId,
          lastSignedIn: new Date(),
        });

        return { token, user: stripSensitiveUser(user) } as const;
      }),
    google: publicProcedure
      .input(
        z.object({
          idToken: z.string().min(20).max(16_000),
          client: z.enum(["web", "mobile"]),
        })
      )
      .mutation(async ({ input }) => {
        if (ENV.googleClientIds.length === 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Google sign-in is not configured on the server.",
          });
        }

        let profile;
        try {
          profile = await verifyGoogleIdToken(input.idToken);
        } catch (error) {
          console.warn("[Auth] Google token verification failed", error);
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Google sign-in could not be verified. Try again.",
          });
        }

        if (!isAllowedEmail(profile.email)) {
          throw new TRPCError({ code: "FORBIDDEN", message: EMAIL_DOMAIN_ERROR });
        }

        let user =
          (await db.getUserByOpenId(googleOpenId(profile.sub))) ??
          (await db.getUserByEmail(profile.email));

        if (user?.isBanned) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This account has been suspended.",
          });
        }

        // Institution students are provisioned on first Google sign-in; staff accounts stay admin-created.
        if (!user) {
          const created = await db.createUser({
            openId: googleOpenId(profile.sub),
            name: profile.name,
            email: profile.email,
            avatarUrl: profile.picture ?? undefined,
            loginMethod: "google",
            role: "user",
          });
          if (!created) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create your student account.",
            });
          }
          user = created;
          const { beginStudentOnboarding } = await import("./studentLearningRouter");
          await beginStudentOnboarding(user.id);
          await queries.recordSystemEvent({
            category: "auth",
            severity: "info",
            message: "STUDENT_AUTO_PROVISIONED",
            userId: user.id,
          }).catch(() => undefined);
        }

        const patch: { name?: string; avatarUrl?: string } = {};
        if (!user.name && profile.name) patch.name = profile.name;
        if (!user.avatarUrl && profile.picture) patch.avatarUrl = profile.picture;
        if (Object.keys(patch).length > 0) {
          await db.updateUserByOpenId(user.openId, patch);
        }
        await db.upsertUser({
          openId: user.openId,
          lastSignedIn: new Date(),
        });
        user = (await db.getUserByOpenId(user.openId)) ?? user;

        const token = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
          expiresInMs: ONE_YEAR_MS,
          tokenVersion: user.tokenVersion ?? 0,
        });
        return { token, user: stripSensitiveUser(user) } as const;
      }),
    logout: publicProcedure.mutation(() => ({ success: true } as const)),

    savePushToken: studentProcedure
      .input(z.object({ token: z.string().max(300) }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserByOpenId(ctx.user.openId, {
          expoPushToken: input.token,
        } as any);
        return { success: true as const };
      }),

    updateProfile: protectedProcedure
      .input(
        z.object({
          name: zPersonName().optional(),
          avatarUrl: z.union([z.string().trim().max(2048), z.literal("")]).optional(),
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
          currentPassword: z.string().min(1, "Enter your current password.").max(LIMITS.password.max * 2),
          newPassword: zNewPassword,
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
        const minLen = await getPasswordMinLength();
        if (input.newPassword.length < minLen) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Password must be at least ${minLen} characters.`,
          });
        }
        const ok = await verifyPassword(input.currentPassword, user.passwordHash);
        if (!ok) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Current password is incorrect.",
          });
        }
        const nextVersion = (user.tokenVersion ?? 0) + 1;
        const passwordHash = await hashPassword(input.newPassword);
        const updated = await db.updateUserByOpenId(user.openId, {
          passwordHash,
          tokenVersion: nextVersion,
        });
        if (!updated) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update password." });
        }
        const token = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
          expiresInMs: ONE_YEAR_MS,
          tokenVersion: nextVersion,
        });
        return { success: true as const, token };
      }),

    forgotPassword: publicProcedure
      .input(z.object({ email: zEmail }))
      .mutation(async ({ input }) => {
        const { nanoid } = await import("nanoid");
        const email = input.email.toLowerCase().trim();
        if (!isAllowedEmail(email)) return { success: true as const };
        const user = await db.getUserByEmail(email);
        // Always return success to prevent email enumeration
        if (!user || user.loginMethod !== "local") return { success: true as const };
        const token = nanoid(48);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await queries.createPasswordResetToken({ userId: user.id, token, expiresAt });
        await deliverPasswordReset(email, token, expiresAt);
        return { success: true as const };
      }),

    resetPassword: publicProcedure
      .input(z.object({
        token: z.string().trim().min(1, "This reset link is incomplete. Open the link from your email again.").max(300),
        newPassword: zNewPassword,
      }))
      .mutation(async ({ input }) => {
        const minLen = await getPasswordMinLength();
        if (input.newPassword.length < minLen) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Password must be at least ${minLen} characters.` });
        }
        const resetToken = await queries.getValidResetToken(input.token);
        if (!resetToken) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This reset link is invalid or has expired. Please request a new one.",
          });
        }
        const passwordHash = await hashPassword(input.newPassword);
        const updated = await db.updateUserById(resetToken.userId, { passwordHash });
        if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update password." });
        await queries.consumeResetToken(resetToken.id);
        return { success: true as const };
      }),
  }),

  documents: router({
    extractDocumentText: protectedProcedure
      .input(z.object({ fileUrl: z.string().trim().min(1, "File URL is required.").max(2048) }))
      .mutation(async ({ input }) => {
        const fileUrl = input.fileUrl.trim();
        if (!fileUrl.startsWith("/uploads/")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only local uploaded files can be extracted.",
          });
        }
        try {
          const extractedText = await llmUtils.extractDocumentText(fileUrl);
          return extractedText;
        } catch (error) {
          console.error("Document extraction error:", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to extract document text" });
        }
      }),
    list: protectedProcedure.query(({ ctx }) => queries.getUserDocuments(ctx.user.id)),
    favorites: protectedProcedure.query(({ ctx }) => queries.getUserFavoriteDocuments(ctx.user.id)),
    search: protectedProcedure
      .input(z.object({ query: zOptionalText("Search", LIMITS.search) }))
      .query(({ ctx, input }) => queries.searchUserDocuments(ctx.user.id, input.query)),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => assertDocumentAccess(ctx.user.id, input.id)),
    toggleFavorite: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const doc = await assertDocumentAccess(ctx.user.id, input.id);
        if (doc.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Can only favorite your own documents." });
        }
        return queries.toggleDocumentFavorite(input.id);
      }),
    create: protectedProcedure
      .input(z.object({
        title: zText("Title", LIMITS.title),
        description: zOptionalText("Description", LIMITS.description).optional(),
        fileName: zText("File name", { max: 300 }),
        fileSize: z.number().int().positive("The file is empty."),
        fileUrl: zText("File URL", { max: 2048 }),
        fileKey: zText("File key", { max: 500 }),
        mimeType: z.string().trim().max(200).optional(),
        extractedText: z.string().max(2_000_000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getSystemSettings } = await import("./settings");
        const cfg = await getSystemSettings();
        if (input.fileSize > cfg.content.maxUploadMb * 1024 * 1024) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `File exceeds the ${cfg.content.maxUploadMb} MB upload limit.`,
          });
        }
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
        if (doc.extractedText?.trim() && cfg.content.autoIndex) {
          // Background indexing — non-blocking, upload returns immediately
          llmUtils.indexDocumentForRag(doc.id, doc.extractedText)
            .catch(e => console.error("[RAG] Background indexing failed:", e));
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

    /**
     * Student-safe upload endpoint for the mobile app.
     * Flow:
     *   1. Mobile POSTs the raw file to   /api/storage/put?key=uploads/<uuid>.<ext>
     *      and gets back { url, key }.
     *   2. Mobile calls documents.createOwn with those values to register the doc.
     *
     * Text extraction + RAG indexing run in the background so the call returns
     * immediately (identical behaviour to the lecturer upload).
     */
    createOwn: protectedProcedure
      .input(
        z.object({
          title: zText("Title", LIMITS.title),
          fileName: zText("File name", { max: 300 }),
          fileSize: z.number().int().positive("The file is empty."),
          fileUrl: zText("File URL", { max: 2048 }),
          fileKey: zText("File key", { max: 500 }),
          mimeType: z.string().trim().max(200).optional(),
          description: zOptionalText("Description", LIMITS.description).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { getSystemSettings } = await import("./settings");
        const cfg = await getSystemSettings();
        if (input.fileSize > cfg.content.maxUploadMb * 1024 * 1024) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `File exceeds the ${cfg.content.maxUploadMb} MB upload limit.`,
          });
        }
        const doc = await queries.createDocument({
          userId: ctx.user.id,
          title: input.title,
          fileName: input.fileName,
          fileSize: input.fileSize,
          fileUrl: input.fileUrl,
          fileKey: input.fileKey,
          mimeType: input.mimeType ?? "application/pdf",
          description: input.description,
          isPublic: false,
          isFavorite: false,
        });

        // Initialise a progress row so stats queries never return null
        await queries.getOrCreateProgress(doc.id, ctx.user.id);

        // Extract text + build RAG index in the background — non-blocking
        llmUtils.extractDocumentText(doc.fileUrl)
          .then(async (text) => {
            if (!text?.trim()) return;
            await queries.updateDocument(doc.id, { extractedText: text });
            if (cfg.content.autoIndex) {
              await llmUtils.indexDocumentForRag(doc.id, text);
            }
          })
          .catch((e) => console.error("[Upload] Background extraction failed:", e));

        return doc;
      }),
  }),

  chat: router({
    history: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertDocumentAccess(ctx.user.id, input.documentId);
        const messages = await queries.getDocumentChatHistory(input.documentId, ctx.user.id);
        return messages;
      }),
    send: protectedProcedure
      .input(z.object({
        documentId: z.number(),
        message: zText("Message", { max: LIMITS.chatMessage }),
        courseId: z.number().int().positive().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const flags = await getFeatureFlags();
        if (!flags.aiChat) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "AI Chat is currently disabled by an administrator.",
          });
        }
        try {
          const { assertAiRateLimit } = await import("./ai");
          assertAiRateLimit(ctx.user.id);
        } catch (rateErr) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: rateErr instanceof Error ? rateErr.message : "Too many AI requests.",
          });
        }
        // documentId === 0 → general Ask AI (no document context, no RAG)
        const isGeneral = input.documentId === 0;

        let doc: Awaited<ReturnType<typeof assertDocumentAccess>> | null = null;
        if (!isGeneral) {
          doc = await assertDocumentAccess(ctx.user.id, input.documentId);
        }

        // Only persist chat history for real documents
        if (!isGeneral) {
          await queries.createChatMessage({
            documentId: input.documentId,
            userId: ctx.user.id,
            role: "user",
            content: input.message,
          });
        }

        let aiResponse: string;
        const slash = isGeneral ? null : documentAi.parseSlashCommand(input.message);

        try {
          if (isGeneral) {
            let scopedCourseId = input.courseId;
            if (scopedCourseId && ctx.user.role === "user") {
              const enrolled = await lecturerQueries.isStudentEnrolled(ctx.user.id, scopedCourseId);
              if (!enrolled) scopedCourseId = undefined;
            }
            await queries.createGeneralChatMessage({
              userId: ctx.user.id,
              role: "user",
              content: input.message,
              courseId: scopedCourseId ?? null,
            });
            const history = await queries.getGeneralChatHistory(ctx.user.id, 12);
            const agent = await runLearningAgent({
              user: ctx.user,
              message: input.message,
              history: chronologicalAgentHistory(history),
              courseId: scopedCourseId,
            });
            aiResponse = agent.response;
            await queries.createGeneralChatMessage({
              userId: ctx.user.id,
              role: "assistant",
              content: aiResponse,
            });
            const { recordStudentActivity } = await import("./studentActivity");
            await recordStudentActivity({
              userId: ctx.user.id,
              type: "AI_QUESTION_ASKED",
              courseId: scopedCourseId,
            });
          } else if (slash?.type === "summary") {
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
            const history = await queries.getDocumentChatHistory(input.documentId, ctx.user.id);
            const agent = await runLearningAgent({
              user: ctx.user,
              message: input.message,
              documentId: input.documentId,
              courseId: doc?.courseId,
              documentTitle: doc?.title,
              documentText: doc?.extractedText,
              history: chronologicalAgentHistory(history),
            });
            aiResponse = agent.response;
            const { recordStudentActivity } = await import("./studentActivity");
            await recordStudentActivity({
              userId: ctx.user.id,
              type: "AI_QUESTION_ASKED",
              courseId: doc?.courseId,
              documentId: input.documentId,
            });
          }
        } catch (err) {
          if (err instanceof TRPCError) {
            aiResponse = err.message;
          } else {
            console.error(err);
            aiResponse =
              "The AI service is temporarily unavailable. Please try again.";
          }
        }

        // Persist AI reply for real document chats only
        if (!isGeneral) {
          await queries.createChatMessage({
            documentId: input.documentId,
            userId: ctx.user.id,
            role: "assistant",
            content: aiResponse,
          });
        }

        return { userMessage: input.message, aiResponse };
      }),
  }),

  summary: router({
    get: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertDocumentAccess(ctx.user.id, input.documentId);
        // React Query rejects `undefined` as query data; "no summary yet" must be null.
        return (await queries.getDocumentSummary(input.documentId)) ?? null;
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
        await assertDocumentAccess(ctx.user.id, input.documentId);
        return documentAi.generateSummaryForDocument(input.documentId, input.topic);
      }),
  }),

  flashcards: router({
    list: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertDocumentAccess(ctx.user.id, input.documentId);
        return queries.getDocumentFlashcards(input.documentId, ctx.user.id);
      }),
    generate: protectedProcedure
      .input(
        z.object({
          documentId: z.number(),
          count: z.number().min(3).max(30).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await assertDocumentAccess(ctx.user.id, input.documentId);
        return documentAi.generateFlashcardsForDocument(
          input.documentId,
          ctx.user.id,
          input.count ?? 10
        );
      }),
    toggleFavorite: protectedProcedure
      .input(z.object({ flashcardId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await queries.getFlashcardById(input.flashcardId);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        if (existing.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only favourite your own flashcards." });
        }
        const card = await queries.toggleFlashcardFavorite(input.flashcardId);
        if (!card) throw new TRPCError({ code: "NOT_FOUND" });
        return card;
      }),
    markReviewed: studentProcedure
      .input(z.object({ flashcardId: z.number(), studyTimeMinutes: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await queries.getFlashcardById(input.flashcardId);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        const doc = await queries.getDocumentById(existing.documentId);
        if (!doc || !(await canAccessDocument(ctx.user.id, doc))) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        // Shared lecturer cards: log study time only — do not mutate another user's SM-2 state.
        const card =
          existing.userId === ctx.user.id
            ? await queries.updateFlashcardReview(input.flashcardId)
            : existing;
        if (!card) throw new TRPCError({ code: "NOT_FOUND" });
        const progress = await queries.getOrCreateProgress(card.documentId, ctx.user.id);
        await queries.logStudyActivity({
          userId: ctx.user.id,
          documentId: card.documentId,
          activityType: "flashcard",
          durationMinutes: input.studyTimeMinutes,
          progressUpdates: {
            flashcardsReviewed: (progress.flashcardsReviewed || 0) + 1,
          },
        });
        return card;
      }),

    /**
     * SM-2 rating for a single flashcard.
     * rating: 0=Again  1=Hard  2=Good  3=Easy
     * Returns the updated card with new dueDate / easeFactor.
     */
    rateCard: studentProcedure
      .input(
        z.object({
          flashcardId: z.number(),
          rating: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
          studyTimeMinutes: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await queries.getFlashcardById(input.flashcardId);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        const doc = await queries.getDocumentById(existing.documentId);
        if (!doc || !(await canAccessDocument(ctx.user.id, doc))) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        let card = existing;
        if (existing.userId === ctx.user.id) {
          const { applySm2 } = await import("./sm2");
          const sm2Result = applySm2(
            {
              easeFactor: existing.easeFactor ?? 2.5,
              srInterval: existing.srInterval ?? 0,
              repetitions: existing.repetitions ?? 0,
              dueDate: existing.dueDate ?? null,
            },
            input.rating
          );
          const updated = await queries.applyFlashcardSm2(input.flashcardId, sm2Result);
          if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
          card = updated;
        }

        const progress = await queries.getOrCreateProgress(card.documentId, ctx.user.id);
        await queries.logStudyActivity({
          userId: ctx.user.id,
          documentId: card.documentId,
          activityType: "flashcard",
          durationMinutes: input.studyTimeMinutes,
          progressUpdates: {
            flashcardsReviewed: (progress.flashcardsReviewed || 0) + 1,
          },
        });

        return card;
      }),

    /**
     * Return cards that are due for review right now.
     * When documentId is omitted, returns due cards across ALL the user's documents.
     */
    due: studentProcedure
      .input(z.object({ documentId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        if (input.documentId !== undefined) {
          await assertDocumentAccess(ctx.user.id, input.documentId);
        }
        return queries.getDueFlashcards(ctx.user.id, input.documentId);
      }),

    /**
     * Per-document due count — feeds the stats banner on the Flashcards tab.
     */
    dueCounts: studentProcedure.query(async ({ ctx }) =>
      queries.getDueCountPerDocument(ctx.user.id)
    ),
  }),

  quizzes: router({
    list: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertDocumentAccess(ctx.user.id, input.documentId);
        return queries.getDocumentQuizzes(input.documentId, ctx.user.id);
      }),
    generate: protectedProcedure
      .input(
        z.object({
          documentId: z.number(),
          questionCount: z.number().min(3).max(20).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await assertDocumentAccess(ctx.user.id, input.documentId);
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
        await assertDocumentAccess(ctx.user.id, quiz.documentId);
        const questions = await queries.getQuizQuestions(input.quizId);
        return { ...quiz, questions };
      }),
    submitQuiz: studentProcedure
      .input(z.object({
        quizId: z.number(),
        score: z.number(),
        studyTimeMinutes: z.number().optional(),
        /**
         * Per-question answers: { [questionId]: selectedOptionText }
         * Optional for backward-compat — older clients may not send this.
         */
        answers: z.record(z.string().max(40), z.string().max(2000)).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const existingQuiz = await queries.getQuizById(input.quizId);
        if (!existingQuiz) throw new TRPCError({ code: "NOT_FOUND" });
        await assertDocumentAccess(ctx.user.id, existingQuiz.documentId);

        // Only the quiz owner may write score/answers onto the shared quiz row.
        // Lecturer quizzes stay clean; each student's attempt is tracked via progress.
        let quiz = existingQuiz;
        if (existingQuiz.userId === ctx.user.id) {
          const updated = await queries.updateQuizScore(input.quizId, input.score, new Date());
          if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
          quiz = updated;

          if (input.answers && Object.keys(input.answers).length > 0) {
            const questions = await queries.getQuizQuestions(input.quizId);
            await Promise.all(
              questions.map((q) => {
                const userAnswer = input.answers![String(q.id)];
                if (userAnswer === undefined) return Promise.resolve();
                const isCorrect = userAnswer === q.correctAnswer;
                return queries.updateQuizQuestionAnswer(q.id, userAnswer, isCorrect);
              })
            );
          }
        }

        const progress = await queries.getOrCreateProgress(quiz.documentId, ctx.user.id);
        const newAttempts = (progress.quizzesAttempted || 0) + 1;
        const currentAvg = parseFloat(progress.averageQuizScore?.toString() || "0");
        const newAvg = (currentAvg * (newAttempts - 1) + input.score) / newAttempts;

        await queries.logStudyActivity({
          userId: ctx.user.id,
          documentId: quiz.documentId,
          activityType: "quiz",
          durationMinutes: input.studyTimeMinutes ?? 2,
          progressUpdates: {
            quizzesAttempted: newAttempts,
            averageQuizScore: newAvg,
          },
        });

        const doc = await queries.getDocumentById(quiz.documentId);
        const { recordStudentActivity } = await import("./studentActivity");
        await recordStudentActivity({
          userId: ctx.user.id,
          type: "QUIZ_COMPLETED",
          courseId: doc?.courseId,
          documentId: quiz.documentId,
          metadata: { quizId: quiz.id, score: input.score },
        });

        return quiz;
      }),
  }),

  progress: router({
    get: studentProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertDocumentAccess(ctx.user.id, input.documentId);
        return queries.getOrCreateProgress(input.documentId, ctx.user.id);
      }),
    // Include the document title so every client can identify course materials as
    // well as personal uploads in its progress breakdown.
    stats: studentProcedure.query(({ ctx }) => queries.getUserProgressWithTitles(ctx.user.id)),
    analytics: studentProcedure.query(async ({ ctx }) => {
      const [subjectPerformance, weeklyData, monthlyData, currentStreak, totalStudyTime, recommendedRevision, dailyData] = await Promise.all([
        queries.getSubjectPerformance(ctx.user.id),
        queries.getWeeklyStudyData(ctx.user.id),
        queries.getMonthlyStudyData(ctx.user.id),
        queries.getCurrentStudyStreak(ctx.user.id),
        queries.getTotalStudyTime(ctx.user.id),
        queries.getRecommendedRevision(ctx.user.id),
        queries.getDailyStudyData(ctx.user.id),
      ]);

      return {
        subjectPerformance,
        weeklyData,
        monthlyData,
        currentStreak,
        totalStudyTime,
        recommendedRevision,
        dailyData,
      };
    }),
  }),

  planner: router({
    today: studentProcedure.query(async ({ ctx }) => {
      const dbConn = await db.getDb(); if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await calendar.dispatchDueCalendarReminders(ctx.user.id);
      const now = new Date(); const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
      const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
      let [goal] = await dbConn.select().from(learningGoals).where(eq(learningGoals.userId, ctx.user.id)).limit(1);
      if (!goal) { [goal] = await dbConn.insert(learningGoals).values({ userId: ctx.user.id }).returning(); }
      const enrolled = await dbConn.select({ courseId: courseEnrollments.courseId }).from(courseEnrollments).where(eq(courseEnrollments.studentId, ctx.user.id));
      const courseIds = enrolled.map(row => row.courseId);
      const [todaySessionRows, dueCardRows, todayQuizRows, pendingAssignments, dueQuizzes] = await Promise.all([
        dbConn.select({ minutes: sql<number>`coalesce(sum(${studySessions.durationMinutes}), 0)` }).from(studySessions).where(and(eq(studySessions.userId, ctx.user.id), gte(studySessions.startTime, startOfToday))),
        dbConn.select({ count: sql<number>`cast(count(*) as integer)` }).from(flashcards).where(and(eq(flashcards.userId, ctx.user.id), sql`(${flashcards.dueDate} is null or ${flashcards.dueDate} <= ${now})`)),
        dbConn.select({ count: sql<number>`cast(count(*) as integer)` }).from(studySessions).where(and(eq(studySessions.userId, ctx.user.id), eq(studySessions.activityType, "quiz"), gte(studySessions.startTime, startOfToday))),
        courseIds.length ? dbConn.select({ id: assignments.id, title: assignments.title, courseId: assignments.courseId, dueDate: assignments.dueDate, courseTitle: courses.title }).from(assignments).innerJoin(courses, eq(assignments.courseId, courses.id)).where(and(inArray(assignments.courseId, courseIds), sql`not exists (select 1 from assignmentSubmissions where assignmentSubmissions.assignmentId = ${assignments.id} and assignmentSubmissions.studentId = ${ctx.user.id})`)).orderBy(assignments.dueDate).limit(8) : [],
        courseIds.length ? dbConn.select({ id: quizzes.id, title: quizzes.title, dueDate: quizzes.dueDate, courseId: documents.courseId }).from(quizzes).innerJoin(documents, eq(quizzes.documentId, documents.id)).where(and(inArray(documents.courseId, courseIds), sql`${quizzes.dueDate} is not null and ${quizzes.dueDate} >= ${now}`)).orderBy(quizzes.dueDate).limit(5) : [],
      ]);
      const todaySessions = todaySessionRows[0] ?? { minutes: 0 };
      const dueCards = dueCardRows[0] ?? { count: 0 };
      const todayQuizzes = todayQuizRows[0] ?? { count: 0 };
      const tasks = [
        ...(dueCards.count ? [{ id: "flashcards", type: "flashcards" as const, title: `Review ${Math.min(dueCards.count, goal.dailyFlashcards)} flashcards`, detail: `${dueCards.count} cards are due for review`, href: "/(tabs)/flashcards" }] : []),
        ...pendingAssignments.map(item => ({ id: `assignment-${item.id}`, type: "assignment" as const, title: item.title, detail: `${item.courseTitle}${item.dueDate ? ` · Due ${new Date(item.dueDate).toLocaleDateString()}` : " · No deadline"}`, href: `/course/${item.courseId}` })),
        ...dueQuizzes.map(item => ({ id: `quiz-${item.id}`, type: "quiz" as const, title: item.title, detail: `Quiz deadline ${new Date(item.dueDate!).toLocaleDateString()}`, href: `/course/${item.courseId}` })),
      ];
      return { goal, completedMinutes: todaySessions.minutes, completedQuizzes: todayQuizzes.count, dueFlashcards: dueCards.count, tasks, generatedAt: now };
    }),
    calendar: studentProcedure
      .input(z.object({
        from: z.number().int(),
        to: z.number().int(),
      }))
      .query(async ({ ctx, input }) => {
        if (input.to < input.from) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid date range." });
        await calendar.dispatchDueCalendarReminders(ctx.user.id);
        const events = await calendar.listCalendarEvents(ctx.user.id, input.from, input.to);
        return { events };
      }),
    createEvent: studentProcedure
      .input(z.object({
        title: zText("Title", { min: 2, max: 160 }),
        type: z.enum(["exam", "test", "quiz", "study", "other"]),
        startsAt: z.number().int().refine(value => value > Date.now() - 24 * 60 * 60 * 1000, "Choose a date and time that is not in the past."),
        notes: zOptionalText("Notes", 500).optional(),
        reminderMinutes: z.number().int().min(5).max(10080).optional(),
        courseId: z.number().int().positive().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const created = await calendar.insertCalendarEvents(ctx.user.id, [{
          title: input.title,
          type: input.type,
          startsAt: new Date(input.startsAt).toISOString(),
          notes: input.notes,
          reminderMinutes: input.reminderMinutes,
          courseId: input.courseId,
        }], "user");
        if (!created[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "Could not save that event." });
        return created[0];
      }),
    deleteEvent: studentProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const ok = await calendar.deleteCalendarEvent(ctx.user.id, input.id);
        if (!ok) throw new TRPCError({ code: "NOT_FOUND" });
        return { success: true };
      }),
    generatePlan: studentProcedure
      .input(z.object({ message: zText("Plan request", { min: 8, max: 500 }) }))
      .mutation(async ({ ctx, input }) => {
        const drafts = await calendar.proposeCalendarDrafts(input.message);
        const events = await calendar.insertCalendarEvents(ctx.user.id, drafts, "agent");
        return {
          created: events.length,
          events,
          reply: calendar.formatStudyPlanReply(events),
        };
      }),
    /** Read the sessions out of an AI chat reply for the student to review; nothing is saved yet. */
    draftFromText: studentProcedure
      .input(z.object({
        text: z.string().trim().min(PLAN_LIMITS.text.min, "This reply is too short to contain a plan.").max(PLAN_LIMITS.text.max),
        timezoneOffset: z.number().int().min(-840).max(840),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const { assertAiRateLimit } = await import("./ai");
          assertAiRateLimit(ctx.user.id);
        } catch (error) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: error instanceof Error ? error.message : "Too many AI requests." });
        }
        let sessions: Awaited<ReturnType<typeof calendar.extractPlanFromText>>;
        try {
          sessions = await calendar.extractPlanFromText(input.text, input.timezoneOffset);
        } catch (error) {
          console.warn("[planner] Could not read plan from reply:", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The AI couldn't read this plan right now. Please try again." });
        }
        if (!sessions.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "I couldn't find any upcoming study sessions in this reply." });
        }
        return { sessions };
      }),
    /** Save the sessions the student confirmed from a chat reply. */
    savePlan: studentProcedure
      .input(z.object({
        sessions: z.array(z.object({
          title: zText("Session title", PLAN_LIMITS.title),
          type: z.enum(PLAN_SESSION_TYPES),
          startsAt: z.number().int().refine(value => value > Date.now() - 5 * 60 * 1000, "One of the sessions is in the past."),
          durationMinutes: z.number().int().min(PLAN_LIMITS.duration.min).max(PLAN_LIMITS.duration.max),
          notes: zOptionalText("Notes", PLAN_LIMITS.notes).optional(),
        })).min(1, "Choose at least one session.").max(PLAN_LIMITS.sessions),
      }))
      .mutation(async ({ ctx, input }) => {
        const events = await calendar.insertCalendarEvents(
          ctx.user.id,
          input.sessions.map(s => ({
            title: s.title,
            type: s.type,
            startsAt: new Date(s.startsAt).toISOString(),
            endsAt: new Date(s.startsAt + s.durationMinutes * 60_000).toISOString(),
            notes: s.notes || undefined,
          })),
          "agent"
        );
        return { created: events.length, events };
      }),
    updateGoal: studentProcedure.input(z.object({ dailyStudyMinutes: z.number().int().min(5).max(480), dailyFlashcards: z.number().int().min(1).max(100), dailyQuizzes: z.number().int().min(1).max(20) })).mutation(async ({ ctx, input }) => {
      const dbConn = await db.getDb(); if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [existing] = await dbConn.select().from(learningGoals).where(eq(learningGoals.userId, ctx.user.id)).limit(1);
      if (existing) await dbConn.update(learningGoals).set({ ...input, updatedAt: new Date() }).where(eq(learningGoals.userId, ctx.user.id));
      else await dbConn.insert(learningGoals).values({ userId: ctx.user.id, ...input });
      return { success: true };
    }),
  }),

  studySessions: router({
    start: studentProcedure
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
    end: studentProcedure
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
    getRecent: studentProcedure.query(({ ctx }) => queries.getUserStudySessions(ctx.user.id)),
  }),

  admin: router({
    settings: settingsRouter,
    autonomousAgent: autonomousAgentRouter,

    /** Accounts are provisioned by administrators only; there is no public sign-up. */
    createUser: adminProcedure
      .input(
        z.object({
          name: zPersonName("Full name"),
          email: zEmail,
          password: zNewPassword,
          role: z.enum(["user", "lecturer"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { userHasPermission } = await import("./settings");
        if (!(await userHasPermission(ctx.user, "users.create"))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to create users." });
        }
        const minLen = await getPasswordMinLength();
        if (input.password.length < minLen) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Password must be at least ${minLen} characters.`,
          });
        }
        const email = normalizeEmail(input.email);
        if (!isAllowedEmail(email)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: EMAIL_DOMAIN_ERROR });
        }
        const existing = await db.getUserByEmail(email);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "An account with this email already exists.",
          });
        }
        const user = await db.createUser({
          openId: localOpenIdForEmail(email),
          name: input.name.trim(),
          email,
          loginMethod: "local",
          passwordHash: await hashPassword(input.password),
          role: input.role,
        });
        if (!user) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create account.",
          });
        }
        if (input.role === "user") {
          const { beginStudentOnboarding } = await import("./studentLearningRouter");
          await beginStudentOnboarding(user.id);
        }
        await writeAdminAudit(ctx.user.id, "user.created", "user", user.id, undefined, { role: input.role, email });
        return stripSensitiveUser(user);
      }),

    /** Lightweight dashboard data; list pages use their own paginated endpoints. */
    getDashboardMetrics: adminProcedure
      .input(z.object({ days: z.number().int().min(7).max(90).default(30) }).optional())
      .query(async ({ input }) => {
        const dbConn = await db.getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
        const days = input?.days ?? 30;
        const since = new Date(Date.now() - days * 86_400_000);
        const [[usersTotal], [documentsTotal], [active], [quizStats], [failed], [queued], [storage], growth, recentEvents] = await Promise.all([
          dbConn.select({ value: sql<number>`cast(count(*) as integer)` }).from(users),
          dbConn.select({ value: sql<number>`cast(count(*) as integer)` }).from(documents),
          dbConn.select({ value: sql<number>`cast(count(distinct ${studySessions.userId}) as integer)` }).from(studySessions).where(gte(studySessions.createdAt, since)),
          dbConn.select({ completed: sql<number>`cast(sum(case when ${quizzes.completedAt} is not null then 1 else 0 end) as integer)`, total: sql<number>`cast(count(*) as integer)`, averageScore: sql<number>`coalesce(avg(cast(${quizzes.score} as real)), 0)` }).from(quizzes),
          dbConn.select({ value: sql<number>`cast(count(*) as integer)` }).from(documents).where(eq(documents.processingStatus, "failed")),
          dbConn.select({ value: sql<number>`cast(count(*) as integer)` }).from(documents).where(or(eq(documents.processingStatus, "pending"), eq(documents.processingStatus, "processing"))),
          dbConn.select({ bytes: sql<number>`coalesce(sum(${documents.fileSize}), 0)` }).from(documents),
          dbConn.select({ date: sql<string>`strftime('%Y-%m-%d', ${users.createdAt} / 1000, 'unixepoch')`, signUps: sql<number>`cast(count(*) as integer)` }).from(users).where(gte(users.createdAt, since)).groupBy(sql`strftime('%Y-%m-%d', ${users.createdAt} / 1000, 'unixepoch')`).orderBy(sql`strftime('%Y-%m-%d', ${users.createdAt} / 1000, 'unixepoch')`),
          dbConn.select().from(systemEvents).orderBy(desc(systemEvents.createdAt)).limit(8),
        ]);
        const uploads = await dbConn.select({ date: sql<string>`strftime('%Y-%m-%d', ${documents.createdAt} / 1000, 'unixepoch')`, uploads: sql<number>`cast(count(*) as integer)` }).from(documents).where(gte(documents.createdAt, since)).groupBy(sql`strftime('%Y-%m-%d', ${documents.createdAt} / 1000, 'unixepoch')`).orderBy(sql`strftime('%Y-%m-%d', ${documents.createdAt} / 1000, 'unixepoch')`);
        const activeByDate = await dbConn.select({ date: sql<string>`strftime('%Y-%m-%d', ${studySessions.createdAt} / 1000, 'unixepoch')`, activeLearners: sql<number>`cast(count(distinct ${studySessions.userId}) as integer)` }).from(studySessions).where(gte(studySessions.createdAt, since)).groupBy(sql`strftime('%Y-%m-%d', ${studySessions.createdAt} / 1000, 'unixepoch')`).orderBy(sql`strftime('%Y-%m-%d', ${studySessions.createdAt} / 1000, 'unixepoch')`);
        const keys = new Set([...growth.map(x => x.date), ...uploads.map(x => x.date), ...activeByDate.map(x => x.date)]);
        const series = [...keys].sort().map(date => ({ date, signUps: growth.find(x => x.date === date)?.signUps ?? 0, uploads: uploads.find(x => x.date === date)?.uploads ?? 0, activeLearners: activeByDate.find(x => x.date === date)?.activeLearners ?? 0 }));
        return { usersTotal: usersTotal.value, documentsTotal: documentsTotal.value, activeLearners: active.value, quizCompletionRate: quizStats.total ? Math.round((quizStats.completed / quizStats.total) * 100) : 0, averageQuizScore: Math.round(quizStats.averageScore), failedJobs: failed.value, queuedJobs: queued.value, storageBytes: storage.bytes, series, recentEvents: recentEvents.map(event => ({ userName: event.category.toUpperCase(), action: "reported", target: event.message, createdAt: event.createdAt })) };
      }),

    listUsers: adminProcedure
      .input(z.object({ page: z.number().int().min(1).default(1), pageSize: z.number().int().min(1).max(100).default(20), search: z.string().max(100).default(""), role: z.enum(["user", "lecturer", "admin"]).optional(), status: z.enum(["active", "banned"]).optional() }))
      .query(async ({ ctx, input }) => {
        const { userHasPermission } = await import("./settings");
        if (!(await userHasPermission(ctx.user, "users.view"))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to view users." });
        }
        const dbConn = await db.getDb(); if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const conditions = [] as any[];
        if (input.search) conditions.push(or(like(users.name, `%${input.search}%`), like(users.email, `%${input.search}%`)));
        if (input.role) conditions.push(eq(users.role, input.role));
        if (input.status) conditions.push(eq(users.isBanned, input.status === "banned"));
        const where = conditions.length ? and(...conditions) : undefined;
        const [items, [{ total }]] = await Promise.all([
          dbConn.select({ id: users.id, name: users.name, email: users.email, role: users.role, isBanned: users.isBanned, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn, quizzesAttempted: sql<number>`coalesce(sum(${progressTracking.quizzesAttempted}), 0)`, averageQuizScore: sql<number>`coalesce(avg(${progressTracking.averageQuizScore}), 0)` }).from(users).leftJoin(progressTracking, eq(users.id, progressTracking.userId)).where(where).groupBy(users.id).orderBy(desc(users.createdAt)).limit(input.pageSize).offset((input.page - 1) * input.pageSize),
          dbConn.select({ total: sql<number>`cast(count(*) as integer)` }).from(users).where(where),
        ]);
        return { items, total, page: input.page, pageSize: input.pageSize };
      }),

    listDocuments: adminProcedure
      .input(z.object({ page: z.number().int().min(1).default(1), pageSize: z.number().int().min(1).max(100).default(20), search: z.string().max(100).default(""), ownerId: z.number().optional(), status: z.enum(["pending", "processing", "ready", "failed"]).optional() }))
      .query(async ({ input }) => {
        const dbConn = await db.getDb(); if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const conditions = [] as any[];
        if (input.search) conditions.push(or(like(documents.title, `%${input.search}%`), like(users.name, `%${input.search}%`)));
        if (input.ownerId) conditions.push(eq(documents.userId, input.ownerId));
        if (input.status) conditions.push(eq(documents.processingStatus, input.status));
        const where = conditions.length ? and(...conditions) : undefined;
        const [items, [{ total }]] = await Promise.all([
          dbConn.select({ id: documents.id, title: documents.title, fileName: documents.fileName, fileUrl: documents.fileUrl, fileSize: documents.fileSize, mimeType: documents.mimeType, isPublic: documents.isPublic, processingStatus: documents.processingStatus, processingError: documents.processingError, reportCount: documents.reportCount, createdAt: documents.createdAt, ownerId: users.id, ownerName: users.name, ownerEmail: users.email }).from(documents).leftJoin(users, eq(documents.userId, users.id)).where(where).orderBy(desc(documents.createdAt)).limit(input.pageSize).offset((input.page - 1) * input.pageSize),
          dbConn.select({ total: sql<number>`cast(count(*) as integer)` }).from(documents).leftJoin(users, eq(documents.userId, users.id)).where(where),
        ]);
        return { items, total, page: input.page, pageSize: input.pageSize };
      }),

    /** Course outcomes, risk signals, and lecturer workload for academic oversight. */
    getAcademicPerformance: adminProcedure.query(async () => {
      const dbConn = await db.getDb(); if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const inactiveBefore = new Date(Date.now() - 14 * 86_400_000);
      const [courseRows, atRisk, topicWeaknesses] = await Promise.all([
        dbConn.select({ courseId: courses.id, title: courses.title, code: courses.code, lecturerId: courses.lecturerId, lecturerName: users.name, enrolled: sql<number>`cast(count(distinct ${courseEnrollments.studentId}) as integer)`, averageScore: sql<number>`coalesce(avg(${progressTracking.averageQuizScore}), 0)` }).from(courses).leftJoin(users, eq(courses.lecturerId, users.id)).leftJoin(courseEnrollments, eq(courses.id, courseEnrollments.courseId)).leftJoin(progressTracking, eq(courseEnrollments.studentId, progressTracking.userId)).groupBy(courses.id).orderBy(desc(sql`count(distinct ${courseEnrollments.studentId})`)),
        dbConn.select({ id: users.id, name: users.name, email: users.email, lastActivity: sql<Date>`max(${progressTracking.lastActivityAt})`, averageScore: sql<number>`coalesce(avg(${progressTracking.averageQuizScore}), 0)`, overdue: sql<number>`cast(sum(case when ${assignmentSubmissions.status} = 'late' then 1 else 0 end) as integer)` }).from(users).leftJoin(progressTracking, eq(users.id, progressTracking.userId)).leftJoin(assignmentSubmissions, eq(users.id, assignmentSubmissions.studentId)).where(eq(users.role, "user")).groupBy(users.id).having(sql`max(${progressTracking.lastActivityAt}) is null or max(${progressTracking.lastActivityAt}) < ${inactiveBefore} or avg(${progressTracking.averageQuizScore}) < 50 or sum(case when ${assignmentSubmissions.status} = 'late' then 1 else 0 end) > 0`).limit(50),
        dbConn.select({ topic: documents.subject, attempted: sql<number>`cast(count(${quizzes.id}) as integer)`, averageScore: sql<number>`coalesce(avg(cast(${quizzes.score} as real)), 0)` }).from(quizzes).leftJoin(documents, eq(quizzes.documentId, documents.id)).where(sql`${quizzes.completedAt} is not null`).groupBy(documents.subject).orderBy(sql`avg(cast(${quizzes.score} as real)) asc`).limit(10),
      ]);
      return { courses: courseRows, atRisk, topicWeaknesses };
    }),

    globalSearch: adminProcedure.input(z.object({ query: z.string().min(2).max(100) })).query(async ({ input }) => {
      const dbConn = await db.getDb(); if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const term = `%${input.query}%`;
      const [foundUsers, foundDocuments, foundCourses, foundAudit] = await Promise.all([
        dbConn.select({ id: users.id, label: users.name, detail: users.email }).from(users).where(or(like(users.name, term), like(users.email, term))).limit(8),
        dbConn.select({ id: documents.id, label: documents.title, detail: documents.fileName }).from(documents).where(like(documents.title, term)).limit(8),
        dbConn.select({ id: courses.id, label: courses.title, detail: courses.code }).from(courses).where(or(like(courses.title, term), like(courses.code, term))).limit(8),
        dbConn.select({ id: adminAuditLogs.id, label: adminAuditLogs.action, detail: adminAuditLogs.reason }).from(adminAuditLogs).where(or(like(adminAuditLogs.action, term), like(adminAuditLogs.reason, term))).limit(8),
      ]);
      return { users: foundUsers, documents: foundDocuments, courses: foundCourses, audit: foundAudit };
    }),

    getOperationsOverview: adminProcedure.query(async () => {
      const dbConn = await db.getDb(); if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [[pending], [ready], [failed], [storage], recentErrors] = await Promise.all([
        dbConn.select({ count: sql<number>`cast(count(*) as integer)` }).from(documents).where(or(eq(documents.processingStatus, "pending"), eq(documents.processingStatus, "processing"))),
        dbConn.select({ count: sql<number>`cast(count(*) as integer)` }).from(documents).where(eq(documents.processingStatus, "ready")),
        dbConn.select({ count: sql<number>`cast(count(*) as integer)` }).from(documents).where(eq(documents.processingStatus, "failed")),
        dbConn.select({ bytes: sql<number>`coalesce(sum(${documents.fileSize}), 0)` }).from(documents),
        dbConn.select().from(systemEvents).where(eq(systemEvents.severity, "error")).orderBy(desc(systemEvents.createdAt)).limit(20),
      ]);
      return { jobs: { pending: pending.count, ready: ready.count, failed: failed.count }, storageBytes: storage.bytes, recentErrors };
    }),

    listAuditLogs: adminProcedure.input(z.object({
      search: z.string().max(100).default(""),
      action: z.string().max(100).optional(),
      adminId: z.number().int().positive().optional(),
      from: z.date().optional(),
      to: z.date().optional(),
      limit: z.number().int().min(1).max(200).default(100),
    })).query(async ({ input }) => {
      const dbConn = await db.getDb(); if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const where = [] as any[];
      if (input.action) where.push(eq(adminAuditLogs.action, input.action));
      if (input.adminId) where.push(eq(adminAuditLogs.adminId, input.adminId));
      if (input.from) where.push(gte(adminAuditLogs.createdAt, input.from));
      if (input.to) where.push(sql`${adminAuditLogs.createdAt} <= ${input.to}`);
      if (input.search) {
        where.push(or(
          like(adminAuditLogs.action, `%${input.search}%`),
          like(adminAuditLogs.reason, `%${input.search}%`),
          like(adminAuditLogs.targetType, `%${input.search}%`),
          like(users.name, `%${input.search}%`),
        ));
      }
      return dbConn
        .select({
          id: adminAuditLogs.id,
          action: adminAuditLogs.action,
          targetType: adminAuditLogs.targetType,
          targetId: adminAuditLogs.targetId,
          reason: adminAuditLogs.reason,
          metadata: adminAuditLogs.metadata,
          createdAt: adminAuditLogs.createdAt,
          adminId: adminAuditLogs.adminId,
          adminName: users.name,
        })
        .from(adminAuditLogs)
        .leftJoin(users, eq(adminAuditLogs.adminId, users.id))
        .where(where.length ? and(...where) : undefined)
        .orderBy(desc(adminAuditLogs.createdAt))
        .limit(input.limit);
    }),

    createCourse: adminProcedure
      .input(
        z.object({
          title: zText("Course title", LIMITS.title),
          subject: zOptionalText("Subject", 100).optional(),
          description: zOptionalText("Description", LIMITS.description).optional(),
          lecturerId: z.number().int().positive(),
          reason: zReason,
        })
      )
      .mutation(async ({ ctx, input }) => {
        const lecturer = await db.getUserById(input.lecturerId);
        if (!lecturer || lecturer.role !== "lecturer" || lecturer.isBanned) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Select an active lecturer account." });
        }
        const course = await lecturerQueries.createCourse(input.lecturerId, {
          title: input.title,
          subject: input.subject,
          description: input.description,
        });
        const dbConn = await db.getDb();
        if (dbConn) {
          await dbConn.insert(notifications).values({
            userId: lecturer.id,
            title: "Course assigned",
            body: `You have been assigned to teach ${course.title} (${course.code}).`,
            data: { type: "course_assigned", courseId: course.id },
          });
        }
        await writeAdminAudit(ctx.user.id, "course.created", "course", course.id, input.reason, {
          lecturerId: lecturer.id,
          code: course.code,
        });
        return course;
      }),

    assignLecturerToCourse: adminProcedure.input(z.object({ courseId: z.number(), lecturerId: z.number(), reason: zReason })).mutation(async ({ ctx, input }) => {
      const lecturer = await db.getUserById(input.lecturerId);
      if (!lecturer || lecturer.role !== "lecturer" || lecturer.isBanned) throw new TRPCError({ code: "BAD_REQUEST", message: "Select an active lecturer account." });
      const dbConn = await db.getDb(); if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [existing] = await dbConn.select({ id: courses.id, title: courses.title, code: courses.code }).from(courses).where(eq(courses.id, input.courseId)).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found." });
      await dbConn.update(courses).set({ lecturerId: input.lecturerId, updatedAt: new Date() }).where(eq(courses.id, input.courseId));
      await dbConn.insert(notifications).values({
        userId: lecturer.id,
        title: "Course assigned",
        body: `You have been assigned to teach ${existing.title} (${existing.code}).`,
        data: { type: "course_assigned", courseId: existing.id },
      });
      await writeAdminAudit(ctx.user.id, "course.lecturer_assigned", "course", input.courseId, input.reason, { lecturerId: input.lecturerId });
      return { success: true };
    }),

    retryDocumentProcessing: adminProcedure.input(z.object({ documentId: z.number(), reason: zReason })).mutation(async ({ ctx, input }) => {
      const doc = await queries.getDocumentById(input.documentId); if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      await queries.updateDocument(doc.id, { processingStatus: "pending", processingError: null });
      await writeAdminAudit(ctx.user.id, "document.processing_retried", "document", doc.id, input.reason);
      (async () => {
        try {
          await queries.updateDocument(doc.id, { processingStatus: "processing" });
          const text = doc.extractedText?.trim() || await llmUtils.extractDocumentText(doc.fileUrl);
          await queries.updateDocument(doc.id, { extractedText: text });
          await llmUtils.indexDocumentForRag(doc.id, text);
          await queries.updateDocument(doc.id, { processingStatus: "ready", processingError: null });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Retry failed";
          await queries.updateDocument(doc.id, { processingStatus: "failed", processingError: message });
          await queries.recordSystemEvent({ category: "indexing", severity: "error", message, documentId: doc.id, userId: doc.userId });
        }
      })();
      return { success: true };
    }),

    sendAnnouncement: adminProcedure.input(z.object({
      audience: z.enum(["all", "inactive", "course", "lecturers"]),
      courseId: z.number().optional(),
      title: zText("Title", { min: 2, max: 160 }),
      body: zText("Message", { min: 5, max: LIMITS.description }),
    })).mutation(async ({ ctx, input }) => {
      const dbConn = await db.getDb(); if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let recipientRows: Array<{ id: number }>;
      if (input.audience === "course") {
        if (!input.courseId) throw new TRPCError({ code: "BAD_REQUEST", message: "A course is required." });
        recipientRows = await dbConn.select({ id: courseEnrollments.studentId }).from(courseEnrollments).where(eq(courseEnrollments.courseId, input.courseId));
      } else if (input.audience === "inactive") {
        const cutoff = new Date(Date.now() - 14 * 86_400_000);
        recipientRows = await dbConn.select({ id: users.id }).from(users).where(and(eq(users.role, "user"), sql`${users.lastSignedIn} < ${cutoff}`));
      } else if (input.audience === "lecturers") {
        recipientRows = await dbConn.select({ id: users.id }).from(users).where(eq(users.role, "lecturer"));
      } else {
        recipientRows = await dbConn.select({ id: users.id }).from(users).where(eq(users.role, "user"));
      }
      if (recipientRows.length) {
        await dbConn.insert(notifications).values(
          recipientRows.map(({ id }) => ({
            userId: id,
            title: input.title,
            body: input.body,
            data: { type: "admin_announcement", audience: input.audience, courseId: input.courseId },
          }))
        );
      }
      await writeAdminAudit(ctx.user.id, "announcement.sent", "announcement", 0, undefined, {
        audience: input.audience,
        recipients: recipientRows.length,
        title: input.title,
      });
      return { recipients: recipientRows.length };
    }),

    getCommunicationStats: adminProcedure.query(async () => {
      const dbConn = await db.getDb(); if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [[sent], [read], recentRows] = await Promise.all([
        dbConn.select({ count: sql<number>`cast(count(*) as integer)` }).from(notifications).where(sql`${notifications.data} like '%admin_announcement%'`),
        dbConn.select({ count: sql<number>`cast(count(*) as integer)` }).from(notifications).where(and(eq(notifications.isRead, true), sql`${notifications.data} like '%admin_announcement%'`)),
        dbConn
          .select({
            id: notifications.id,
            title: notifications.title,
            body: notifications.body,
            isRead: notifications.isRead,
            createdAt: notifications.createdAt,
            data: notifications.data,
          })
          .from(notifications)
          .where(sql`${notifications.data} like '%admin_announcement%'`)
          .orderBy(desc(notifications.createdAt))
          .limit(80),
      ]);

      // Collapse per-recipient rows into one history entry per send batch (title + minute).
      const seen = new Set<string>();
      const recent: Array<{
        id: number;
        title: string;
        body: string;
        isRead: boolean;
        createdAt: Date;
        audience: string | null;
        delivered: number;
        readCount: number;
      }> = [];
      for (const row of recentRows) {
        const minute = new Date(row.createdAt).toISOString().slice(0, 16);
        const key = `${row.title}::${minute}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const batch = recentRows.filter(
          (r) => r.title === row.title && new Date(r.createdAt).toISOString().slice(0, 16) === minute
        );
        const data = (row.data ?? {}) as { audience?: string };
        recent.push({
          id: row.id,
          title: row.title,
          body: row.body,
          isRead: batch.every((b) => b.isRead),
          createdAt: row.createdAt,
          audience: data.audience ?? null,
          delivered: batch.length,
          readCount: batch.filter((b) => b.isRead).length,
        });
        if (recent.length >= 12) break;
      }

      return {
        sent: sent.count,
        read: read.count,
        readRate: sent.count ? Math.round((read.count / sent.count) * 100) : 0,
        recent,
      };
    }),

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
          role: users.role,
          isBanned: users.isBanned,
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
      .input(z.object({ userId: z.number(), reason: zReason }))
      .mutation(async ({ ctx, input }) => {
        const { userHasPermission } = await import("./settings");
        if (!(await userHasPermission(ctx.user, "users.delete"))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to delete users." });
        }
        forbidSelfAction(ctx.user.id, input.userId);
        await queries.deleteUser(input.userId);
        await writeAdminAudit(ctx.user.id, "user.deleted", "user", input.userId, input.reason);
        return { success: true };
      }),

    toggleUserBan: adminProcedure
      .input(z.object({ userId: z.number(), reason: zReason }))
      .mutation(async ({ ctx, input }) => {
        const { userHasPermission } = await import("./settings");
        if (!(await userHasPermission(ctx.user, "users.edit"))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to moderate users." });
        }
        forbidSelfAction(ctx.user.id, input.userId);
        const user = await queries.toggleUserBan(input.userId);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });
        await writeAdminAudit(ctx.user.id, user.isBanned ? "user.banned" : "user.restored", "user", input.userId, input.reason);
        return stripSensitiveUser(user);
      }),

    updateUserRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["user", "lecturer"]), reason: zReason }))
      .mutation(async ({ ctx, input }) => {
        forbidSelfAction(ctx.user.id, input.userId);
        const updated = await db.updateUserById(input.userId, { role: input.role });
        if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
        await writeAdminAudit(ctx.user.id, "user.role_changed", "user", input.userId, input.reason, { role: input.role });
        return stripSensitiveUser(updated);
      }),

    getUserDetail: adminProcedure.input(z.object({ userId: z.number() })).query(async ({ input }) => {
      const dbConn = await db.getDb(); if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [user] = await dbConn.select({ id: users.id, name: users.name, email: users.email, role: users.role, isBanned: users.isBanned, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).where(eq(users.id, input.userId));
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      const [stats] = await dbConn.select({ courses: sql<number>`cast(count(distinct ${courseEnrollments.courseId}) as integer)`, quizAverage: sql<number>`coalesce(avg(${progressTracking.averageQuizScore}), 0)`, studyMinutes: sql<number>`coalesce(sum(${progressTracking.totalStudyTimeMinutes}), 0)` }).from(progressTracking).leftJoin(courseEnrollments, eq(courseEnrollments.studentId, users.id)).where(eq(progressTracking.userId, input.userId));
      return { user, stats };
    }),

    requestPasswordReset: adminProcedure.input(z.object({ userId: z.number(), reason: zReason })).mutation(async ({ ctx, input }) => {
      forbidSelfAction(ctx.user.id, input.userId);
      const target = await db.getUserById(input.userId);
      if (!target || target.loginMethod !== "local") throw new TRPCError({ code: "BAD_REQUEST", message: "Password reset is only available for local accounts." });
      const { nanoid } = await import("nanoid"); const token = nanoid(48);
      const expiresAt = new Date(Date.now() + 3_600_000);
      await queries.createPasswordResetToken({ userId: target.id, token, expiresAt });
      await deliverPasswordReset(target.email!, token, expiresAt);
      await writeAdminAudit(ctx.user.id, "user.password_reset_requested", "user", input.userId, input.reason);
      // Delivery is intentionally delegated to the configured mailer; no secret token is returned.
      return { success: true };
    }),

    deleteDocument: adminProcedure
      .input(z.object({ documentId: z.number(), reason: zReason }))
      .mutation(async ({ ctx, input }) => {
        await queries.deleteDocument(input.documentId);
        await writeAdminAudit(ctx.user.id, "document.deleted", "document", input.documentId, input.reason);
        return { success: true };
      }),

    toggleDocumentPublic: adminProcedure
      .input(z.object({ documentId: z.number(), reason: zReason }))
      .mutation(async ({ ctx, input }) => {
        const doc = await queries.getDocumentById(input.documentId);
        if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
        const updated = await queries.updateDocument(input.documentId, { isPublic: !doc.isPublic });
        await writeAdminAudit(ctx.user.id, updated?.isPublic ? "document.published" : "document.unpublished", "document", input.documentId, input.reason);
        return updated;
      }),

    reportDocument: adminProcedure.input(z.object({ documentId: z.number(), reason: zReason })).mutation(async ({ ctx, input }) => {
      const doc = await queries.getDocumentById(input.documentId); if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      const updated = await queries.updateDocument(input.documentId, { reportCount: doc.reportCount + 1, moderationNote: input.reason });
      await writeAdminAudit(ctx.user.id, "document.flagged", "document", input.documentId, input.reason);
      return updated;
    }),

    getSystemPerformance: adminProcedure.query(async () => {
      const memory = process.memoryUsage();
      return {
        // Node cannot know host CPU capacity portably; report process CPU time instead.
        cpuUsage: process.cpuUsage().user / 1_000_000,
        memoryUsage: (memory.heapUsed / memory.heapTotal) * 100,
        uptimeSeconds: process.uptime(),
        responseTimeMs: 0,
        activeSessions: 0,
      };
    }),
  }),

  lecturer: lecturerRouter,
  studentCourses: studentCoursesRouter,
  studentLearning: studentLearningRouter,
  exams: examsRouter,
  practice: practiceRouter,
  discussions: discussionsRouter,
  audioRecap: audioRecapRouter,

  // ── Assignment submissions ────────────────────────────────────────────────
  assignments: router({
    /**
     * Student: submit an assignment (text note + optional file that was already
     * uploaded via /api/storage/put).
     */
    submit: studentProcedure
      .input(z.object({
        assignmentId: z.number(),
        courseId: z.number(),
        note: zOptionalText("Note", LIMITS.description).optional(),
        fileUrl: z.string().trim().max(2048).optional(),
        fileKey: z.string().trim().max(500).optional(),
        fileName: z.string().trim().max(300).optional(),
        fileSize: z.number().int().nonnegative().optional(),
        mimeType: z.string().trim().max(200).optional(),
      }).refine(value => Boolean(value.note || value.fileUrl), {
        message: "Add a note or attach a file before submitting.",
        path: ["note"],
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify student is enrolled in the course
        const { isStudentEnrolled } = await import("./lecturerQueries");
        const enrolled = await isStudentEnrolled(ctx.user.id, input.courseId);
        if (!enrolled) throw new TRPCError({ code: "FORBIDDEN", message: "Not enrolled in this course." });
        const assignment = await lecturerQueries.getAssignmentById(input.assignmentId);
        if (!assignment || assignment.courseId !== input.courseId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Assignment not found." });
        }
        const status = assignment.dueDate && new Date() > assignment.dueDate ? "late" as const : "submitted" as const;
        const { recordStudentActivity } = await import("./studentActivity");
        await recordStudentActivity({
          userId: ctx.user.id,
          type: "ASSIGNMENT_SUBMITTED",
          courseId: input.courseId,
          metadata: { assignmentId: input.assignmentId },
        });

        // Check if already submitted — update if so
        const existing = await queries.getSubmissionByStudentAndAssignment(ctx.user.id, input.assignmentId);
        if (existing) {
          // Re-submission: update the existing row
          const dbConn = await db.getDb();
          if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
          const { assignmentSubmissions: tbl } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await dbConn.update(tbl).set({
            note: input.note ?? null,
            fileUrl: input.fileUrl ?? null,
            fileKey: input.fileKey ?? null,
            fileName: input.fileName ?? null,
            fileSize: input.fileSize ?? null,
            mimeType: input.mimeType ?? null,
            status,
            submittedAt: new Date(),
          }).where(eq(tbl.id, existing.id));
          return { ...existing, status };
        }

        return queries.createSubmission({
          assignmentId: input.assignmentId,
          studentId: ctx.user.id,
          courseId: input.courseId,
          note: input.note,
          fileUrl: input.fileUrl,
          fileKey: input.fileKey,
          fileName: input.fileName,
          fileSize: input.fileSize,
          mimeType: input.mimeType,
          status,
        });
      }),

    /** Student: get their own submission for a given assignment */
    mySubmission: studentProcedure
      .input(z.object({ assignmentId: z.number() }))
      .query(
        async ({ ctx, input }) =>
          (await queries.getSubmissionByStudentAndAssignment(ctx.user.id, input.assignmentId)) ?? null
      ),

    /** Student: all submissions for a course (to show status per assignment) */
    mySubmissionsForCourse: studentProcedure
      .input(z.object({ courseId: z.number() }))
      .query(({ ctx, input }) =>
        queries.getStudentSubmissionsForCourse(ctx.user.id, input.courseId)
      ),
  }),

  // ── General (Ask AI) chat history ────────────────────────────────────────
  generalChat: router({
    history: studentProcedure.query(({ ctx }) =>
      queries.getGeneralChatHistory(ctx.user.id, 60)
    ),
    clear: studentProcedure.mutation(({ ctx }) =>
      queries.clearGeneralChatHistory(ctx.user.id)
    ),
  }),

  // ── Notification inbox ────────────────────────────────────────────────────
  notifications: router({
    list: studentProcedure.query(({ ctx }) =>
      queries.getUserNotifications(ctx.user.id, 50)
    ),
    unreadCount: studentProcedure.query(({ ctx }) =>
      queries.getUnreadNotificationCount(ctx.user.id)
    ),
    markRead: studentProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(({ ctx, input }) =>
        queries.markNotificationRead(input.notificationId, ctx.user.id)
      ),
    markAllRead: studentProcedure.mutation(({ ctx }) =>
      queries.markAllNotificationsRead(ctx.user.id)
    ),
  }),

  // ── Password reset — already merged into auth router above ─────────────────
});

export type AppRouter = typeof appRouter;
