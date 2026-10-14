import type { Client } from "@libsql/client";
import { parseLevel } from "../../shared/academics";

async function addColumnIfMissing(client: Client, table: string, column: string, definition: string) {
  const info = await client.execute(`PRAGMA table_info(${table})`);
  if (!info.rows.length || info.rows.some((row) => row.name === column)) return;
  await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export async function runAcademicStructureMigration(client: Client) {
  await client.execute(`CREATE TABLE IF NOT EXISTS faculties (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    name text NOT NULL UNIQUE,
    createdAt integer NOT NULL
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS departments (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    facultyId integer NOT NULL,
    name text NOT NULL,
    createdAt integer NOT NULL
  )`);
  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS departments_faculty_name_idx ON departments (facultyId, name)`
  );
  await client.execute(`CREATE TABLE IF NOT EXISTS programmes (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    departmentId integer NOT NULL,
    name text NOT NULL,
    durationYears integer NOT NULL DEFAULT 4,
    isActive integer NOT NULL DEFAULT 1,
    createdAt integer NOT NULL
  )`);
  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS programmes_department_name_idx ON programmes (departmentId, name)`
  );
  await client.execute(`CREATE TABLE IF NOT EXISTS courseProgrammes (
    courseId integer NOT NULL,
    programmeId integer NOT NULL
  )`);
  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS course_programmes_pair_idx ON courseProgrammes (courseId, programmeId)`
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS course_programmes_programme_idx ON courseProgrammes (programmeId)`
  );
  await addColumnIfMissing(client, "courses", "level", "integer");
  await addColumnIfMissing(client, "courses", "semester", "text");
  await addColumnIfMissing(client, "courses", "coverImageUrl", "text");
  await addColumnIfMissing(client, "studentProfiles", "programmeId", "integer");
  await addColumnIfMissing(client, "studentProfiles", "academicStatus", "text NOT NULL DEFAULT 'active'");
  await convertLevelsToYears(client);
}

/** Levels used to be stored as 100, 200, ... per year; they are now the year itself (1, 2, ...). */
async function convertLevelsToYears(client: Client) {
  const hasColumn = async (table: string, column: string) =>
    (await client.execute(`PRAGMA table_info(${table})`)).rows.some((row) => row.name === column);
  if (await hasColumn("courses", "level")) {
    await client.execute(`UPDATE courses SET level = level / 100 WHERE level >= 100 AND level % 100 = 0`);
  }
  if (!(await hasColumn("studentProfiles", "academicLevel"))) return;
  const profiles = await client.execute(
    `SELECT userId, academicLevel FROM studentProfiles WHERE academicLevel IS NOT NULL AND academicLevel GLOB '*[0-9]*'`
  );
  for (const row of profiles.rows) {
    const year = parseLevel(row.academicLevel);
    if (year && String(year) !== row.academicLevel) {
      await client.execute({ sql: `UPDATE studentProfiles SET academicLevel = ? WHERE userId = ?`, args: [String(year), row.userId] });
    }
  }
}
