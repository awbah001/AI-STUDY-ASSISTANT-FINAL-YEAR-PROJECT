import { createClient } from "@libsql/client";

const c = createClient({ url: "file:./data/app.db" });

async function columnExists(table, column) {
  const r = await c.execute(`PRAGMA table_info(${table})`);
  return r.rows.some((row) => row.name === column);
}

async function tableExists(name) {
  const r = await c.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`
  );
  return r.rows.length > 0;
}

const statements = [];

if (!(await columnExists("documents", "courseId"))) {
  statements.push("ALTER TABLE documents ADD COLUMN courseId integer");
}
if (!(await columnExists("documents", "materialType"))) {
  statements.push("ALTER TABLE documents ADD COLUMN materialType text DEFAULT 'other'");
}
statements.push(
  "CREATE INDEX IF NOT EXISTS documents_courseId_idx ON documents (courseId)"
);

if (!(await tableExists("courses"))) {
  statements.push(`CREATE TABLE courses (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    lecturerId integer NOT NULL,
    title text NOT NULL,
    code text NOT NULL UNIQUE,
    subject text,
    description text,
    isActive integer DEFAULT 1 NOT NULL,
    createdAt integer NOT NULL,
    updatedAt integer NOT NULL
  )`);
  statements.push("CREATE INDEX IF NOT EXISTS courses_lecturerId_idx ON courses (lecturerId)");
}

if (!(await tableExists("courseEnrollments"))) {
  statements.push(`CREATE TABLE courseEnrollments (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    courseId integer NOT NULL,
    studentId integer NOT NULL,
    enrolledAt integer NOT NULL
  )`);
  statements.push(
    "CREATE INDEX IF NOT EXISTS enrollments_courseId_idx ON courseEnrollments (courseId)"
  );
  statements.push(
    "CREATE INDEX IF NOT EXISTS enrollments_studentId_idx ON courseEnrollments (studentId)"
  );
}

if (!(await tableExists("assignments"))) {
  statements.push(`CREATE TABLE assignments (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    courseId integer NOT NULL,
    lecturerId integer NOT NULL,
    title text NOT NULL,
    description text,
    dueDate integer,
    documentId integer,
    createdAt integer NOT NULL,
    updatedAt integer NOT NULL
  )`);
  statements.push(
    "CREATE INDEX IF NOT EXISTS assignments_courseId_idx ON assignments (courseId)"
  );
}

if (!(await tableExists("announcements"))) {
  statements.push(`CREATE TABLE announcements (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    courseId integer NOT NULL,
    lecturerId integer NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    createdAt integer NOT NULL
  )`);
  statements.push(
    "CREATE INDEX IF NOT EXISTS announcements_courseId_idx ON announcements (courseId)"
  );
}

for (const sql of statements) {
  try {
    await c.execute(sql);
    console.log("OK:", sql.slice(0, 60));
  } catch (e) {
    console.error("FAIL:", sql.slice(0, 60), e.message);
  }
}

const tables = await c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
console.log("\nTables:", tables.rows.map((x) => x.name).join(", "));
