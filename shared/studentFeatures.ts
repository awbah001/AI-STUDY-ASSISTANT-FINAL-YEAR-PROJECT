/** Limits and display helpers shared by the server, web and mobile for the student study features. */

export const DISCUSSION_LIMITS = {
  title: { min: 5, max: 160 },
  body: { min: 10, max: 3000 },
  reply: { min: 2, max: 3000 },
} as const;

export const EXAM_QUESTION_CHOICES = [10, 20, 30] as const;
export const EXAM_MINUTE_CHOICES = [15, 30, 60] as const;
export const EXAM_ANSWER_MAX = 2000;

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  const ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDuration(totalSeconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(totalSeconds ?? 0));
  if (s < 60) return `${s} sec`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m} min ${rest} sec` : `${m} min`;
}

export function formatBytesShort(bytes: number | null | undefined): string {
  const b = bytes ?? 0;
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}

export function scoreBand(percent: number): { label: string; tone: "good" | "ok" | "low" } {
  if (percent >= 70) return { label: "Strong result", tone: "good" };
  if (percent >= 50) return { label: "Nearly there", tone: "ok" };
  return { label: "Keep practising", tone: "low" };
}

/** Next local evening at 18:00, used as the default review time for practice sessions. */
export function nextEveningReview(now = new Date()): number {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  date.setHours(18, 0, 0, 0);
  return date.getTime();
}

/** Group marked exam questions by topic so students can see where marks were lost. */
export function topicBreakdown(
  questions: Array<{ topic?: string | null; documentTitle?: string | null; marks: number; awardedMarks?: number | null }>
): Array<{ topic: string; earned: number; total: number; percent: number }> {
  const map = new Map<string, { earned: number; total: number }>();
  for (const q of questions) {
    const topic = q.topic?.trim() || q.documentTitle?.trim() || "General";
    const row = map.get(topic) ?? { earned: 0, total: 0 };
    row.earned += q.awardedMarks ?? 0;
    row.total += q.marks;
    map.set(topic, row);
  }
  return Array.from(map.entries())
    .map(([topic, row]) => ({ ...row, topic, percent: row.total ? Math.round((row.earned / row.total) * 100) : 0 }))
    .sort((a, b) => a.percent - b.percent);
}
