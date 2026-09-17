import { describe, expect, it } from "vitest";
import {
  fallbackCalendarDrafts,
  formatStudyPlanReply,
  parseCalendarEventDrafts,
} from "./calendar";

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
      "Create a study plan for Artificial Intelligence which on the 25 September at 9am",
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
    const dayLines = reply.split("\n").filter((line) => /^Day \d+ of/.test(line) || /^exam —/i.test(line));
    expect(dayLines[0]).toMatch(/^Day 1 of 2 — Foundations: GIS/);
    expect(dayLines[1]).toMatch(/^Day 2 of 2 — Mock exam: GIS/);
    expect(dayLines[2]).toMatch(/^exam — GIS exam/i);
  });
});
