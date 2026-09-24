import { describe, expect, it } from "vitest";
import {
  buildInsights,
  derivePersona,
  documentProgressPct,
  pickRecommendation,
} from "./recommendations";

describe("documentProgressPct", () => {
  it("returns 0 when there is no activity", () => {
    expect(documentProgressPct({ flashcardsReviewed: 0, quizzesAttempted: 0, totalStudyTimeMinutes: 0 })).toBe(0);
  });

  it("returns at least 5 when any activity exists", () => {
    expect(documentProgressPct({ flashcardsReviewed: 1, quizzesAttempted: 0, totalStudyTimeMinutes: 0 })).toBeGreaterThanOrEqual(5);
  });
});

describe("derivePersona", () => {
  it("marks brand-new students as new", () => {
    expect(derivePersona({ quizAttempts: 0, overdueCount: 0, weakCount: 0, quizAccuracy: null, streak: 0 })).toBe("new");
  });

  it("marks overdue or multiple weak topics as behind", () => {
    expect(derivePersona({ quizAttempts: 3, overdueCount: 1, weakCount: 0, quizAccuracy: 80, streak: 2 })).toBe("behind");
    expect(derivePersona({ quizAttempts: 3, overdueCount: 0, weakCount: 2, quizAccuracy: 50, streak: 1 })).toBe("behind");
  });

  it("marks high accuracy plus streak as strong", () => {
    expect(derivePersona({ quizAttempts: 4, overdueCount: 0, weakCount: 0, quizAccuracy: 88, streak: 5 })).toBe("strong");
  });
});

describe("pickRecommendation", () => {
  it("prioritizes overdue work", () => {
    const rec = pickRecommendation({
      overdue: [{ title: "SE assignment", courseId: 2, href: "/course/2" }],
      weakTopics: [{ topic: "3NF", courseId: 1, courseTitle: "DB", documentId: 9, misses: 4, attempts: 5, lastScore: 40 }],
      continueLearning: null,
      enrolledCount: 2,
    });
    expect(rec.title).toBe("SE assignment");
    expect(rec.reason).toMatch(/overdue/i);
  });

  it("recommends weak topics with a reason", () => {
    const rec = pickRecommendation({
      overdue: [],
      weakTopics: [{ topic: "3NF", courseId: 1, courseTitle: "DB", documentId: 9, misses: 3, attempts: 4, lastScore: 55 }],
      continueLearning: null,
      enrolledCount: 1,
    });
    expect(rec.title).toContain("3NF");
    expect(rec.reason).toMatch(/missed/i);
    expect(rec.href).toBe("/document/9");
  });

  it("handles the no-data catalog state", () => {
    const rec = pickRecommendation({
      overdue: [],
      weakTopics: [],
      continueLearning: null,
      enrolledCount: 0,
    });
    expect(rec.href).toBe("/(tabs)/courses");
    expect(rec.reason).toMatch(/enrolled/i);
  });
});

describe("buildInsights", () => {
  it("does not invent study hours or empty claims", () => {
    expect(buildInsights({
      weekSessions: 0,
      quizDelta: null,
      weakTopics: [],
      daysSinceCourse: null,
      courseTitle: null,
      dueSoonTitle: null,
      dueSoonDays: null,
    })).toEqual([]);
  });

  it("reports only facts that were provided", () => {
    const lines = buildInsights({
      weekSessions: 3,
      quizDelta: 14,
      weakTopics: [{ topic: "Normalization", courseId: 1, courseTitle: "DB", documentId: 1, misses: 2, attempts: 4, lastScore: 55 }],
      daysSinceCourse: 6,
      courseTitle: "Computer Networks",
      dueSoonTitle: "Lab 2",
      dueSoonDays: 2,
    });
    expect(lines.some((l) => l.includes("3 study sessions"))).toBe(true);
    expect(lines.some((l) => l.includes("Normalization"))).toBe(true);
    expect(lines.length).toBeLessThanOrEqual(4);
  });
});
