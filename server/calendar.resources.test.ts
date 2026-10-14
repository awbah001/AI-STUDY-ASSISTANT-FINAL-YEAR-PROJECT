import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fallbackCalendarDrafts, proposeCalendarDrafts, extractPlanSubject, formatStudyPlanReply, timetableAssumptions, timetablePresentation } from "./calendar";
import { generateAgentText } from "./agent/llmProvider";
vi.mock("./agent/llmProvider", () => ({ generateAgentText: vi.fn() }));
const now = Date.UTC(2026, 9, 13, 10);
const materials = [{ id: 7, title: "Computer Networking — Week 1", text: "OSI model\nThe OSI model has seven layers.\nIP addressing\nIP addresses identify network interfaces.\nRouting tables\nRouters choose paths using routing tables.\nNetwork protocols\nProtocols define communication rules." }];
beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now); });
afterEach(() => vi.useRealTimers());

describe("resource-based study timetables", () => {
  it("uses document topics without creating an assessment", () => {
    const events = fallbackCalendarDrafts("generate a study timetable for the resources provided", now, { subject: "Computer Networking", materials });
    expect(events).toHaveLength(4);
    expect(events.every(event => event.type === "study")).toBe(true);
    expect(events.map(event => event.title).join(" ")).toContain("OSI model");
    expect(events.map(event => event.title).join(" ")).toContain("IP addressing");
    expect(events.map(event => event.notes).join(" ")).not.toMatch(/\bexam\b/i);
    expect(events[0].startsAt).toBe("2026-10-14T18:00:00.000Z");
    expect(events[0].endsAt).toBe("2026-10-14T19:00:00.000Z");
  });
  it("does not use resource request wording as a subject", () => {
    expect(extractPlanSubject("generate a study timetable for the resources provided")).toBe("Study materials");
    expect(extractPlanSubject("Create a timetable for my GIS exam next week")).toBe("GIS");
  });
  it("keeps assessment preparation undated unless calendar dates were requested", () => {
    expect(fallbackCalendarDrafts("Create a timetable for my Networking exam", now).every(event => event.type === "study")).toBe(true);
    expect(fallbackCalendarDrafts("Create a timetable with dates for my Networking exam", now)).toEqual([]);
    expect(fallbackCalendarDrafts("Create a timetable for my Networking exam on 2026-10-25", now).some(event => event.type === "exam")).toBe(true);
  });
  it("treats a study start date as a start date, not an exam", () => {
    const events = fallbackCalendarDrafts("Create a 3-day timetable starting on 2026-10-16 at 7pm", now, { materials });
    expect(events).toHaveLength(3);
    expect(events[0].startsAt).toBe("2026-10-16T19:00:00.000Z");
    expect(events.every(event => event.type === "study")).toBe(true);
  });
  it("shows sessions and topics without unrequested days, dates, or times", () => {
    const request = "Make a timetable for my resources";
    const reply = formatStudyPlanReply(fallbackCalendarDrafts(request, now, { materials }), timetableAssumptions(request), timetablePresentation(request));
    expect(reply).toContain("| Session | Topic | What to do |");
    expect(reply).not.toContain("Date");
    expect(reply).not.toContain("18:00");
    expect(reply).not.toContain("tomorrow");
    expect(reply).not.toContain("Saved to");
    expect(reply).not.toMatch(/\bexam\b/i);
  });
  it("shows relative days but no calendar dates for a 5-day request", () => {
    const request = "Create a 5-day study timetable for my resources";
    const reply = formatStudyPlanReply(fallbackCalendarDrafts(request, now, { materials }), [], timetablePresentation(request));
    expect(reply).toContain("| Day | Topic | What to do |");
    expect(reply).toContain("Day 5 of 5");
    expect(reply).not.toContain("| Date |");
    expect(timetablePresentation(request).saved).toBe(false);
  });
  it("includes dates and times when specifically requested", () => {
    const request = "Create a timetable starting tomorrow at 7pm";
    const reply = formatStudyPlanReply(fallbackCalendarDrafts(request, now, { materials }), [], timetablePresentation(request));
    expect(reply).toContain("| Day | Date | Time | Topic | What to do |");
    expect(reply).toContain("19:00");
  });
  it("provides source-grounded fallback sessions if the model fails", async () => {
    vi.mocked(generateAgentText).mockRejectedValue(new Error("Provider unavailable"));
    const events = await proposeCalendarDrafts("Plan my resources", "", { materials });
    expect(events.every(event => event.type === "study")).toBe(true);
    expect(events[0].title).toContain("OSI model");
  });
  it("only accepts refinements whose topics occur in an authorized material", async () => {
    vi.mocked(generateAgentText).mockResolvedValue({ provider: "groq", text: JSON.stringify({ sessions: [
      { slot: 0, materialId: 7, topic: "OSI model", notes: "Compare the functions of its seven layers." },
      { slot: 1, materialId: 999, topic: "Nuclear physics", notes: "Study a different course." },
      { slot: 2, materialId: 7, topic: "Invented topic", notes: "Prepare for your invented exam." },
    ], events: [{ type: "exam", startsAt: "2026-10-18T09:00:00Z" }] }) });
    const events = await proposeCalendarDrafts("Plan my resources", "", { materials });
    expect(events[0].title).toBe("OSI model");
    expect(events[0].notes).toContain("seven layers");
    expect(events[1].title).toContain("IP addressing");
    expect(events.every(event => event.type === "study")).toBe(true);
    expect(events[0].startsAt).toBe("2026-10-14T18:00:00.000Z");
    expect(vi.mocked(generateAgentText).mock.calls[0][0][1].content).toContain("IP addresses identify network interfaces");
  });
  it("does not duplicate the last study slot when refining a plan without an exam", async () => {
    vi.mocked(generateAgentText).mockResolvedValue({ provider: "groq", text: JSON.stringify({ events: [
      { title: "Networking foundations", type: "study", startsAt: "2026-10-14T18:00:00Z", notes: "Read notes." },
      { title: "Networking practice", type: "study", startsAt: "2026-10-15T18:00:00Z", notes: "Practice." },
      { title: "Fabricated exam", type: "exam", startsAt: "2026-10-18T09:00:00Z" },
    ] }) });
    const events = await proposeCalendarDrafts("Make a 4-day study timetable for Networking");
    expect(events).toHaveLength(4);
    expect(events.every(event => event.type === "study")).toBe(true);
  });
});
