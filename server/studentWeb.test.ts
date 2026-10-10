import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import {
  router,
  studentProcedure,
  adminProcedure,
  lecturerProcedure,
} from "./_core/trpc";
import type { TrpcContext } from "./_core/context";
import { getDashboardPathForRole } from "../shared/const";
import * as db from "./db";
import { beginStudentOnboarding } from "./studentLearningRouter";
import { verifyGoogleIdToken } from "./_core/googleAuth";

vi.mock("./db", () => ({
  getUserByOpenId: vi.fn(),
  getUserByEmail: vi.fn(),
  createUser: vi.fn(),
  upsertUser: vi.fn(),
  updateUserByOpenId: vi.fn(),
}));
vi.mock("./_core/env", () => ({ ENV: { googleClientIds: ["test-client"] } }));
vi.mock("./_core/sdk", () => ({
  sdk: { createSessionToken: vi.fn().mockResolvedValue("session-token") },
}));
vi.mock("./_core/googleAuth", () => ({
  googleOpenId: (sub: string) => `google:${sub}`,
  verifyGoogleIdToken: vi.fn(),
}));
vi.mock("./studentLearningRouter", async importOriginal => {
  const actual =
    await importOriginal<typeof import("./studentLearningRouter")>();
  return { ...actual, beginStudentOnboarding: vi.fn() };
});
vi.mock("./settings", () => ({
  isMaintenanceMode: vi.fn().mockResolvedValue(false),
  getPasswordMinLength: vi.fn().mockResolvedValue(8),
  getFeatureFlags: vi.fn(),
}));

const student = {
  id: 1,
  openId: "google:student",
  name: "Student",
  email: "student@central.edu.sl",
  role: "user",
  avatarUrl: "avatar",
  isBanned: false,
  tokenVersion: 0,
} as NonNullable<TrpcContext["user"]>;
function context(user: TrpcContext["user"] = null): TrpcContext {
  return {
    user,
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getUserByOpenId).mockResolvedValue(student);
  vi.mocked(db.getUserByEmail).mockResolvedValue(undefined);
  vi.mocked(verifyGoogleIdToken).mockResolvedValue({
    sub: "student",
    email: student.email!,
    name: student.name!,
    picture: "avatar",
  });
});

describe("student web authentication", () => {
  it("signs an existing student in with Google on the web", async () => {
    const result = await appRouter
      .createCaller(context())
      .auth.google({ idToken: "verified-test-token-value", client: "web" });
    expect(result.user.role).toBe("user");
    expect(result.token).toBe("session-token");
  });
  it("creates a student account on first Google sign-in for institution emails", async () => {
    vi.mocked(db.getUserByOpenId).mockResolvedValue(undefined);
    vi.mocked(db.createUser).mockResolvedValue({ ...student, id: 42 });
    const result = await appRouter
      .createCaller(context())
      .auth.google({ idToken: "verified-test-token-value", client: "mobile" });
    expect(db.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        openId: "google:student",
        email: "student@central.edu.sl",
        role: "user",
        loginMethod: "google",
      })
    );
    expect(beginStudentOnboarding).toHaveBeenCalledWith(42);
    expect(result.user.role).toBe("user");
  });
  it("refuses Google sign-in for emails outside the institution domain", async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({
      sub: "outsider",
      email: "someone@gmail.com",
      name: "Outsider",
      picture: null,
    });
    for (const client of ["web", "mobile"] as const) {
      await expect(
        appRouter
          .createCaller(context())
          .auth.google({ idToken: "verified-test-token-value", client })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(db.getUserByOpenId).not.toHaveBeenCalled();
    expect(db.createUser).not.toHaveBeenCalled();
  });
  it("refuses password sign-in for emails outside the institution domain", async () => {
    await expect(
      appRouter
        .createCaller(context())
        .auth.login({ email: "someone@gmail.com", password: "whatever-password" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.getUserByEmail).not.toHaveBeenCalled();
  });
  it("has no public self-registration endpoints", () => {
    const procedures = Object.keys(appRouter._def.procedures);
    expect(procedures).not.toContain("auth.signup");
    expect(procedures).not.toContain("lecturer.signup");
  });
  it("still denies a suspended student", async () => {
    vi.mocked(db.getUserByOpenId).mockResolvedValue({
      ...student,
      isBanned: true,
    });
    await expect(
      appRouter
        .createCaller(context())
        .auth.google({ idToken: "verified-test-token-value", client: "web" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("allows staff Google sign-in on both web and mobile", async () => {
    vi.mocked(db.getUserByOpenId).mockResolvedValue({
      ...student,
      role: "lecturer",
    });
    for (const client of ["web", "mobile"] as const) {
      expect(
        (
          await appRouter
            .createCaller(context())
            .auth.google({ idToken: "verified-test-token-value", client })
        ).user.role
      ).toBe("lecturer");
    }
  });
  it("routes each role to its workspace", () => {
    expect(getDashboardPathForRole("user")).toBe("/student/dashboard");
    expect(getDashboardPathForRole("lecturer")).toBe("/lecturer/dashboard");
    expect(getDashboardPathForRole("admin")).toBe("/admin");
  });
});

describe("role boundaries across platforms", () => {
  const protectedRouter = router({
    student: studentProcedure.query(() => "student"),
    admin: adminProcedure.query(() => "admin"),
    lecturer: lecturerProcedure.query(() => "lecturer"),
  });
  it("allows students to learn but denies staff procedures", async () => {
    const caller = protectedRouter.createCaller(context(student));
    expect(await caller.student()).toBe("student");
    await expect(caller.admin()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.lecturer()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("requires authentication for student APIs", async () => {
    await expect(
      protectedRouter.createCaller(context()).student()
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it.each(["admin", "lecturer"] as const)(
    "denies %s access to student-only APIs",
    async role => {
      await expect(
        protectedRouter.createCaller(context({ ...student, role })).student()
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  );
});
