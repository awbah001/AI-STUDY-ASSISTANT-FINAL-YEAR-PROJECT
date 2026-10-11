/** Pure helpers for mock exams: question mix, passage sampling, parsing and fallback marking. */

export const EXAM_MARKS = { mcq: 1, short: 3 } as const;

export const EXAM_LIMITS = {
  questions: { min: 5, max: 40 },
  minutes: { min: 5, max: 180 },
  answer: 2000,
} as const;

/** Roughly a quarter short-answer questions, never fewer than one once the exam has five questions. */
export function planExamMix(total: number): { mcq: number; short: number } {
  const n = Math.max(1, Math.round(total));
  const short = n >= 5 ? Math.max(1, Math.round(n * 0.25)) : 0;
  return { mcq: n - short, short };
}

/** Spread `count` items over `buckets` as evenly as possible, earlier buckets first. */
export function distribute(count: number, buckets: number): number[] {
  if (buckets <= 0) return [];
  const base = Math.floor(count / buckets);
  const extra = count % buckets;
  return Array.from({ length: buckets }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Evenly spaced excerpts so questions cover the whole document, not just its opening pages. */
export function samplePassages(text: string, maxChars = 5000, pieces = 5): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  const size = Math.floor(maxChars / pieces);
  const step = Math.floor((normalized.length - size) / Math.max(1, pieces - 1));
  const parts: string[] = [];
  for (let i = 0; i < pieces; i++) {
    const start = i === pieces - 1 ? normalized.length - size : Math.min(normalized.length - size, i * step);
    parts.push(normalized.slice(start, start + size));
  }
  return parts.join("\n…\n");
}

export type ShortAnswerItem = {
  question: string;
  modelAnswer: string;
  keyPoints: string[];
  topic?: string;
};

function collectObjects(raw: unknown, acc: Record<string, unknown>[]) {
  if (Array.isArray(raw)) {
    for (const item of raw) collectObjects(item, acc);
    return;
  }
  if (!raw || typeof raw !== "object") return;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.question === "string") acc.push(obj);
  for (const key of ["questions", "items", "shortAnswer", "short"]) {
    if (key in obj) collectObjects(obj[key], acc);
  }
}

export function normalizeShortAnswerItems(raw: unknown): ShortAnswerItem[] {
  const objects: Record<string, unknown>[] = [];
  collectObjects(raw, objects);
  const items: ShortAnswerItem[] = [];
  for (const obj of objects) {
    const type = String(obj.type ?? "").toLowerCase();
    if (type && !type.startsWith("short")) continue;
    if (Array.isArray(obj.options) && obj.options.length > 1) continue;
    const question = String(obj.question ?? "").trim();
    const modelAnswer = String(obj.modelAnswer ?? obj.answer ?? obj.correctAnswer ?? "").trim();
    if (question.length < 8 || modelAnswer.length < 3) continue;
    const keyPoints = Array.isArray(obj.keyPoints)
      ? obj.keyPoints.map((p) => String(p ?? "").trim()).filter(Boolean).slice(0, 5)
      : [];
    const topic = typeof obj.topic === "string" && obj.topic.trim() ? obj.topic.trim().slice(0, 80) : undefined;
    items.push({ question, modelAnswer, keyPoints: keyPoints.length ? keyPoints : [modelAnswer], topic });
  }
  return items;
}

export function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

export function clampMarks(value: unknown, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return roundToHalf(Math.min(max, Math.max(0, n)));
}

const STOPWORDS = new Set([
  "the", "and", "that", "this", "with", "from", "into", "they", "them", "their", "there", "which",
  "what", "when", "where", "while", "have", "has", "had", "been", "being", "were", "will", "would",
  "should", "could", "also", "such", "than", "then", "these", "those", "because", "about", "other",
  "only", "some", "more", "most", "very", "used", "uses", "using", "each", "between", "your",
]);

function stem(word: string): string {
  return word.replace(/(ing|ed|es|s)$/, "");
}

export function significantWords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w))
    .map(stem);
  return new Set(words);
}

/** Keyword-overlap marking, used only when the AI marker is unavailable. */
export function heuristicShortAnswerMark(
  answer: string | null | undefined,
  keyPoints: string[],
  maxMarks: number
): { marks: number; feedback: string } {
  const text = (answer ?? "").trim();
  if (!text) return { marks: 0, feedback: "No answer was given." };
  const said = significantWords(text);
  const points = keyPoints.length ? keyPoints : [];
  let covered = 0;
  const missed: string[] = [];
  for (const point of points) {
    const words = [...significantWords(point)];
    if (!words.length) continue;
    const hits = words.filter((w) => said.has(w)).length;
    if (hits / words.length >= 0.5) covered++;
    else missed.push(point);
  }
  const total = points.length || 1;
  const marks = clampMarks((covered / total) * maxMarks, maxMarks);
  const feedback = missed.length
    ? `Marked automatically by matching key points. Missing: ${missed.slice(0, 3).join("; ")}.`
    : "Marked automatically by matching key points. You covered the main points.";
  return { marks, feedback };
}

export type MarkableQuestion = {
  type: "mcq" | "short";
  marks: number;
  awardedMarks: number | null;
};

export function scoreTotals(questions: MarkableQuestion[]) {
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
  const earnedMarks = roundToHalf(questions.reduce((sum, q) => sum + (q.awardedMarks ?? 0), 0));
  const scorePercent = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 1000) / 10 : 0;
  return { totalMarks, earnedMarks, scorePercent };
}

/** Shuffle a copy deterministically enough for tests to pass a fixed random source. */
export function shuffled<T>(items: T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
