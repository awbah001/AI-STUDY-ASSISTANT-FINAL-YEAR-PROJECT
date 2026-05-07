import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { InsertUser, User, users } from "../drizzle/schema";
import { ENV } from './_core/env';
import { mkdirSync } from "fs";
import { dirname } from "path";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db) {
    try {
      let dbPath = process.env.DATABASE_URL || "file:./data/app.db";
      // Remove SSL parameter if present
      if (dbPath.includes("?ssl=")) {
        dbPath = dbPath.split("?")[0];
      }
      const filePath = dbPath.replace("file:", "");
      
      // Ensure directory exists
      if (filePath.startsWith("/")) {
        mkdirSync(dirname(filePath), { recursive: true });
      }
      
      // Create libsql client
      const client = createClient({
        url: dbPath,
      });
      
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    // SQLite uses INSERT OR REPLACE
    const existing = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);
    if (existing.length > 0) {
      // Update existing user
      await db.update(users).set(updateSet).where(eq(users.openId, user.openId));
    } else {
      // Insert new user
      await db.insert(users).values(values);
    }
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user by email: database not available");
    return undefined;
  }

  const normalized = email.trim().toLowerCase();
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createUser(user: InsertUser) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create user: database not available");
    return null;
  }

  const values: InsertUser = {
    ...user,
    email: user.email ? user.email.trim().toLowerCase() : user.email,
    createdAt: user.createdAt ?? new Date(),
    updatedAt: user.updatedAt ?? new Date(),
    lastSignedIn: user.lastSignedIn ?? new Date(),
  };

  const inserted = await db.insert(users).values(values).returning();
  return inserted[0] ?? null;
}

export async function updateUserByOpenId(
  openId: string,
  patch: Partial<Pick<InsertUser, "name" | "avatarUrl" | "passwordHash">>
): Promise<User | undefined> {
  const dbConn = await getDb();
  if (!dbConn) {
    console.warn("[Database] Cannot update user: database not available");
    return undefined;
  }

  await dbConn
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.openId, openId));

  return getUserByOpenId(openId);
}

// TODO: add feature queries here as your schema grows.
