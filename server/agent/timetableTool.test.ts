import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeAgentTool } from "./tools";
import * as calendar from "../calendar";
import * as queries from "../queries";
import * as lecturerQueries from "../lecturerQueries";
import { assertDocumentToolAccess } from "./access";
import type { User } from "../../drizzle/schema";

vi.mock("./access", () => ({ assertCourseAccess: vi.fn(), assertDocumentToolAccess: vi.fn() }));
vi.mock("../lecturerQueries", () => ({ getStudentEnrolledCourses: vi.fn(), getCourseById: vi.fn(), getCourseAssignments: vi.fn(), getStudentCourseDocuments: vi.fn() }));
vi.mock("../queries", () => ({ getUserDocuments: vi.fn() }));
vi.mock("../calendar", async importOriginal => ({ ...await importOriginal<typeof import("../calendar")>(), proposeCalendarDrafts: vi.fn(), insertCalendarEvents: vi.fn() }));
const user = { id: 3, role: "user" } as User;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(lecturerQueries.getStudentEnrolledCourses).mockResolvedValue([{ id: 2, title: "Computer Networking", code: "NET101" }] as Awaited<ReturnType<typeof lecturerQueries.getStudentEnrolledCourses>>);
  vi.mocked(lecturerQueries.getCourseById).mockResolvedValue({ id: 2, lecturerId: 4, title: "Computer Networking" } as Awaited<ReturnType<typeof lecturerQueries.getCourseById>>);
  vi.mocked(lecturerQueries.getCourseAssignments).mockResolvedValue([{ title: "Upcoming assignment", dueDate: new Date(Date.now() + 7 * 86400_000) }] as Awaited<ReturnType<typeof lecturerQueries.getCourseAssignments>>);
  vi.mocked(lecturerQueries.getStudentCourseDocuments).mockResolvedValue([{ id: 7, title: "Week 1" }] as Awaited<ReturnType<typeof lecturerQueries.getStudentCourseDocuments>>);
  vi.mocked(assertDocumentToolAccess).mockResolvedValue({ id: 7, title: "Week 1", courseId: 2, extractedText: "OSI model\nThe OSI model has seven layers." } as Awaited<ReturnType<typeof assertDocumentToolAccess>>);
  vi.mocked(calendar.proposeCalendarDrafts).mockResolvedValue([{ title: "OSI model", type: "study", startsAt: new Date(Date.now() + 86400_000).toISOString() }]);
  vi.mocked(calendar.insertCalendarEvents).mockResolvedValue([]);
  vi.mocked(queries.getUserDocuments).mockResolvedValue([]);
});
describe("timetable tool grounding", () => {
  it("uses the original request and authorized resource contents, not a model-invented exam", async () => {
    const original = "generate a study timetable for the resources provided";
    const result = await executeAgentTool("createStudyTimetable", { user, requestMessage: original }, { message: "Create a timetable for the Networking exam next week" });
    expect(result.ok).toBe(true);
    expect(calendar.proposeCalendarDrafts).toHaveBeenCalledWith(original, expect.any(String), {
      subject: "Computer Networking", materials: [{ id: 7, title: "Week 1", text: "OSI model\nThe OSI model has seven layers." }],
    });
    expect(vi.mocked(calendar.proposeCalendarDrafts).mock.calls[0][0]).not.toContain("assignment");
  });
  it("asks which resources to use when several courses are available and none was selected", async () => {
    vi.mocked(lecturerQueries.getStudentEnrolledCourses).mockResolvedValue([{ id: 2, title: "Networking" }, { id: 3, title: "Accounting" }] as Awaited<ReturnType<typeof lecturerQueries.getStudentEnrolledCourses>>);
    const result = await executeAgentTool("createStudyTimetable", { user, requestMessage: "Plan the resources provided" }, { message: "Plan the resources provided", courseId: 2 });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Which resources");
    expect(calendar.insertCalendarEvents).not.toHaveBeenCalled();
  });
  it("uses only the active document for a document-specific timetable", async () => {
    await executeAgentTool("createStudyTimetable", { user, documentId: 7, requestMessage: "Plan my notes" }, { message: "Plan my notes" });
    expect(calendar.proposeCalendarDrafts).toHaveBeenCalledWith("Plan my notes", expect.any(String), expect.objectContaining({ materials: [expect.objectContaining({ id: 7, text: expect.stringContaining("OSI model") })] }));
  });
  it("does not claim to save a plan when the assessment date is missing", async () => {
    vi.mocked(calendar.proposeCalendarDrafts).mockResolvedValue([]);
    const result = await executeAgentTool("createStudyTimetable", { user }, { message: "Plan with dates for my exam" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("What date");
    expect(calendar.insertCalendarEvents).not.toHaveBeenCalled();
  });
  it("does not bypass grounding when the model chooses the generic calendar save tool", async () => {
    const original = "generate a study timetable for the resources provided";
    await executeAgentTool("saveCalendarPlan", { user, requestMessage: original }, { events: [{ title: "Invented exam", type: "exam", startsAt: "2026-10-18T09:00:00Z" }] });
    expect(calendar.proposeCalendarDrafts).toHaveBeenCalledWith(original, expect.any(String), expect.objectContaining({ materials: [expect.objectContaining({ id: 7 })] }));
    expect(calendar.insertCalendarEvents).not.toHaveBeenCalled();
  });
  it("keeps general study timetables unscheduled", async () => {
    const result = await executeAgentTool("createStudyTimetable", { user }, { message: "Create a timetable for my resources" });
    expect(result.data).toMatchObject({ created: 0, presentation: { showDays: false, showDates: false, showTimes: false, saved: false } });
    expect(calendar.insertCalendarEvents).not.toHaveBeenCalled();
  });
});
