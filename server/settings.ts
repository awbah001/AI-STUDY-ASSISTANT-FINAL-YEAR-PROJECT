import { eq } from "drizzle-orm";
import { systemSettings, userPreferences, users, type User } from "../drizzle/schema";
import { getDb } from "./db";
import {
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_SYSTEM_SETTINGS,
  type SystemSettings,
} from "../shared/adminSettings";

let cache: SystemSettings | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepMerge<T extends Record<string, unknown>>(base: T, override: unknown): T {
  if (!isRecord(override)) return base;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = out[key];
    if (isRecord(current) && isRecord(value)) {
      out[key] = deepMerge(current, value);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out as T;
}

export async function getSystemSettings(): Promise<SystemSettings> {
  if (cache) return cache;
  const dbConn = await getDb();
  if (!dbConn) return DEFAULT_SYSTEM_SETTINGS;
  const rows = await dbConn.select().from(systemSettings);
  const stored: Record<string, unknown> = {};
  for (const row of rows) {
    stored[row.key] = row.value;
  }
  cache = deepMerge(DEFAULT_SYSTEM_SETTINGS as unknown as Record<string, unknown>, stored) as SystemSettings;
  return cache;
}

export async function saveSystemSettings(
  patch: Record<string, unknown>,
  adminId: number
): Promise<SystemSettings> {
  const current = await getSystemSettings();
  const next = deepMerge(current as unknown as Record<string, unknown>, patch) as SystemSettings;
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database not available");
  const now = new Date();
  for (const [key, value] of Object.entries(next)) {
    await dbConn
      .insert(systemSettings)
      .values({ key, value: value as Record<string, unknown>, updatedBy: adminId, updatedAt: now })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: value as Record<string, unknown>, updatedBy: adminId, updatedAt: now },
      });
  }
  cache = next;
  return next;
}

export function clearSettingsCache() {
  cache = null;
}

export async function getFeatureFlags() {
  const settings = await getSystemSettings();
  return settings.features;
}

export async function getRagSettings() {
  const settings = await getSystemSettings();
  return settings.ai.rag;
}

export async function getAiSettings() {
  const settings = await getSystemSettings();
  return settings.ai;
}

export async function getPasswordMinLength() {
  const settings = await getSystemSettings();
  return Math.max(8, settings.passwordPolicy.minLength || 8);
}

export function hasPermission(user: User, permission: string): boolean {
  const role = user.role === "admin" || user.role === "lecturer" ? user.role : "user";
  const fromSettings = cache?.rolePermissions?.[role];
  const list = fromSettings ?? DEFAULT_ROLE_PERMISSIONS[role];
  if (user.role === "admin" && user.isSuperAdmin) return true;
  return list.includes(permission);
}

export async function userHasPermission(user: User, permission: string): Promise<boolean> {
  await getSystemSettings();
  return hasPermission(user, permission);
}

let superAdminExistsCache: boolean | null = null;

export async function isSuperAdminUser(user: User): Promise<boolean> {
  if (user.role !== "admin") return false;
  if (user.isSuperAdmin) return true;
  if (superAdminExistsCache === true) return false;
  const dbConn = await getDb();
  if (!dbConn) return true;
  const rows = await dbConn.select({ id: users.id }).from(users).where(eq(users.isSuperAdmin, true)).limit(1);
  superAdminExistsCache = rows.length > 0;
  return !superAdminExistsCache;
}

export async function assertFeatureEnabled(flag: keyof SystemSettings["features"]) {
  const flags = await getFeatureFlags();
  if (!flags[flag]) {
    const err = new Error("This feature is currently disabled by an administrator.");
    (err as Error & { code?: string }).code = "PRECONDITION_FAILED";
    throw err;
  }
}

export function requirePermission(user: User, permission: string) {
  if (!hasPermission(user, permission)) {
    const err = new Error("You do not have permission to perform this action.");
    (err as Error & { code?: string }).code = "FORBIDDEN";
    throw err;
  }
}

export async function isMaintenanceMode(): Promise<boolean> {
  const settings = await getSystemSettings();
  return Boolean(settings.general.maintenanceMode);
}

export async function getUserPreferences(userId: number) {
  const dbConn = await getDb();
  if (!dbConn) return null;
  const rows = await dbConn.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function saveUserPreferences(
  userId: number,
  patch: Partial<{
    theme: string;
    language: string;
    timezone: string;
    dateFormat: string;
    timeFormat: string;
    landingPage: string;
    sidebarCollapsed: boolean;
    notifications: Record<string, boolean>;
  }>
) {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database not available");
  const existing = await getUserPreferences(userId);
  const now = new Date();
  if (!existing) {
    await dbConn.insert(userPreferences).values({
      userId,
      theme: patch.theme ?? "light",
      language: patch.language ?? "en",
      timezone: patch.timezone ?? "UTC",
      dateFormat: patch.dateFormat ?? "dd MMM yyyy",
      timeFormat: patch.timeFormat ?? "24h",
      landingPage: patch.landingPage ?? "/admin",
      sidebarCollapsed: patch.sidebarCollapsed ?? false,
      notifications: patch.notifications ?? {
        email: true,
        inApp: true,
        security: true,
        system: true,
        users: true,
        ai: true,
      },
      updatedAt: now,
    });
  } else {
    await dbConn
      .update(userPreferences)
      .set({ ...patch, updatedAt: now })
      .where(eq(userPreferences.userId, userId));
  }
  return getUserPreferences(userId);
}
