import type { Client } from "@libsql/client";

export async function runAdminSettingsMigration(client: Client) {
  const statements = [
    "ALTER TABLE users ADD COLUMN isSuperAdmin integer NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN phone text",
    "ALTER TABLE users ADD COLUMN jobTitle text",
    "ALTER TABLE users ADD COLUMN tokenVersion integer NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN totpEnabled integer NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN totpSecret text",
    "ALTER TABLE users ADD COLUMN totpRecoveryHashes text",
    `CREATE TABLE IF NOT EXISTS systemSettings (
      key text PRIMARY KEY NOT NULL,
      value text NOT NULL,
      updatedBy integer,
      updatedAt integer NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS userPreferences (
      userId integer PRIMARY KEY NOT NULL,
      theme text DEFAULT 'light',
      language text DEFAULT 'en',
      timezone text DEFAULT 'UTC',
      dateFormat text DEFAULT 'dd MMM yyyy',
      timeFormat text DEFAULT '24h',
      landingPage text DEFAULT '/admin',
      sidebarCollapsed integer NOT NULL DEFAULT 0,
      notifications text,
      updatedAt integer NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS systemBackups (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      fileName text NOT NULL,
      sizeBytes integer NOT NULL DEFAULT 0,
      createdBy integer,
      createdAt integer NOT NULL
    )`,
  ];
  for (const sql of statements) {
    try {
      await client.execute(sql);
    } catch (error) {
      if (!String(error).toLowerCase().includes("duplicate column")) throw error;
    }
  }
}
