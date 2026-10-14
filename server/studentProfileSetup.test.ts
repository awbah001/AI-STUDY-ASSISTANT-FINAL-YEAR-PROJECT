import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { getDb } from "./db";
import { studentLearningRouter } from "./studentLearningRouter";
import { runStudentLearningMigration } from "./migrations/addStudentLearning";
import { runAcademicStructureMigration } from "./migrations/addAcademicStructure";
import type { TrpcContext } from "./_core/context";
import { ACADEMIC_PROFILE_FIELDS } from "../shared/studentLearning";

vi.mock("./db", () => ({ getDb: vi.fn() }));
vi.mock("./settings", () => ({
  isMaintenanceMode: vi.fn().mockResolvedValue(false),
}));
vi.mock("./lecturerQueries", () => ({
  getStudentEnrolledCourses: vi.fn().mockResolvedValue([]),
  listActiveCourseCatalog: vi.fn().mockResolvedValue([]),
}));

const details = {
  studentNumber: " 001234 ",
  faculty: "Science",
  department: "Computing",
  programme: "BSc Computer Science",
  academicLevel: "200",
  semester: "First",
  academicYear: "2026/2027",
};
const caller = (id = 1, role = "user") =>
  studentLearningRouter.createCaller({
    user: { id, name: "Student", role },
    req: { headers: {} },
    res: {},
  } as TrpcContext);

describe("required student profile setup", () => {
  let client: Client;
  beforeEach(async () => {
    client = createClient({ url: "file::memory:" });
    vi.mocked(getDb).mockResolvedValue(
      drizzle(client) as Awaited<ReturnType<typeof getDb>>
    );
    await runStudentLearningMigration(client);
    await runAcademicStructureMigration(client);
  });
  afterEach(() => client.close());

  it("requires setup for an account with no profile, including admin-created students", async () => {
    expect((await caller().onboardingStatus()).completed).toBe(false);
    await runStudentLearningMigration(client);
    expect((await caller().onboardingStatus()).completed).toBe(false);
  });

  it.each(ACADEMIC_PROFILE_FIELDS)(
    "rejects a blank $label without completing setup",
    async ({ key }) => {
      await expect(
        caller().completeProfileSetup({ ...details, [key]: "   " })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect((await caller().onboardingStatus()).completed).toBe(false);
    }
  );

  it("saves trimmed academic details and skips setup on later visits", async () => {
    await caller().completeProfileSetup(details);
    await runStudentLearningMigration(client);
    const result = await caller().onboardingStatus();
    expect(result.completed).toBe(true);
    expect(result.profile).toMatchObject({
      ...details,
      studentNumber: "001234",
    });
    expect((await caller(2).onboardingStatus()).completed).toBe(false);
  });

  it("prevents the old completion endpoint from bypassing required fields", async () => {
    await expect(caller().completeOnboarding()).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect((await caller().onboardingStatus()).completed).toBe(false);
  });

  it("requires incomplete profiles that were previously marked as skipped to be filled in", async () => {
    await caller().onboardingStatus();
    await client.execute(
      "UPDATE studentProfiles SET onboardingRequired = 0, onboardingCompletedAt = 1"
    );
    expect((await caller().onboardingStatus()).completed).toBe(false);
    await caller().completeProfileSetup(details);
    expect((await caller().onboardingStatus()).completed).toBe(true);
  });

  it("adds student ID to an existing database without losing academic details", async () => {
    await client.execute("DROP TABLE studentProfiles");
    await client.execute(
      "CREATE TABLE studentProfiles (userId integer PRIMARY KEY, faculty text)"
    );
    await client.execute(
      "INSERT INTO studentProfiles (userId, faculty) VALUES (1, 'Science')"
    );
    await runStudentLearningMigration(client);
    await runStudentLearningMigration(client);
    const result = await client.execute(
      "SELECT faculty, studentNumber FROM studentProfiles WHERE userId = 1"
    );
    expect(result.rows[0]).toMatchObject({
      faculty: "Science",
      studentNumber: null,
    });
  });

  it("limits profile setup to authenticated students", async () => {
    await expect(
      caller(1, "lecturer").completeProfileSetup(details)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
