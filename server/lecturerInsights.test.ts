import { describe, expect, it } from "vitest";
import { buildConfusionTopics, normalizeGradeDraft, prepareQuestions, redactPersonal } from "./lecturerInsights";
import { comparePairs, containmentPercent, isComparable, overlapPercent, prepareText, sharedPassages, shingleKeys, tokenize } from "./similarity";
import { clampHalfMark, similarityLevel } from "../shared/lecturerInsights";

const essayA =
  "Linear regression models the relationship between a dependent variable and one or more independent variables by fitting a straight line that minimises the sum of squared residuals across the training data.";
const essayB =
  "Decision trees split the data into branches using feature thresholds, choosing each split to reduce impurity, and they can capture non linear patterns without any scaling of the inputs at all.";

describe("similarity", () => {
  it("scores identical work at 100 and unrelated work at 0", () => {
    const a = prepareText(essayA);
    expect(overlapPercent(a, prepareText(essayA))).toBe(100);
    expect(overlapPercent(a, prepareText(essayB))).toBe(0);
  });

  it("ignores case, punctuation and wording copied from the brief", () => {
    const brief = new Set(shingleKeys(tokenize("Explain how linear regression models the relationship between variables")));
    const a = prepareText(`Explain how linear regression models the relationship between variables. ${essayB}`, brief);
    const b = prepareText(`EXPLAIN how linear regression models the relationship, between variables! ${essayA}`, brief);
    expect(overlapPercent(a, b)).toBe(0);
  });

  it("finds a copied paragraph inside a longer essay and quotes it", () => {
    const copier = prepareText(`${essayB} In my own view ${essayA}`);
    const original = prepareText(essayA);
    expect(overlapPercent(copier, original)).toBe(100);
    const [passage] = sharedPassages(copier, original.set);
    expect(passage).toContain("fitting a straight line that minimises");
  });

  it("skips submissions too short to judge", () => {
    const short = prepareText("See attached file.");
    expect(isComparable(short)).toBe(false);
    const pairs = comparePairs(
      [
        { item: "short", text: short },
        { item: "a", text: prepareText(essayA) },
        { item: "copy", text: prepareText(essayA) },
      ],
      12
    );
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ a: "a", b: "copy", percent: 100 });
  });

  it("measures how much of a submission matches the course notes", () => {
    const notes = new Set(prepareText(essayA).keys);
    expect(containmentPercent(prepareText(`${essayA} ${essayB}`), notes)).toBeGreaterThan(40);
    expect(similarityLevel(55)).toBe("high");
    expect(similarityLevel(5)).toBeNull();
  });
});

describe("normalizeGradeDraft", () => {
  const rubric = [
    { criterion: "Research", maxPoints: 30 },
    { criterion: "Analysis", maxPoints: 40 },
  ];

  it("matches criteria by name, clamps scores and totals them", () => {
    const draft = normalizeGradeDraft(
      {
        criteria: [
          { criterion: "analysis ", score: 52, comment: "Thorough." },
          { criterion: "RESEARCH", score: 21.3, comment: "Good sources." },
        ],
        feedback: "Well done overall.",
      },
      rubric
    );
    expect(draft.criteria.map((c) => [c.criterion, c.score])).toEqual([
      ["Research", 21.5],
      ["Analysis", 40],
    ]);
    expect(draft).toMatchObject({ hasRubric: true, total: 61.5, maxTotal: 70, feedback: "Well done overall." });
  });

  it("flags criteria the AI skipped and builds feedback from comments", () => {
    const draft = normalizeGradeDraft({ criteria: [{ criterion: "Research", score: 10, comment: "Thin." }] }, rubric);
    expect(draft.criteria[1]).toMatchObject({ criterion: "Analysis", score: 0 });
    expect(draft.criteria[1].comment).toMatch(/add a score/);
    expect(draft.feedback).toBe("Research: Thin.");
  });

  it("marks out of 100 without a rubric and rejects empty replies", () => {
    expect(normalizeGradeDraft({ score: 74, comment: "Solid", feedback: "Nice" }, null)).toMatchObject({
      hasRubric: false,
      total: 74,
      maxTotal: 100,
    });
    expect(() => normalizeGradeDraft({ feedback: "Nice" }, rubric)).toThrow();
    expect(clampHalfMark("abc", 10)).toBe(0);
  });
});

describe("confusion report helpers", () => {
  const at = (minutes: number) => new Date(Date.UTC(2026, 9, 10, 12, minutes));

  it("drops small talk, commands and repeats, and removes contact details", () => {
    const questions = prepareQuestions([
      { userId: 1, text: "thanks!", createdAt: at(1) },
      { userId: 1, text: "/summary", createdAt: at(2) },
      { userId: 1, text: "Why do we square the residuals in regression?", createdAt: at(3) },
      { userId: 1, text: "why do we square the residuals in regression", createdAt: at(4) },
      { userId: 2, text: "Why do we square the residuals in regression?", createdAt: at(5) },
      { userId: 3, text: "Email me at ama@school.edu or 076 123 4567 about overfitting please", createdAt: at(6) },
    ]);
    expect(questions.map((q) => q.userId)).toEqual([3, 2, 1]);
    expect(questions[0].text).toBe("Email me at [email] or [number] about overfitting please");
    expect(redactPersonal("see https://x.y/z")).toBe("see [link]");
  });

  it("counts each question once from the ids the AI cites", () => {
    const questions = [
      { id: 1, userId: 7, text: "What is a residual?" },
      { id: 2, userId: 8, text: "How are residuals squared?" },
      { id: 3, userId: 7, text: "What does R squared mean?" },
      { id: 4, userId: 9, text: "Explain overfitting" },
    ];
    const topics = buildConfusionTopics(
      {
        topics: [
          { topic: "Overfitting", summary: "s", suggestion: "x", questionIds: [4, 99] },
          { topic: "Residuals", summary: "Unsure what residuals are", suggestion: "Worked example", questionIds: [1, 2, 3, 4] },
          { topic: "Empty", questionIds: [] },
        ],
      },
      questions
    );
    expect(topics.map((t) => [t.topic, t.questionCount, t.studentCount])).toEqual([
      ["Residuals", 3, 2],
      ["Overfitting", 1, 1],
    ]);
    expect(topics[0].examples).toHaveLength(3);
  });
});
