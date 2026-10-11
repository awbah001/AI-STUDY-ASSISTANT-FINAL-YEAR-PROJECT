/** Pure helpers behind AI-drafted grading and the class confusion report (no database or AI calls). */
import {
  clampHalfMark,
  DEFAULT_MAX_GRADE,
  type ConfusionTopic,
  type GradeDraft,
  type GradeDraftCriterion,
} from "../shared/lecturerInsights";

export type Rubric = Array<{ criterion: string; maxPoints: number }>;

const FEEDBACK_MAX = 3000;
const COMMENT_MAX = 400;

const nameKey = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const clean = (value: unknown, max: number) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * Line the AI's suggested marks up with the assignment's rubric. Scores are clamped to each
 * criterion's maximum; criteria the AI skipped get 0 and a note so the lecturer marks them.
 */
export function normalizeGradeDraft(raw: unknown, rubric: Rubric | null | undefined): GradeDraft {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const items = (Array.isArray(obj.criteria) ? obj.criteria : []).filter(
    (item): item is Record<string, unknown> => !!item && typeof item === "object"
  );
  const hasRubric = !!rubric?.length;
  const targets: Rubric = hasRubric ? rubric! : [{ criterion: "Overall", maxPoints: DEFAULT_MAX_GRADE }];
  const byName = new Map(items.map((item) => [nameKey(item.criterion), item]));

  const marked = new Set<number>();
  const criteria: GradeDraftCriterion[] = targets.map((target, index) => {
    const item =
      byName.get(nameKey(target.criterion)) ??
      (items.length === targets.length ? items[index] : undefined) ??
      (!hasRubric && obj.score !== undefined ? { score: obj.score, comment: obj.comment } : undefined);
    if (!item) {
      return { criterion: target.criterion, maxPoints: target.maxPoints, score: 0, comment: "The AI didn't mark this. Please add a score." };
    }
    marked.add(index);
    return {
      criterion: target.criterion,
      maxPoints: target.maxPoints,
      score: clampHalfMark(item.score, target.maxPoints),
      comment: clean(item.comment, COMMENT_MAX),
    };
  });
  if (!marked.size) throw new Error("The AI did not return any marks.");

  const total = Math.round(criteria.reduce((sum, c) => sum + c.score, 0) * 2) / 2;
  const maxTotal = targets.reduce((sum, c) => sum + c.maxPoints, 0);
  const feedback =
    String(obj.feedback ?? "").trim().slice(0, FEEDBACK_MAX) ||
    criteria
      .filter((c, index) => marked.has(index) && c.comment)
      .map((c) => `${c.criterion}: ${c.comment}`)
      .join("\n")
      .slice(0, FEEDBACK_MAX);
  return { hasRubric, criteria, total, maxTotal, feedback };
}

export type RawQuestion = { userId: number; text: string; createdAt: Date | number };
export type PreparedQuestion = { id: number; userId: number; text: string };

const SMALL_TALK = /^(hi|hello|hey|thanks?|thank you|ok(ay)?|good (morning|afternoon|evening)|yes|no)\b[\s!.?]*$/i;

/** Remove contact details so the report stays anonymous even if a student typed them. */
export function redactPersonal(text: string) {
  return text
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]")
    .replace(/https?:\/\/\S+/g, "[link]")
    .replace(/\+?\d[\d\s-]{7,}\d/g, "[number]");
}

/** Newest first, without small talk, slash commands or repeats by the same student; numbered from 1. */
export function prepareQuestions(raw: RawQuestion[], limit = 200, maxChars = 280): PreparedQuestion[] {
  const seen = new Set<string>();
  const out: PreparedQuestion[] = [];
  const newest = [...raw].sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)));
  for (const q of newest) {
    const text = redactPersonal(q.text.replace(/\s+/g, " ").trim());
    if (!text || text.startsWith("/") || SMALL_TALK.test(text)) continue;
    if ((text.match(/\p{L}/gu)?.length ?? 0) < 8 || text.split(" ").length < 3) continue;
    const key = `${q.userId}:${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: out.length + 1, userId: q.userId, text: text.length > maxChars ? `${text.slice(0, maxChars).trimEnd()}…` : text });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Turn the AI's grouping into report topics. Counts come from the question ids it cites,
 * never from numbers it writes, and each question counts towards one topic only.
 */
export function buildConfusionTopics(raw: unknown, questions: PreparedQuestion[], maxTopics = 8): ConfusionTopic[] {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const list = Array.isArray(obj.topics) ? obj.topics : Array.isArray(raw) ? raw : [];
  const byId = new Map(questions.map((q) => [q.id, q]));
  const used = new Set<number>();
  const topics: ConfusionTopic[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const t = entry as Record<string, unknown>;
    const name = clean(t.topic, 80);
    if (!name) continue;
    const ids = (Array.isArray(t.questionIds) ? t.questionIds : [])
      .map(Number)
      .filter((id) => byId.has(id) && !used.has(id));
    const unique = Array.from(new Set(ids));
    if (!unique.length) continue;
    unique.forEach((id) => used.add(id));
    const asked = unique.map((id) => byId.get(id)!);
    topics.push({
      topic: name,
      summary: clean(t.summary, 400),
      suggestion: clean(t.suggestion, 400),
      questionCount: asked.length,
      studentCount: new Set(asked.map((q) => q.userId)).size,
      examples: Array.from(new Set(asked.map((q) => q.text))).slice(0, 3),
    });
  }
  return topics
    .sort((a, b) => b.questionCount - a.questionCount || b.studentCount - a.studentCount)
    .slice(0, maxTopics);
}
