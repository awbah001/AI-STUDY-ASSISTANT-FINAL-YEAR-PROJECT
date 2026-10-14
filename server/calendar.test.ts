import { describe, expect, it } from "vitest";
import {
  extractPlanSubject,
  fallbackCalendarDrafts,
  formatStudyPlanReply,
  normalizeExtractedPlan,
  parseCalendarEventDrafts,
  resolvePlanDay,
} from "./calendar";
import { fromLocalParts, looksLikeStudyPlan, PLAN_SAVED_PATTERN, planSessionError, toLocalParts } from "../shared/studyPlan";

describe("parseCalendarEventDrafts", () => {
  it("accepts ISO events and drops far-past dates", () => {
    const now = Date.parse("2026-09-16T10:00:00.000Z");
    const events = parseCalendarEventDrafts(
      {
        events: [
          {
            title: "GIS exam",
            type: "exam",
            startsAt: "2026-09-20T09:00:00.000Z",
            reminderMinutes: 1440,
          },
          {
            title: "Ancient",
            type: "study",
            startsAt: "2020-01-01T09:00:00.000Z",
          },
        ],
      },
      now
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe("GIS exam");
    expect(events[0]?.type).toBe("exam");
  });
});

describe("fallbackCalendarDrafts", () => {
  it("adds study blocks before an exam", () => {
    const now = Date.parse("2026-09-16T10:00:00.000Z");
    const events = fallbackCalendarDrafts("Create a plan for my GIS exam next week", now);
    expect(events.length).toBeGreaterThan(1);
    expect(events.some((e) => e.type === "exam")).toBe(true);
    expect(events.some((e) => e.type === "study")).toBe(true);
  });

  it("uses an explicit date from the student request", () => {
    const now = Date.parse("2026-09-16T10:00:00.000Z");
    const events = fallbackCalendarDrafts(
      "Create a study plan for my Artificial Intelligence exam on the 25 September at 9am",
      now
    );
    const exam = events.find((e) => e.type === "exam");
    expect(exam).toBeTruthy();
    expect(new Date(exam!.startsAt).getDate()).toBe(25);
    expect(new Date(exam!.startsAt).getMonth()).toBe(8);
    expect(events.length).toBeGreaterThan(1);
  });

  it("builds distinct daily sessions for a 5-day request", () => {
    const now = Date.parse("2026-09-16T10:00:00.000Z");
    const events = fallbackCalendarDrafts(
      "Create a 5-day study plan for my GIS exam on 25 September at 9am",
      now
    );
    const studies = events.filter((e) => e.type === "study");
    expect(studies.length).toBe(5);
    expect(new Set(studies.map((e) => e.title)).size).toBe(5);
    expect(studies[0]?.title).toMatch(/Foundations/i);
    expect(events.some((e) => e.type === "exam")).toBe(true);
    expect(studies[0]?.notes).toMatch(/^Day 1 of 5:/);
    expect(studies[studies.length - 1]?.notes).toMatch(/^Day 5 of 5:/);
  });
});

describe("extractPlanSubject", () => {
  it("extracts subject from for-my-course phrasing", () => {
    expect(extractPlanSubject("Create a study timetable for my GIS course")).toMatch(/GIS/i);
    expect(
      extractPlanSubject("Create a 5-day study plan for Artificial Intelligence exam on 25 September")
    ).toMatch(/Artificial Intelligence/i);
  });
});

describe("formatStudyPlanReply", () => {
  it("numbers sessions in chronological order even if the input is reversed", () => {
    const reply = formatStudyPlanReply([
      {
        title: "GIS exam",
        type: "exam",
        startsAt: "2026-09-25T09:00:00.000Z",
        notes: "Day 1 of 5: assessment",
      },
      {
        title: "Mock exam: GIS",
        type: "study",
        startsAt: "2026-09-24T18:00:00.000Z",
        notes: "Day 2 of 5: mock",
      },
      {
        title: "Foundations: GIS",
        type: "study",
        startsAt: "2026-09-20T18:00:00.000Z",
        notes: "Day 5 of 5: start",
      },
    ]);
    const rows = reply.split("\n").filter((line) => /^\| (Day \d|Exam)/.test(line));
    expect(rows[0]).toMatch(/^\| Day 1 of 2 \|.*\| Foundations: GIS \| start \|$/);
    expect(rows[1]).toMatch(/^\| Day 2 of 2 \|.*\| Mock exam: GIS \| mock \|$/);
    expect(rows[2]).toMatch(/^\| Exam \|.*\| GIS exam \| assessment \|$/);
    expect(reply).toContain("| Day | Date | Time | Topic | What to do |");
    expect(PLAN_SAVED_PATTERN.test(reply)).toBe(true);
  });
});

describe("normalizeExtractedPlan", () => {
  const now = Date.UTC(2026, 9, 10, 20, 0);
  it("keeps future sessions in order, converts local times and fills defaults", () => {
    const rows = normalizeExtractedPlan(
      {
        events: [
          { title: "Practice questions", date: "2026-10-12", time: "7:30", notes: "Past paper" },
          { title: "Read chapter 1", type: "study", date: "2026-10-11", durationMinutes: 999 },
          { title: "Too late", date: "2026-10-10", time: "08:00" },
          { title: "AI exam", date: "2026-10-14", time: "09:00" },
          { title: "x", date: "2026-10-13" },
          { title: "Bad date", date: "2026-02-31" },
        ],
      },
      -60,
      now
    );
    expect(rows.map((r) => r.title)).toEqual(["Read chapter 1", "Practice questions", "AI exam"]);
    expect(rows[0]).toMatchObject({ time: "18:00", durationMinutes: 480, type: "study" });
    expect(rows[1]).toMatchObject({ time: "07:30", durationMinutes: 60, notes: "Past paper" });
    expect(rows[2].type).toBe("exam");
  });

  it("dates rows from the plan's own day labels and reads 12-hour times", () => {
    const rows = normalizeExtractedPlan(
      [
        { title: "Projections", day: "Monday", date: "2026-10-16", time: "7:00 PM" },
        { title: "Data models", day: "Tuesday", time: "9am" },
      ],
      0,
      now
    );
    expect(rows).toMatchObject([
      { title: "Projections", date: "2026-10-12", time: "19:00" },
      { title: "Data models", date: "2026-10-13", time: "09:00" },
    ]);
  });
});

describe("resolvePlanDay", () => {
  const saturday = { date: "2026-10-10", weekday: 6 };
  it("maps weekdays, day numbers and weeks onto upcoming dates", () => {
    expect(resolvePlanDay("Monday", saturday)).toBe("2026-10-12");
    expect(resolvePlanDay("Sat", saturday)).toBe("2026-10-17");
    expect(resolvePlanDay("Day 1", saturday)).toBe("2026-10-11");
    expect(resolvePlanDay("Week 2 Day 1", saturday)).toBe("2026-10-18");
    expect(resolvePlanDay("Week 2 - Wednesday", saturday)).toBe("2026-10-21");
    expect(resolvePlanDay("tomorrow", saturday)).toBe("2026-10-11");
    expect(resolvePlanDay("2026-10-20", saturday)).toBe("2026-10-20");
    expect(resolvePlanDay("Revision", saturday)).toBeNull();
  });

  it("keeps a plan that wraps past the weekend in order", () => {
    const friday = resolvePlanDay("Friday", saturday)!;
    const sunday = resolvePlanDay("Sunday", saturday, friday)!;
    expect([friday, sunday]).toEqual(["2026-10-16", "2026-10-18"]);
  });
});

describe("study plan helpers", () => {
  it("round-trips local dates through a timezone offset", () => {
    const at = fromLocalParts("2026-10-12", "18:00", -60)!;
    expect(new Date(at).toISOString()).toBe("2026-10-12T17:00:00.000Z");
    expect(toLocalParts(at, -60)).toMatchObject({ date: "2026-10-12", time: "18:00", weekday: 1 });
  });

  it("spots plan-like replies but not ordinary answers or saved plans", () => {
    const plan = "Here is a study plan:\n\n| Day | Time | Session |\n|---|---|---|\n| Monday | 18:00 | Read notes |\n| Tuesday | 18:00 | Practice |\n| Wednesday | 18:00 | Recall |";
    expect(looksLikeStudyPlan(plan)).toBe(true);
    expect(looksLikeStudyPlan("Linear regression fits a straight line to data by minimising squared errors across all points.")).toBe(false);
    expect(looksLikeStudyPlan(`${plan}\n\nSaved to your study planner.`)).toBe(false);
  });

  it("validates editable rows", () => {
    const now = Date.UTC(2026, 9, 10, 20, 0);
    const row = { title: "Read", type: "study" as const, date: "2026-10-11", time: "18:00", durationMinutes: 60, notes: "" };
    expect(planSessionError(row, 0, now)).toBeNull();
    expect(planSessionError({ ...row, date: "2026-10-09" }, 0, now)).toMatch(/past/);
    expect(planSessionError({ ...row, title: " " }, 0, now)).toMatch(/title/);
  });
});
