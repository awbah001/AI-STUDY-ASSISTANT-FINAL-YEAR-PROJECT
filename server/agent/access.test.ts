import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../../drizzle/schema";

vi.mock("../lecturerQueries", () => ({
  getCourseById: vi.fn(),
  getCourseOwnedBy: vi.fn(),
  isStudentEnrolled: vi.fn(),
  getStudentEnrolledCourses: vi.fn(),
}));

vi.mock("../queries", () => ({
  getDocumentById: vi.fn(),
}));

vi.mock("../documentAccess", () => ({
  canAccessDocument: vi.fn(),
}));

import * as lecturerQueries from "../lecturerQueries";
import * as queries from "../queries";
import { canAccessDocument } from "../documentAccess";
import { assertCourseAccess, assertDocumentToolAccess, resolveCourseFromMessage } from "./access";

const student = { id: 7, role: "user" } as User;
const lecturer = { id: 3, role: "lecturer" } as User;
const admin = { id: 1, role: "admin" } as User;

describe("agent access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects students who are not enrolled", async () => {
    vi.mocked(lecturerQueries.isStudentEnrolled).mockResolvedValue(false);
    await expect(assertCourseAccess(student, 4)).rejects.toThrow("You are not enrolled in this course.");
  });

  it("allows enrolled students", async () => {
    vi.mocked(lecturerQueries.isStudentEnrolled).mockResolvedValue(true);
    await expect(assertCourseAccess(student, 4)).resolves.toBeUndefined();
  });

  it("allows admins when the course exists", async () => {
    vi.mocked(lecturerQueries.getCourseById).mockResolvedValue({ id: 4, lecturerId: 3 } as never);
    await expect(assertCourseAccess(admin, 4)).resolves.toBeUndefined();
  });

  it("rejects lecturers who do not own the course", async () => {
    vi.mocked(lecturerQueries.getCourseOwnedBy).mockResolvedValue(undefined);
    await expect(assertCourseAccess(lecturer, 4)).rejects.toThrow("You do not have access to this course.");
  });

  it("rejects unauthorized documents", async () => {
    vi.mocked(queries.getDocumentById).mockResolvedValue({ id: 9, userId: 99 } as never);
    vi.mocked(canAccessDocument).mockResolvedValue(false);
    await expect(assertDocumentToolAccess(student, 9)).rejects.toThrow("You do not have access to this material.");
  });

  it("resolves a course code mentioned in the message", async () => {
    vi.mocked(lecturerQueries.getStudentEnrolledCourses).mockResolvedValue([
      { id: 2, code: "CSC 302", title: "Databases", subject: "CS" },
    ] as never);
    await expect(resolveCourseFromMessage(student, "using my CSC 302 materials")).resolves.toBe(2);
  });
});
