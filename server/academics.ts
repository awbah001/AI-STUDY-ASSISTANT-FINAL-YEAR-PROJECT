import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import {
  courseProgrammes,
  courses,
  departments,
  faculties,
  programmes,
  studentProfiles,
  users,
} from "../drizzle/schema";
import {
  courseMatches,
  isSemester,
  levelsFor,
  nextTerm,
  parseAcademicYear,
  parseLevel,
  promote,
  type CatalogueFaculty,
  type CourseTags,
  type Term,
} from "../shared/academics";
import { getDb } from "./db";

async function database() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

function badRequest(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

/** Faculties, departments and programmes as a tree. Students only see active programmes. */
export async function getCatalogue(includeInactive = false): Promise<CatalogueFaculty[]> {
  const db = await database();
  const [facultyRows, departmentRows, programmeRows] = await Promise.all([
    db.select().from(faculties).orderBy(asc(faculties.name)),
    db.select().from(departments).orderBy(asc(departments.name)),
    db.select().from(programmes).orderBy(asc(programmes.name)),
  ]);
  const tree = facultyRows.map((faculty) => ({
    id: faculty.id,
    name: faculty.name,
    departments: departmentRows
      .filter((d) => d.facultyId === faculty.id)
      .map((department) => ({
        id: department.id,
        name: department.name,
        programmes: programmeRows
          .filter((p) => p.departmentId === department.id && (includeInactive || p.isActive))
          .map((p) => ({ id: p.id, name: p.name, durationYears: p.durationYears, isActive: p.isActive })),
      }))
      .filter((d) => includeInactive || d.programmes.length > 0),
  }));
  return includeInactive ? tree : tree.filter((f) => f.departments.length > 0);
}

export async function hasActiveProgrammes() {
  const db = await database();
  const [row] = await db.select({ id: programmes.id }).from(programmes).where(eq(programmes.isActive, true)).limit(1);
  return Boolean(row);
}

export async function programmeWithNames(programmeId: number) {
  const db = await database();
  const [row] = await db
    .select({
      id: programmes.id,
      name: programmes.name,
      durationYears: programmes.durationYears,
      isActive: programmes.isActive,
      department: departments.name,
      faculty: faculties.name,
    })
    .from(programmes)
    .innerJoin(departments, eq(departments.id, programmes.departmentId))
    .innerJoin(faculties, eq(faculties.id, departments.facultyId))
    .where(eq(programmes.id, programmeId))
    .limit(1);
  return row ?? null;
}

/** Checks a level against the programme's length and returns it as a number. */
export function assertLevel(level: string | number, durationYears: number) {
  const parsed = parseLevel(level);
  if (!parsed || !levelsFor(durationYears).includes(parsed)) {
    badRequest(`Choose a year between 1 and ${levelsFor(durationYears).length} for this programme.`);
  }
  return parsed;
}

/** Keeps the faculty, department and programme names on student profiles in step with the catalogue. */
async function syncProfileNames() {
  const db = await database();
  await db.run(sql`
    UPDATE studentProfiles SET
      programme = (SELECT p.name FROM programmes p WHERE p.id = studentProfiles.programmeId),
      department = (SELECT d.name FROM programmes p JOIN departments d ON d.id = p.departmentId WHERE p.id = studentProfiles.programmeId),
      faculty = (SELECT f.name FROM programmes p JOIN departments d ON d.id = p.departmentId JOIN faculties f ON f.id = d.facultyId WHERE p.id = studentProfiles.programmeId)
    WHERE programmeId IS NOT NULL AND EXISTS (SELECT 1 FROM programmes p WHERE p.id = studentProfiles.programmeId)
  `);
}

const cleanName = (name: string) => name.trim().replace(/\s+/g, " ");

export async function saveFaculty(input: { id?: number; name: string }) {
  const db = await database();
  const name = cleanName(input.name);
  const [clash] = await db.select({ id: faculties.id }).from(faculties).where(sql`lower(${faculties.name}) = lower(${name})`).limit(1);
  if (clash && clash.id !== input.id) badRequest(`There is already a faculty called "${name}".`);
  if (input.id) {
    const updated = await db.update(faculties).set({ name }).where(eq(faculties.id, input.id)).returning({ id: faculties.id });
    if (!updated.length) throw new TRPCError({ code: "NOT_FOUND", message: "Faculty not found." });
    await syncProfileNames();
    return { id: input.id };
  }
  const [row] = await db.insert(faculties).values({ name, createdAt: new Date() }).returning({ id: faculties.id });
  return row;
}

export async function saveDepartment(input: { id?: number; facultyId: number; name: string }) {
  const db = await database();
  const name = cleanName(input.name);
  const [faculty] = await db.select({ id: faculties.id }).from(faculties).where(eq(faculties.id, input.facultyId)).limit(1);
  if (!faculty) badRequest("Choose a faculty for this department.");
  const [clash] = await db
    .select({ id: departments.id })
    .from(departments)
    .where(and(eq(departments.facultyId, input.facultyId), sql`lower(${departments.name}) = lower(${name})`))
    .limit(1);
  if (clash && clash.id !== input.id) badRequest(`This faculty already has a department called "${name}".`);
  if (input.id) {
    const updated = await db
      .update(departments)
      .set({ name, facultyId: input.facultyId })
      .where(eq(departments.id, input.id))
      .returning({ id: departments.id });
    if (!updated.length) throw new TRPCError({ code: "NOT_FOUND", message: "Department not found." });
    await syncProfileNames();
    return { id: input.id };
  }
  const [row] = await db.insert(departments).values({ facultyId: input.facultyId, name, createdAt: new Date() }).returning({ id: departments.id });
  return row;
}

export async function saveProgramme(input: { id?: number; departmentId: number; name: string; durationYears: number; isActive: boolean }) {
  const db = await database();
  const name = cleanName(input.name);
  const [department] = await db.select({ id: departments.id }).from(departments).where(eq(departments.id, input.departmentId)).limit(1);
  if (!department) badRequest("Choose a department for this programme.");
  const [clash] = await db
    .select({ id: programmes.id })
    .from(programmes)
    .where(and(eq(programmes.departmentId, input.departmentId), sql`lower(${programmes.name}) = lower(${name})`))
    .limit(1);
  if (clash && clash.id !== input.id) badRequest(`This department already has a programme called "${name}".`);
  const values = { departmentId: input.departmentId, name, durationYears: input.durationYears, isActive: input.isActive };
  if (input.id) {
    const finalLevel = input.durationYears;
    const [beyond] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(studentProfiles)
      .where(and(eq(studentProfiles.programmeId, input.id), sql`cast(${studentProfiles.academicLevel} as integer) > ${finalLevel}`));
    if (beyond.count) {
      badRequest(`${beyond.count} student${beyond.count === 1 ? " is" : "s are"} beyond Year ${finalLevel} in this programme. Move them first or keep the longer length.`);
    }
    const updated = await db.update(programmes).set(values).where(eq(programmes.id, input.id)).returning({ id: programmes.id });
    if (!updated.length) throw new TRPCError({ code: "NOT_FOUND", message: "Programme not found." });
    await syncProfileNames();
    return { id: input.id };
  }
  const [row] = await db.insert(programmes).values({ ...values, createdAt: new Date() }).returning({ id: programmes.id });
  return row;
}

export async function deleteCatalogueItem(kind: "faculty" | "department" | "programme", id: number) {
  const db = await database();
  const count = async (query: Promise<Array<{ count: number }>>) => (await query)[0]?.count ?? 0;
  const counter = sql<number>`cast(count(*) as integer)`;
  if (kind === "faculty") {
    if (await count(db.select({ count: counter }).from(departments).where(eq(departments.facultyId, id)))) {
      badRequest("Remove this faculty's departments first.");
    }
    await db.delete(faculties).where(eq(faculties.id, id));
  } else if (kind === "department") {
    if (await count(db.select({ count: counter }).from(programmes).where(eq(programmes.departmentId, id)))) {
      badRequest("Remove this department's programmes first.");
    }
    await db.delete(departments).where(eq(departments.id, id));
  } else {
    const students = await count(db.select({ count: counter }).from(studentProfiles).where(eq(studentProfiles.programmeId, id)));
    if (students) {
      badRequest(`${students} student${students === 1 ? " is" : "s are"} in this programme. Turn it off instead so new students can't choose it.`);
    }
    await db.delete(courseProgrammes).where(eq(courseProgrammes.programmeId, id));
    await db.delete(programmes).where(eq(programmes.id, id));
  }
  return { ok: true };
}

export async function courseTags(courseIds?: number[]): Promise<Map<number, CourseTags>> {
  const db = await database();
  if (courseIds && !courseIds.length) return new Map();
  const [courseRows, links] = await Promise.all([
    db
      .select({ id: courses.id, level: courses.level, semester: courses.semester })
      .from(courses)
      .where(courseIds ? inArray(courses.id, courseIds) : undefined),
    db
      .select()
      .from(courseProgrammes)
      .where(courseIds ? inArray(courseProgrammes.courseId, courseIds) : undefined),
  ]);
  return new Map(
    courseRows.map((c) => [
      c.id,
      {
        level: c.level ?? null,
        semester: c.semester ?? null,
        programmeIds: links.filter((l) => l.courseId === c.id).map((l) => l.programmeId),
      },
    ])
  );
}

export async function setCourseTags(courseId: number, tags: CourseTags) {
  const db = await database();
  const [course] = await db.select({ id: courses.id }).from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found." });
  const level = tags.level === null ? null : parseLevel(tags.level);
  if (tags.level !== null && !level) badRequest("Choose a year like Year 1, Year 2 or Year 3.");
  if (tags.semester !== null && !isSemester(tags.semester)) badRequest("Choose the first or second semester.");
  const programmeIds = [...new Set(tags.programmeIds)];
  if (programmeIds.length) {
    const found = await db.select({ id: programmes.id }).from(programmes).where(inArray(programmes.id, programmeIds));
    if (found.length !== programmeIds.length) badRequest("One of the chosen programmes no longer exists.");
  }
  await db.update(courses).set({ level, semester: tags.semester, updatedAt: new Date() }).where(eq(courses.id, courseId));
  await db.delete(courseProgrammes).where(eq(courseProgrammes.courseId, courseId));
  if (programmeIds.length) {
    await db.insert(courseProgrammes).values(programmeIds.map((programmeId) => ({ courseId, programmeId })));
  }
  return { courseId, ...tags, programmeIds };
}

/** Active courses for a programme, level and semester, for the onboarding suggestions. */
export async function suggestedCourses(student: { programmeId: number; level: number; semester: string }) {
  const db = await database();
  const rows = await db
    .select({ id: courses.id, title: courses.title, code: courses.code, subject: courses.subject, level: courses.level, semester: courses.semester })
    .from(courses)
    .innerJoin(courseProgrammes, eq(courseProgrammes.courseId, courses.id))
    .where(and(eq(courseProgrammes.programmeId, student.programmeId), eq(courses.isActive, true)))
    .orderBy(asc(courses.title));
  return rows.filter((c) =>
    courseMatches({ programmeIds: [student.programmeId], level: c.level ?? null, semester: c.semester ?? null }, student)
  );
}

export type StudentAcademic = {
  studentNumber: string | null;
  programmeId: number | null;
  faculty: string | null;
  department: string | null;
  programme: string | null;
  level: string | null;
  semester: string | null;
  academicYear: string | null;
  status: string;
};

export async function academicFor(userIds: number[]): Promise<Map<number, StudentAcademic>> {
  if (!userIds.length) return new Map();
  const db = await database();
  const rows = await db.select().from(studentProfiles).where(inArray(studentProfiles.userId, userIds));
  return new Map(
    rows.map((r) => [
      r.userId,
      {
        studentNumber: r.studentNumber,
        programmeId: r.programmeId,
        faculty: r.faculty,
        department: r.department,
        programme: r.programme,
        level: r.academicLevel,
        semester: r.semester,
        academicYear: r.academicYear,
        status: r.academicStatus ?? "active",
      },
    ])
  );
}

/** Student ids matching a programme and/or level, for list filters. */
export async function studentIdsMatching(filter: { programmeId?: number; level?: number }) {
  const db = await database();
  const conditions = [];
  if (filter.programmeId) conditions.push(eq(studentProfiles.programmeId, filter.programmeId));
  if (filter.level) conditions.push(sql`cast(${studentProfiles.academicLevel} as integer) = ${filter.level}`);
  const rows = await db.select({ userId: studentProfiles.userId }).from(studentProfiles).where(and(...conditions));
  return rows.map((r) => r.userId);
}

/** Admin correction of a student's programme and level (students can't change these themselves). */
export async function setStudentAcademic(input: {
  userId: number;
  programmeId: number;
  level: number;
  semester?: string;
  academicYear?: string;
  status?: "active" | "completed";
  studentNumber?: string;
}) {
  const db = await database();
  const [user] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, input.userId)).limit(1);
  if (!user || user.role !== "user") badRequest("Programme and level can only be set for student accounts.");
  const programme = await programmeWithNames(input.programmeId);
  if (!programme) badRequest("Choose a programme from the list.");
  const level = assertLevel(input.level, programme.durationYears);
  if (input.semester !== undefined && !isSemester(input.semester)) badRequest("Choose the first or second semester.");
  if (input.academicYear !== undefined && !parseAcademicYear(input.academicYear)) badRequest("Choose an academic year like 2025/2026.");
  const values = {
    programmeId: programme.id,
    faculty: programme.faculty,
    department: programme.department,
    programme: programme.name,
    academicLevel: String(level),
    ...(input.semester !== undefined ? { semester: input.semester } : {}),
    ...(input.academicYear !== undefined ? { academicYear: input.academicYear.trim() } : {}),
    ...(input.status ? { academicStatus: input.status } : {}),
    ...(input.studentNumber?.trim() ? { studentNumber: input.studentNumber.trim() } : {}),
    updatedAt: new Date(),
  };
  const [existing] = await db.select({ userId: studentProfiles.userId }).from(studentProfiles).where(eq(studentProfiles.userId, input.userId)).limit(1);
  if (existing) {
    await db.update(studentProfiles).set(values).where(eq(studentProfiles.userId, input.userId));
  } else {
    await db.insert(studentProfiles).values({ userId: input.userId, onboardingRequired: true, onboardingStep: "academic", ...values });
  }
  return (await academicFor([input.userId])).get(input.userId)!;
}

type Plan = {
  current: Term;
  next: Term & { newYear: boolean };
  students: number;
  promoted: number;
  completed: number;
  notPromoted: number;
  updates: Array<{ userId: number; level?: string; completed?: boolean }>;
};

async function planNewTerm(current: Term): Promise<Plan> {
  const next = nextTerm(current);
  if (!next) badRequest("Set the current academic year in Settings as a range like 2025/2026 first.");
  const db = await database();
  const rows = await db
    .select({ userId: studentProfiles.userId, programmeId: studentProfiles.programmeId, level: studentProfiles.academicLevel, durationYears: programmes.durationYears })
    .from(studentProfiles)
    .innerJoin(users, eq(users.id, studentProfiles.userId))
    .leftJoin(programmes, eq(programmes.id, studentProfiles.programmeId))
    .where(and(eq(users.role, "user"), ne(studentProfiles.academicStatus, "completed"), isNotNull(studentProfiles.onboardingCompletedAt)));
  const plan: Plan = { current, next, students: rows.length, promoted: 0, completed: 0, notPromoted: 0, updates: [] };
  if (!next.newYear) return plan;
  for (const row of rows) {
    const level = parseLevel(row.level);
    if (!row.programmeId || !row.durationYears || !level) {
      plan.notPromoted += 1;
      continue;
    }
    const result = promote(level, row.durationYears);
    if (result.completed) {
      plan.completed += 1;
      plan.updates.push({ userId: row.userId, completed: true });
    } else {
      plan.promoted += 1;
      plan.updates.push({ userId: row.userId, level: String(result.level) });
    }
  }
  return plan;
}

export async function previewNewTerm(current: Term) {
  const { updates: _updates, ...summary } = await planNewTerm(current);
  return summary;
}

/** Moves every active student to the next semester; at a new academic year also promotes them a level. */
export async function startNewTerm(current: Term, expected: Term) {
  if (current.academicYear !== expected.academicYear || current.semester !== expected.semester) {
    throw new TRPCError({ code: "CONFLICT", message: `The term has already changed to ${current.semester} semester ${current.academicYear}. Refresh and check again.` });
  }
  const plan = await planNewTerm(current);
  const db = await database();
  const now = new Date();
  for (const update of plan.updates) {
    await db
      .update(studentProfiles)
      .set(update.completed ? { academicStatus: "completed", updatedAt: now } : { academicLevel: update.level, updatedAt: now })
      .where(eq(studentProfiles.userId, update.userId));
  }
  // Runs after completions so graduating students keep their final term.
  await db.run(sql`
    UPDATE studentProfiles SET semester = ${plan.next.semester}, academicYear = ${plan.next.academicYear}, updatedAt = ${now.getTime()}
    WHERE academicStatus != 'completed' AND onboardingCompletedAt IS NOT NULL
      AND userId IN (SELECT id FROM users WHERE role = 'user')
  `);
  const { updates: _updates, ...summary } = plan;
  return summary;
}
