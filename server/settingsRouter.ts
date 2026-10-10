import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq, like, or, sql } from "drizzle-orm";
import { copyFile, mkdir, stat, unlink } from "fs/promises";
import path from "path";
import { adminProcedure, protectedProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import {
  getSystemSettings,
  saveSystemSettings,
  getUserPreferences,
  saveUserPreferences,
  userHasPermission,
  clearSettingsCache,
  isSuperAdminUser,
} from "./settings";
import { generateRecoveryCodes, generateTotpSecret, totpUri, verifyTotp, consumeRecoveryCode } from "./totp";
import { adminAuditLogs, documents, systemBackups, users, courses, systemSettings } from "../drizzle/schema";
import { ADMIN_PERMISSIONS } from "../shared/adminSettings";
import { stripSensitiveUser } from "./userSafe";
import { sdk } from "./_core/sdk";
import { ONE_YEAR_MS } from "../shared/const";
import { EMAIL_DOMAIN_ERROR, isAllowedEmail } from "../shared/emailDomain";
import { LIMITS, zEmail, zOptionalText, zPersonName, zPhone } from "../shared/validation";
import { getAiService, getAiMetrics } from "./ai";

async function audit(adminId: number, action: string, targetType: string, targetId: number, reason?: string, metadata?: Record<string, unknown>) {
  const dbConn = await getDb();
  if (!dbConn) return;
  await dbConn.insert(adminAuditLogs).values({
    adminId,
    action,
    targetType,
    targetId,
    reason: reason ?? null,
    metadata: metadata ?? null,
  });
}

function forbid(message = "You do not have permission to perform this action.") {
  throw new TRPCError({ code: "FORBIDDEN", message });
}

async function assertPerm(user: { role: string; isSuperAdmin?: boolean | null; id: number }, permission: string) {
  if (!(await userHasPermission(user as never, permission))) forbid();
}

function backupsDir() {
  return path.resolve("data/backups");
}

function dbFilePath() {
  const raw = (process.env.DATABASE_URL || "file:./data/app.db").replace(/^file:/, "").split("?")[0];
  return path.resolve(raw);
}

export const settingsRouter = router({
  get: adminProcedure.query(async ({ ctx }) => {
    const settings = await getSystemSettings();
    return {
      settings,
      me: {
        id: ctx.user.id,
        name: ctx.user.name,
        email: ctx.user.email,
        phone: ctx.user.phone,
        jobTitle: ctx.user.jobTitle,
        role: ctx.user.role,
        isSuperAdmin: await isSuperAdminUser(ctx.user),
        avatarUrl: ctx.user.avatarUrl,
        loginMethod: ctx.user.loginMethod,
        totpEnabled: Boolean(ctx.user.totpEnabled),
        createdAt: ctx.user.createdAt,
        lastSignedIn: ctx.user.lastSignedIn,
      },
    };
  }),

  save: adminProcedure
    .input(z.object({ patch: z.record(z.string(), z.unknown()), reason: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertPerm(ctx.user, "system.configure");
      if (input.patch.ai && !(await userHasPermission(ctx.user, "ai.configure")) && !ctx.user.isSuperAdmin) forbid();
      const settings = await saveSystemSettings(input.patch, ctx.user.id);
      await audit(ctx.user.id, "SETTINGS_UPDATED", "settings", 0, input.reason, { keys: Object.keys(input.patch) });
      return settings;
    }),

  preferences: protectedProcedure.query(async ({ ctx }) => getUserPreferences(ctx.user.id)),

  savePreferences: protectedProcedure
    .input(
      z.object({
        theme: z.enum(["light", "dark"]).optional(),
        language: z.string().max(12).optional(),
        timezone: z.string().max(80).optional(),
        dateFormat: z.string().max(40).optional(),
        timeFormat: z.enum(["12h", "24h"]).optional(),
        landingPage: z.string().max(80).optional(),
        sidebarCollapsed: z.boolean().optional(),
        notifications: z.record(z.string(), z.boolean()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => saveUserPreferences(ctx.user.id, input)),

  updateAccount: adminProcedure
    .input(
      z.object({
        name: zPersonName().optional(),
        phone: zPhone.optional(),
        jobTitle: zOptionalText("Job title", LIMITS.shortText).optional(),
        email: zEmail.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.email && !isAllowedEmail(input.email)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: EMAIL_DOMAIN_ERROR });
      }
      const dbConn = await getDb();
      if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await dbConn
        .update(users)
        .set({
          ...(input.name ? { name: input.name } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
          ...(input.email ? { email: input.email.toLowerCase() } : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.id, ctx.user.id));
      if (input.email) await audit(ctx.user.id, "EMAIL_CHANGED", "user", ctx.user.id);
      const [updated] = await dbConn.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return stripSensitiveUser(updated);
    }),

  totpStart: adminProcedure.mutation(async ({ ctx }) => {
    const secret = generateTotpSecret();
    const dbConn = await getDb();
    if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await dbConn.update(users).set({ totpSecret: secret, totpEnabled: false, updatedAt: new Date() }).where(eq(users.id, ctx.user.id));
    return { secret, uri: totpUri(secret, ctx.user.email || "admin") };
  }),

  totpConfirm: adminProcedure.input(z.object({ code: z.string().min(6).max(8) })).mutation(async ({ ctx, input }) => {
    const secret = ctx.user.totpSecret;
    if (!secret) throw new TRPCError({ code: "BAD_REQUEST", message: "Start 2FA setup first." });
    if (!verifyTotp(secret, input.code)) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid authenticator code." });
    const recovery = generateRecoveryCodes();
    const dbConn = await getDb();
    if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await dbConn
      .update(users)
      .set({ totpEnabled: true, totpRecoveryHashes: recovery.hashes, updatedAt: new Date() })
      .where(eq(users.id, ctx.user.id));
    await audit(ctx.user.id, "TWO_FACTOR_ENABLED", "user", ctx.user.id);
    return { recoveryCodes: recovery.plain };
  }),

  totpDisable: adminProcedure.input(z.object({ code: z.string().min(6).max(64) })).mutation(async ({ ctx, input }) => {
    const secret = ctx.user.totpSecret;
    const hashes = ctx.user.totpRecoveryHashes ?? [];
    const totpOk = secret ? verifyTotp(secret, input.code) : false;
    const remaining = totpOk ? hashes : consumeRecoveryCode(hashes, input.code);
    if (!totpOk && !remaining) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid code." });
    const dbConn = await getDb();
    if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await dbConn
      .update(users)
      .set({ totpEnabled: false, totpSecret: null, totpRecoveryHashes: [], updatedAt: new Date() })
      .where(eq(users.id, ctx.user.id));
    await audit(ctx.user.id, "TWO_FACTOR_DISABLED", "user", ctx.user.id);
    return { success: true as const };
  }),

  totpRegenerate: adminProcedure.input(z.object({ code: z.string().min(6).max(8) })).mutation(async ({ ctx, input }) => {
    if (!ctx.user.totpEnabled || !ctx.user.totpSecret) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Enable 2FA first." });
    }
    if (!verifyTotp(ctx.user.totpSecret, input.code)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid authenticator code." });
    }
    const recovery = generateRecoveryCodes();
    const dbConn = await getDb();
    if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await dbConn.update(users).set({ totpRecoveryHashes: recovery.hashes, updatedAt: new Date() }).where(eq(users.id, ctx.user.id));
    await audit(ctx.user.id, "TWO_FACTOR_RECOVERY_REGENERATED", "user", ctx.user.id);
    return { recoveryCodes: recovery.plain };
  }),

  session: adminProcedure.query(async ({ ctx }) => ({
    current: {
      device: "This browser",
      loginMethod: ctx.user.loginMethod,
      lastActive: ctx.user.lastSignedIn,
      createdAt: ctx.user.createdAt,
    },
    note: "The platform uses JWT sessions. Other devices are not listed until they call the API. Signing out others invalidates every existing token for this account.",
  })),

  revokeOtherSessions: adminProcedure.mutation(async ({ ctx }) => {
    const dbConn = await getDb();
    if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const next = (ctx.user.tokenVersion ?? 0) + 1;
    await dbConn.update(users).set({ tokenVersion: next, updatedAt: new Date() }).where(eq(users.id, ctx.user.id));
    await audit(ctx.user.id, "SESSIONS_REVOKED", "user", ctx.user.id);
    const token = await sdk.createSessionToken(ctx.user.openId, {
      name: ctx.user.name || "",
      expiresInMs: ONE_YEAR_MS,
      tokenVersion: next,
    });
    return { success: true as const, token };
  }),

  forceLogoutUser: adminProcedure.input(z.object({ userId: z.number(), reason: z.string().min(3).max(500) })).mutation(async ({ ctx, input }) => {
    await assertPerm(ctx.user, "users.edit");
    const dbConn = await getDb();
    if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [target] = await dbConn.select().from(users).where(eq(users.id, input.userId)).limit(1);
    if (!target) throw new TRPCError({ code: "NOT_FOUND" });
    await dbConn.update(users).set({ tokenVersion: (target.tokenVersion ?? 0) + 1, updatedAt: new Date() }).where(eq(users.id, input.userId));
    await audit(ctx.user.id, "USER_FORCE_LOGOUT", "user", input.userId, input.reason);
    return { success: true as const };
  }),

  securityLogs: adminProcedure.query(async ({ ctx }) => {
    await assertPerm(ctx.user, "audit.view");
    const dbConn = await getDb();
    if (!dbConn) return [];
    return dbConn
      .select()
      .from(adminAuditLogs)
      .where(
        or(
          like(adminAuditLogs.action, "%LOGIN%"),
          like(adminAuditLogs.action, "%PASSWORD%"),
          like(adminAuditLogs.action, "%SESSION%"),
          like(adminAuditLogs.action, "%TWO_FACTOR%"),
          like(adminAuditLogs.action, "%EMAIL%"),
          like(adminAuditLogs.action, "user.%")
        )
      )
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(80);
  }),

  health: adminProcedure.query(async () => {
    const dbConn = await getDb();
    let database: "operational" | "error" = "operational";
    try {
      if (!dbConn) database = "error";
      else await dbConn.select({ n: sql<number>`1` }).from(users).limit(1);
    } catch {
      database = "error";
    }
    let ai: "operational" | "warning" | "unavailable" = "unavailable";
    try {
      const health = await getAiService().healthCheck();
      if (health.status === "connected") ai = "operational";
      else if (health.status === "misconfigured") ai = "unavailable";
      else ai = "warning";
    } catch {
      ai = ENV.groqApiKey ? "warning" : "unavailable";
    }
    const [storage] = dbConn
      ? await dbConn.select({ bytes: sql<number>`coalesce(sum(${documents.fileSize}), 0)`, count: sql<number>`cast(count(*) as integer)` }).from(documents)
      : [{ bytes: 0, count: 0 }];
    return {
      backend: "operational" as const,
      database,
      authentication: ENV.cookieSecret.length >= 16 ? ("operational" as const) : ("warning" as const),
      ai,
      storage,
      googleAuth: ENV.googleClientIds.length > 0,
      email: Boolean(process.env.RESEND_API_KEY),
    };
  }),

  aiHealth: adminProcedure.query(async ({ ctx }) => {
    await assertPerm(ctx.user, "ai.configure");
    const health = await getAiService().healthCheck();
    return [health];
  }),

  aiMetrics: adminProcedure.query(async ({ ctx }) => {
    await assertPerm(ctx.user, "ai.configure");
    return [getAiMetrics()];
  }),

  activity: adminProcedure.query(async () => {
    const dbConn = await getDb();
    if (!dbConn) return [];
    return dbConn.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(25);
  }),

  integrations: adminProcedure.query(async () => {
    let groqStatus = "not_connected";
    let groqDetail = ENV.groqApiKey ? `${ENV.groqModel} (configured)` : "Set GROQ_API_KEY";
    try {
      const health = await getAiService().healthCheck();
      groqStatus =
        health.status === "connected"
          ? "connected"
          : health.status === "misconfigured"
            ? "error"
            : "not_connected";
      groqDetail = `${health.detail}${health.latencyMs != null ? ` · ${health.latencyMs}ms` : ""}`;
    } catch {
      /* keep defaults */
    }
    return {
      jwt: { status: ENV.cookieSecret.length >= 16 ? "connected" : "error", detail: "HS256 Bearer sessions" },
      google: { status: ENV.googleClientIds.length ? "connected" : "not_connected", detail: "Web / iOS client IDs" },
      email: { status: process.env.RESEND_API_KEY ? "connected" : "not_connected", detail: "Resend transactional email" },
      groq: { status: groqStatus, detail: groqDetail },
      storage: { status: "connected" as const, detail: "Local data/uploads" },
    };
  }),

  testGroq: adminProcedure.mutation(async ({ ctx }) => {
    await assertPerm(ctx.user, "ai.configure");
    if (!ENV.groqApiKey) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "GROQ_API_KEY is not set on the server." });
    }
    try {
      const health = await getAiService().healthCheck();
      if (health.status !== "connected") {
        throw new Error(health.detail || `Status: ${health.status}`);
      }
      return { ok: true as const, message: `Groq responded (${health.model}).` };
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Groq unreachable." });
    }
  }),

  sendTestEmail: adminProcedure.input(z.object({ to: z.string().email() })).mutation(async ({ ctx, input }) => {
    await assertPerm(ctx.user, "system.configure");
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.PASSWORD_RESET_FROM;
    if (!apiKey || !from) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Email is not configured. Set RESEND_API_KEY and PASSWORD_RESET_FROM on the server." });
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [input.to], subject: "Course-Specific AI Learning Assistant test email", html: "<p>This is a Course-Specific AI Learning Assistant settings test email.</p>" }),
    });
    if (!response.ok) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Email provider rejected the test message." });
    }
    await audit(ctx.user.id, "TEST_EMAIL_SENT", "settings", 0);
    return { ok: true as const };
  }),

  backups: adminProcedure.query(async ({ ctx }) => {
    await assertPerm(ctx.user, "backup.manage");
    const dbConn = await getDb();
    if (!dbConn) return [];
    return dbConn.select().from(systemBackups).orderBy(desc(systemBackups.createdAt)).limit(30);
  }),

  createBackup: adminProcedure.mutation(async ({ ctx }) => {
    await assertPerm(ctx.user, "backup.manage");
    await mkdir(backupsDir(), { recursive: true });
    const fileName = `ai-learning-assistant-${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
    const dest = path.join(backupsDir(), fileName);
    await copyFile(dbFilePath(), dest);
    const info = await stat(dest);
    const dbConn = await getDb();
    if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [row] = await dbConn
      .insert(systemBackups)
      .values({ fileName, sizeBytes: info.size, createdBy: ctx.user.id })
      .returning();
    await audit(ctx.user.id, "BACKUP_CREATED", "backup", row?.id ?? 0);
    return row;
  }),

  deleteBackup: adminProcedure.input(z.object({ id: z.number(), confirm: z.literal("DELETE") })).mutation(async ({ ctx, input }) => {
    await assertPerm(ctx.user, "backup.manage");
    const dbConn = await getDb();
    if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [row] = await dbConn.select().from(systemBackups).where(eq(systemBackups.id, input.id)).limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    await unlink(path.join(backupsDir(), row.fileName)).catch(() => undefined);
    await dbConn.delete(systemBackups).where(eq(systemBackups.id, input.id));
    await audit(ctx.user.id, "BACKUP_DELETED", "backup", input.id);
    return { success: true as const };
  }),

  restoreBackup: adminProcedure.input(z.object({ id: z.number(), confirm: z.literal("RESTORE") })).mutation(async ({ ctx, input }) => {
    if (!(await isSuperAdminUser(ctx.user))) forbid("Only a Super Admin can restore a backup.");
    const dbConn = await getDb();
    if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [row] = await dbConn.select().from(systemBackups).where(eq(systemBackups.id, input.id)).limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    const src = path.join(backupsDir(), row.fileName);
    await copyFile(src, `${dbFilePath()}.restore-pending`);
    await audit(ctx.user.id, "BACKUP_RESTORE_STAGED", "backup", input.id);
    return {
      success: true as const,
      message: "Backup copied to data/app.db.restore-pending. Stop the server, replace app.db with that file, then start again.",
    };
  }),

  exportUsers: adminProcedure.mutation(async ({ ctx }) => {
    await assertPerm(ctx.user, "users.view");
    const dbConn = await getDb();
    if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const rows = await dbConn.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isBanned: users.isBanned,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    }).from(users);
    await audit(ctx.user.id, "USERS_EXPORTED", "settings", 0);
    return rows;
  }),

  exportCourses: adminProcedure.mutation(async ({ ctx }) => {
    await assertPerm(ctx.user, "courses.view");
    const dbConn = await getDb();
    if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const rows = await dbConn.select().from(courses);
    await audit(ctx.user.id, "COURSES_EXPORTED", "settings", 0);
    return rows;
  }),

  applyRetention: adminProcedure
    .input(z.object({ confirm: z.literal("APPLY RETENTION") }))
    .mutation(async ({ ctx }) => {
      if (!(await isSuperAdminUser(ctx.user))) forbid("Only a Super Admin can apply retention.");
      const settings = await getSystemSettings();
      const dbConn = await getDb();
      if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let auditDeleted = 0;
      if (settings.data.auditRetentionDays > 0) {
        const cutoff = new Date(Date.now() - settings.data.auditRetentionDays * 86400000);
        const result = await dbConn.delete(adminAuditLogs).where(sql`${adminAuditLogs.createdAt} < ${cutoff}`);
        auditDeleted = Number((result as { rowsAffected?: number }).rowsAffected ?? 0);
      }
      await audit(ctx.user.id, "RETENTION_APPLIED", "settings", 0, undefined, { auditDeleted });
      return { auditDeleted };
    }),

  reindexDocuments: adminProcedure.mutation(async ({ ctx }) => {
    if (!(await isSuperAdminUser(ctx.user))) forbid("Only a Super Admin can re-index documents.");
    const dbConn = await getDb();
    if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const docs = await dbConn.select({ id: documents.id, extractedText: documents.extractedText }).from(documents);
    const llmUtils = await import("./llmUtils");
    let indexed = 0;
    for (const doc of docs) {
      if (!doc.extractedText?.trim()) continue;
      await llmUtils.indexDocumentForRag(doc.id, doc.extractedText);
      indexed += 1;
    }
    await audit(ctx.user.id, "VECTOR_INDEX_REBUILT", "settings", 0, undefined, { indexed });
    return { indexed };
  }),

  resetSettings: adminProcedure.input(z.object({ confirm: z.literal("RESET SETTINGS") })).mutation(async ({ ctx }) => {
    if (!(await isSuperAdminUser(ctx.user))) forbid("Only a Super Admin can reset configuration.");
    const dbConn = await getDb();
    if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await dbConn.delete(systemSettings);
    clearSettingsCache();
    await audit(ctx.user.id, "SETTINGS_RESET", "settings", 0);
    return getSystemSettings();
  }),

  permissionsCatalog: adminProcedure.query(() => ({ permissions: ADMIN_PERMISSIONS })),
});
