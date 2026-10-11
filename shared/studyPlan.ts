/** Helpers for turning an AI chat reply into study planner sessions (server, web and mobile). */

export const PLAN_SESSION_TYPES = ["study", "quiz", "test", "exam", "other"] as const;
export type PlanSessionType = (typeof PLAN_SESSION_TYPES)[number];

export const PLAN_LIMITS = {
  sessions: 14,
  title: { min: 2, max: 160 },
  notes: 500,
  duration: { min: 10, max: 480 },
  text: { min: 40, max: 8000 },
} as const;

/** Reply wording used when the AI has already saved the plan, so the apps show "Open planner" instead. */
export const PLAN_SAVED_PATTERN = /\b(saved|added)\b[^.\n]{0,40}\bto your (study planner|calendar)\b/i;

const PLAN_WORDS =
  /\b(study|revision|reading|exam|test)\s+(plan|schedule|timetable)\b|\btimetable\b|\bschedule\b|\bweek\s*\d\b|\bday\s*\d\b/i;
const TIME_MARKERS =
  /\b(day\s*\d{1,2}|week\s*\d{1,2}|mon(day)?|tue(s(day)?)?|wed(nesday)?|thu(rs(day)?)?|fri(day)?|sat(urday)?|sun(day)?|\d{1,2}:\d{2}|\d{1,2}\s*(am|pm)|morning|evening|afternoon)\b/gi;
const STRUCTURE = /^\s*(\|.+\||[-*•]\s+|\d+[.)]\s+|#{1,4}\s+)/m;

/** True when a reply reads like a day-by-day study plan worth offering to the planner. */
export function looksLikeStudyPlan(text: string): boolean {
  if (!text || text.length < PLAN_LIMITS.text.min || PLAN_SAVED_PATTERN.test(text)) return false;
  if (!STRUCTURE.test(text)) return false;
  const markers = text.match(TIME_MARKERS)?.length ?? 0;
  return markers >= 3 && (PLAN_WORDS.test(text) || markers >= 5);
}

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Convert a UTC timestamp to the student's wall clock, given `Date.getTimezoneOffset()`
 * (minutes, positive west of UTC).
 */
export function toLocalParts(ms: number, tzOffsetMinutes: number) {
  const local = new Date(ms - tzOffsetMinutes * 60_000);
  return {
    date: `${local.getUTCFullYear()}-${pad2(local.getUTCMonth() + 1)}-${pad2(local.getUTCDate())}`,
    time: `${pad2(local.getUTCHours())}:${pad2(local.getUTCMinutes())}`,
    weekday: local.getUTCDay(),
  };
}

/** Inverse of `toLocalParts`: "2026-10-12" + "18:30" on the student's clock to a UTC timestamp. */
export function fromLocalParts(date: string, time: string, tzOffsetMinutes: number): number | null {
  const d = date.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const t = (time.trim() || "18:00").match(/^(\d{1,2}):(\d{2})$/);
  if (!d || !t) return null;
  const [y, m, day] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const [h, min] = [Number(t[1]), Number(t[2])];
  if (m < 1 || m > 12 || day < 1 || day > 31 || h > 23 || min > 59) return null;
  const utc = Date.UTC(y, m - 1, day, h, min) + tzOffsetMinutes * 60_000;
  const check = new Date(utc - tzOffsetMinutes * 60_000);
  if (check.getUTCDate() !== day) return null;
  return utc;
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export type PlanSessionDraft = {
  title: string;
  type: PlanSessionType;
  date: string;
  time: string;
  durationMinutes: number;
  notes: string;
};

/** Validate one editable row before saving; returns a sentence for the student or null. */
export function planSessionError(row: PlanSessionDraft, tzOffsetMinutes: number, now = Date.now()): string | null {
  const title = row.title.trim();
  if (title.length < PLAN_LIMITS.title.min) return "Give the session a title.";
  if (title.length > PLAN_LIMITS.title.max) return `Keep the title under ${PLAN_LIMITS.title.max} characters.`;
  const at = fromLocalParts(row.date, row.time, tzOffsetMinutes);
  if (at === null) return "Pick a valid date and time.";
  if (at < now - 5 * 60_000) return "This session is in the past. Pick a later date or time.";
  if (row.notes.length > PLAN_LIMITS.notes) return `Keep the notes under ${PLAN_LIMITS.notes} characters.`;
  return null;
}
