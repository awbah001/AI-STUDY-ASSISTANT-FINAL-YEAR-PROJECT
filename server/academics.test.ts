import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { getDb } from "./db";
import { runStudentLearningMigration } from "./migrations/addStudentLearning";
import { runAcademicStructureMigration } from "./migrations/addAcademicStructure";
import { studentLearningRouter } from "./studentLearningRouter";
import * as academics from "./academics";
import type { TrpcContext } from "./_core/context";
import {
  academicYearOptions,
  courseMatches,
  levelLabel,
  levelsFor,
  nextTerm,
  parseLevel,
  promote,
  yearsForProgrammes,
} from "../shared/academics";

vi.mock("./db", () => ({ getDb: vi.fn() }));
vi.mock("./settings", () => ({ isMaintenanceMode: vi.fn().mockResolvedValue(false) }));
vi.mock("./lecturerQueries", () => ({
  getStudentEnrolledCourses: vi.fn().mockResolvedValue([]),
  listActiveCourseCatalog: vi.fn().mockResolvedValue([]),
  enrollStudentInCourses: vi.fn(async (_id: number, ids: number[]) => ids),
}));

describe("academic helpers", () => {
  it("lists levels for a programme's length", () => {
    expect(levelsFor(4)).toEqual([1, 2, 3, 4]);
    expect(levelsFor(0)).toEqual([1]);
  });

  it("reads years, including the older 100-per-year levels", () => {
    expect(parseLevel("3")).toBe(3);
    expect(parseLevel("Year 3")).toBe(3);
    expect(parseLevel("Level 2")).toBe(2);
    expect(parseLevel("300")).toBe(3);
    expect(parseLevel("Level 200")).toBe(2);
    expect(parseLevel(400)).toBe(4);
    expect(parseLevel("250")).toBeNull();
    expect(parseLevel("Year 8")).toBeNull();
    expect(parseLevel("0")).toBeNull();
    expect(levelLabel(2)).toBe("Year 2");
    expect(levelLabel("300")).toBe("Year 3");
  });

  it("moves from first to second semester, then to the next academic year", () => {
    expect(nextTerm({ academicYear: "2025/2026", semester: "First" })).toEqual({
      academicYear: "2025/2026",
      semester: "Second",
      newYear: false,
    });
    expect(nextTerm({ academicYear: "2025/2026", semester: "Second" })).toEqual({
      academicYear: "2026/2027",
      semester: "First",
      newYear: true,
    });
    expect(nextTerm({ academicYear: "2025", semester: "First" })).toBeNull();
  });

  it("offers course years up to the longest relevant programme, or four by default", () => {
    const programme = (id: number, durationYears: number) => ({ id, name: `P${id}`, durationYears, isActive: true });
    const faculties = [{ id: 1, name: "F", departments: [{ id: 1, name: "D", programmes: [programme(1, 3), programme(2, 6)] }] }];
    expect(yearsForProgrammes([])).toEqual([1, 2, 3, 4]);
    expect(yearsForProgrammes(faculties)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(yearsForProgrammes(faculties, [1])).toEqual([1, 2, 3]);
  });

  it("promotes a year or marks the programme complete", () => {
    expect(promote(3, 4)).toEqual({ level: 4, completed: false });
    expect(promote(4, 4)).toEqual({ level: 4, completed: true });
  });

  it("offers the previous, current and next academic year", () => {
    expect(academicYearOptions("2025/2026")).toEqual(["2024/2025", "2025/2026", "2026/2027"]);
  });

  it("matches courses by programme and, when set, level and semester", () => {
    const student = { programmeId: 1, level: 3, semester: "First" };
    expect(courseMatches({ programmeIds: [1, 2], level: null, semester: null }, student)).toBe(true);
    expect(courseMatches({ programmeIds: [1], level: 3, semester: "First" }, student)).toBe(true);
    expect(courseMatches({ programmeIds: [1], level: 2, semester: "First" }, student)).toBe(false);
    expect(courseMatches({ programmeIds: [1], level: 3, semester: "Second" }, student)).toBe(false);
    expect(courseMatches({ programmeIds: [2], level: null, semester: null }, student)).toBe(false);
  });
});

describe("programmes, profile setup and new semester", () => {
  let client: Client;
  const caller = (id: number) =>
    studentLearningRouter.createCaller({
      user: { id, name: "Student", role: "user" },
      req: { headers: {} },
      res: {},
    } as TrpcContext);

  beforeEach(async () => {
    client = createClient({ url: "file::memory:" });
    vi.mocked(getDb).mockResolvedValue(drizzle(client) as Awaited<ReturnType<typeof getDb>>);
    await client.execute("CREATE TABLE users (id integer PRIMARY KEY, name text, role text NOT NULL)");
    await client.execute(`CREATE TABLE courses (id integer PRIMARY KEY, lecturerId integer, title text NOT NULL, code text NOT NULL,
      subject text, description text, isActive integer NOT NULL DEFAULT 1, createdAt integer, updatedAt integer)`);
    await runStudentLearningMigration(client);
    await runAcademicStructureMigration(client);
  });
  afterEach(() => client.close());

  async function seedProgramme() {
    const faculty = await academics.saveFaculty({ name: "Technology & Engineering" });
    const department = await academics.saveDepartment({ facultyId: faculty.id, name: "Computer Science" });
    return academics.saveProgramme({ departmentId: department.id, name: "BSc Computer Science", durationYears: 4, isActive: true });
  }

  const base = { studentNumber: "S1", academicLevel: "3", semester: "First", academicYear: "2025/2026" };

  it("rejects duplicate names regardless of case", async () => {
    await academics.saveFaculty({ name: "Science" });
    await expect(academics.saveFaculty({ name: "science" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("fills names from the chosen programme and only enrols in matching courses", async () => {
    const programme = await seedProgramme();
    await client.execute("INSERT INTO users (id, name, role) VALUES (1, 'Ada', 'user')");
    await client.execute("INSERT INTO courses (id, title, code) VALUES (10, 'Algorithms', 'CS301'), (11, 'Databases', 'CS201')");
    await academics.setCourseTags(10, { programmeIds: [programme.id], level: 3, semester: "First" });
    await academics.setCourseTags(11, { programmeIds: [programme.id], level: 2, semester: null });

    const result = await caller(1).completeProfileSetup({ ...base, programmeId: programme.id, courseIds: [10, 11] });
    expect(result.enrolled).toEqual([10]);
    const status = await caller(1).onboardingStatus();
    expect(status.completed).toBe(true);
    expect(status.profile).toMatchObject({
      faculty: "Technology & Engineering",
      department: "Computer Science",
      programme: "BSc Computer Science",
      programmeId: programme.id,
      academicLevel: "3",
    });
  });

  it("requires a listed programme once programmes exist, and a level within its length", async () => {
    const programme = await seedProgramme();
    await expect(
      caller(1).completeProfileSetup({ ...base, faculty: "Typed", department: "Typed", programme: "Typed" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller(1).completeProfileSetup({ ...base, programmeId: programme.id, academicLevel: "5" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("starts a new academic year: promotes, completes final-year students and leaves unlisted ones", async () => {
    const programme = await seedProgramme();
    await client.execute("INSERT INTO users (id, name, role) VALUES (1, 'A', 'user'), (2, 'B', 'user'), (3, 'C', 'user'), (4, 'L', 'lecturer')");
    await client.execute(`INSERT INTO studentProfiles (userId, programmeId, academicLevel, semester, academicYear, onboardingCompletedAt, onboardingStep, onboardingRequired, updatedAt)
      VALUES (1, ${programme.id}, '3', 'Second', '2025/2026', 1, 'done', 0, 1),
             (2, ${programme.id}, '4', 'Second', '2025/2026', 1, 'done', 0, 1),
             (3, NULL, 'Year 3', '2', '2023', 1, 'done', 0, 1)`);
    const term = { academicYear: "2025/2026", semester: "Second" };

    const preview = await academics.previewNewTerm(term);
    expect(preview).toMatchObject({ students: 3, promoted: 1, completed: 1, notPromoted: 1, next: { academicYear: "2026/2027", semester: "First" } });

    await academics.startNewTerm(term, term);
    const rows = (await client.execute("SELECT userId, academicLevel, semester, academicYear, academicStatus FROM studentProfiles ORDER BY userId")).rows;
    expect(rows.map((r) => ({ ...r }))).toEqual([
      { userId: 1, academicLevel: "4", semester: "First", academicYear: "2026/2027", academicStatus: "active" },
      { userId: 2, academicLevel: "4", semester: "Second", academicYear: "2025/2026", academicStatus: "completed" },
      { userId: 3, academicLevel: "Year 3", semester: "First", academicYear: "2026/2027", academicStatus: "active" },
    ]);
    await expect(academics.startNewTerm({ academicYear: "2026/2027", semester: "First" }, term)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("won't delete a programme that students are in", async () => {
    const programme = await seedProgramme();
    await client.execute("INSERT INTO users (id, name, role) VALUES (1, 'A', 'user')");
    await academics.setStudentAcademic({ userId: 1, programmeId: programme.id, level: 2 });
    await expect(academics.deleteCatalogueItem("programme", programme.id)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("converts levels saved as 100, 200, ... into years when the server starts", async () => {
    await client.execute("INSERT INTO courses (id, title, code, level) VALUES (10, 'Algorithms', 'CS301', 300), (11, 'Intro', 'CS101', 1)");
    await client.execute(`INSERT INTO studentProfiles (userId, academicLevel, onboardingStep, onboardingRequired, updatedAt)
      VALUES (1, '200', 'done', 0, 1), (2, 'Level 400', 'done', 0, 1), (3, 'Year 3', 'done', 0, 1), (4, 'Final year', 'done', 0, 1)`);
    await runAcademicStructureMigration(client);
    await runAcademicStructureMigration(client);
    const courseLevels = (await client.execute("SELECT level FROM courses ORDER BY id")).rows.map((r) => r.level);
    const studentLevels = (await client.execute("SELECT academicLevel FROM studentProfiles ORDER BY userId")).rows.map((r) => r.academicLevel);
    expect(courseLevels).toEqual([3, 1]);
    expect(studentLevels).toEqual(["2", "4", "3", "Final year"]);
  });
});
