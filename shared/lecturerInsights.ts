/** Types and display helpers for the lecturer's AI grading, similarity and class-insight tools. */

export type GradeDraftCriterion = {
  criterion: string;
  maxPoints: number;
  score: number;
  comment: string;
};

export type GradeDraft = {
  /** False when the assignment has no rubric and the AI marked out of 100 overall. */
  hasRubric: boolean;
  criteria: GradeDraftCriterion[];
  total: number;
  maxTotal: number;
  /** Written to the student, ready to send once the lecturer is happy with it. */
  feedback: string;
  /** Something the lecturer should know about the draft, such as a long submission being cut short. */
  warning?: string;
};

export type ConfusionTopic = {
  topic: string;
  /** What students seem unsure about. */
  summary: string;
  /** What the lecturer could re-teach or clarify. */
  suggestion: string;
  questionCount: number;
  studentCount: number;
  /** A few anonymised questions, with emails and phone numbers removed. */
  examples: string[];
};

export const INSIGHT_PERIODS = [7, 14, 30] as const;
export type InsightPeriod = (typeof INSIGHT_PERIODS)[number];

/** Mark used when an assignment has no rubric. */
export const DEFAULT_MAX_GRADE = 100;

export const SIMILARITY_LEVELS = { high: 50, medium: 25, low: 12 } as const;
export type SimilarityLevel = keyof typeof SIMILARITY_LEVELS;

/** Share of the shorter submission found word-for-word in the other, as a level the UI can colour. */
export function similarityLevel(percent: number): SimilarityLevel | null {
  if (percent >= SIMILARITY_LEVELS.high) return "high";
  if (percent >= SIMILARITY_LEVELS.medium) return "medium";
  if (percent >= SIMILARITY_LEVELS.low) return "low";
  return null;
}

export const SIMILARITY_LABEL: Record<SimilarityLevel, string> = {
  high: "Very similar",
  medium: "Similar",
  low: "Some overlap",
};

/** Round to the nearest half mark, kept between 0 and the maximum. */
export function clampHalfMark(value: unknown, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(0, Math.round(n * 2) / 2));
}
