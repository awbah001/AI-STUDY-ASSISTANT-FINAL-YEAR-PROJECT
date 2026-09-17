import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { z } from "zod";
import { calendarEvents, users, type CalendarEvent } from "../drizzle/schema";
import { getDb } from "./db";
import { generateAgentText } from "./agent/llmProvider";
import { createNotification } from "./queries";
import { sendPushNotifications } from "./pushNotifications";

export const CALENDAR_EVENT_TYPES = ["exam", "test", "quiz", "study", "other"] as const;
export type CalendarEventType = (typeof CALENDAR_EVENT_TYPES)[number];

export type CalendarEventDraft = {
  title: string;
  type: CalendarEventType;
  startsAt: string;
  endsAt?: string;
  notes?: string;
  reminderMinutes?: number;
  courseId?: number;
};

export const calendarDraftSchema = z.object({
  title: z.string().min(2).max(160),
  type: z.enum(CALENDAR_EVENT_TYPES).optional(),
  startsAt: z.union([z.string(), z.number()]),
  endsAt: z.union([z.string(), z.number()]).optional(),
  notes: z.string().max(500).optional(),
  reminderMinutes: z.number().int().min(5).max(10080).optional(),
  courseId: z.number().int().positive().optional(),
});

const MAX_EVENTS = 14;
const HORIZON_MS = 120 * 24 * 60 * 60 * 1000;

const MONTHS: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sept: 8, sep: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

function monthIndex(token: string): number | undefined {
  const t = token.toLowerCase();
  if (t in MONTHS) return MONTHS[t];
  const hit = Object.keys(MONTHS).find((key) => t.startsWith(key) || key.startsWith(t));
  return hit ? MONTHS[hit] : undefined;
}

export function extractEventDateFromMessage(message: string, now = Date.now()): Date | null {
  const lower = message.replace(/\s+/g, " ").toLowerCase();
  const nowDate = new Date(now);
  let day: number | null = null;
  let month: number | null = null;
  let year: number | null = null;

  const dayMonth = lower.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s*,?\s*(\d{4}))?\b/
  );
  const monthDay = lower.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/
  );
  const numeric = lower.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);

  if (dayMonth) {
    day = Number(dayMonth[1]);
    month = monthIndex(dayMonth[2]) ?? null;
    year = dayMonth[3] ? Number(dayMonth[3]) : null;
  } else if (monthDay) {
    month = monthIndex(monthDay[1]) ?? null;
    day = Number(monthDay[2]);
    year = monthDay[3] ? Number(monthDay[3]) : null;
  } else if (numeric) {
    day = Number(numeric[1]);
    month = Number(numeric[2]) - 1;
    year = Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]);
  }

  if (day == null || month == null || day < 1 || day > 31 || month < 0 || month > 11) return null;

  let hours = 9;
  let minutes = 0;
  const timeMatch =
    lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\b/) ||
    lower.match(/\b(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?\b/);
  if (timeMatch) {
    hours = Number(timeMatch[1]);
    minutes = timeMatch[2] ? Number(timeMatch[2]) : 0;
    const mer = (timeMatch[3] ?? "").replace(/\./g, "");
    if (mer.startsWith("p") && hours < 12) hours += 12;
    if (mer.startsWith("a") && hours === 12) hours = 0;
    if (hours > 23) hours = 9;
  }

  const y = year ?? nowDate.getFullYear();
  const result = new Date(now);
  result.setFullYear(y, month, day);
  result.setHours(hours, minutes, 0, 0);
  if (result.getTime() < now - 6 * 60 * 60 * 1000) {
    result.setFullYear(y + 1);
  }
  return result;
}

export function extractPlanSubject(message: string): string {
  let text = message.replace(/\s+/g, " ").trim();
  text = text.replace(/^(please\s+)?(create|make|build|generate|set up|plan)\b[\w\s]{0,20}\b(for\s+)?/i, "");
  text = text.replace(/\b(which|that)\b/gi, " ");
  text = text.replace(/\bon the\b/gi, " ");
  text = text.replace(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s*,?\s*\d{4})?\b/gi,
    " "
  );
  text = text.replace(/\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?\b/gi, " ");
  text = text.replace(/\b(\d{1,2})\s*-?\s*days?\b/gi, " ");
  text = text.replace(/\b(upcoming|my|the|study plan|timetable|schedule)\b/gi, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text.slice(0, 80) || "Upcoming assessment";
}

export function extractRequestedDayCount(message: string): number | null {
  const match = message.match(/\b(\d{1,2})\s*-?\s*days?\b/i);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n)) return null;
  return Math.min(10, Math.max(2, n));
}

function studyPhases(subject: string, kind: CalendarEventType) {
  const label = kind === "quiz" ? "quiz" : kind === "test" ? "test" : "exam";
  return [
    {
      title: `Foundations: ${subject}`,
      notes: `Read your notes and list key terms for ${subject}. Aim for 45–60 minutes.`,
    },
    {
      title: `Core topics: ${subject}`,
      notes: `Work through the main concepts and examples you expect on the ${label}.`,
    },
    {
      title: `Practice questions: ${subject}`,
      notes: `Attempt past questions or a short quiz. Mark anything you cannot explain.`,
    },
    {
      title: `Active recall: ${subject}`,
      notes: `Use flashcards and teach the topics out loud. Revisit weak areas only.`,
    },
    {
      title: `Mock ${label}: ${subject}`,
      notes: `Timed practice under ${label} conditions, then check answers.`,
    },
    {
      title: `Light review: ${subject}`,
      notes: `Skim formulas and weak spots only. Sleep well before the ${label}.`,
    },
  ];
}

export function fallbackCalendarDrafts(message: string, now = Date.now()): CalendarEventDraft[] {
  const extracted = extractEventDateFromMessage(message, now);
  let type = inferTypeFromTitle(message);
  if (extracted && type === "study") type = "exam";
  const assessment: CalendarEventType = type === "study" || type === "other" ? "exam" : type;
  const examAt = extracted ? new Date(extracted) : new Date(now);
  if (!extracted) {
    if (/\btomorrow\b/i.test(message)) examAt.setDate(examAt.getDate() + 1);
    else if (/\bnext week\b/i.test(message)) examAt.setDate(examAt.getDate() + 7);
    else examAt.setDate(examAt.getDate() + 5);
    if (!extracted) examAt.setHours(9, 0, 0, 0);
  }
  const subject = extractPlanSubject(message);
  const daysUntil = Math.max(1, Math.round((examAt.getTime() - now) / 86400000));
  const requested = extractRequestedDayCount(message);
  const studyCount = Math.min(MAX_EVENTS - 1, daysUntil, requested ?? Math.min(6, Math.max(3, daysUntil)));
  const phases = studyPhases(subject, assessment);
  const events: CalendarEventDraft[] = [];

  for (let i = 0; i < studyCount; i++) {
    const day = new Date(examAt);
    day.setDate(examAt.getDate() - (studyCount - i));
    if (day.getTime() <= now) continue;
    const evening = new Date(day);
    evening.setHours(18, 0, 0, 0);
    const phase = phases[Math.min(i, phases.length - 1)];
    events.push({
      title: phase.title,
      type: "study",
      startsAt: evening.toISOString(),
      notes: phase.notes,
      reminderMinutes: 30,
    });
  }

  events.push({
    title: `${subject} ${assessment}`,
    type: assessment,
    startsAt: examAt.toISOString(),
    notes: `Assessment from your request: “${message.replace(/\s+/g, " ").trim().slice(0, 180)}”`,
    reminderMinutes: defaultReminderMinutes(assessment),
  });
  return numberPlanDays(events.slice(0, MAX_EVENTS));
}

export function eventTimestamp(value: string | number | Date): number {
  const parsed = coerceCalendarDate(value);
  return parsed ? parsed.getTime() : Number.NaN;
}

function stripDayPrefix(notes?: string | null): string {
  return (notes ?? "").replace(/^Day\s+\d+(?:\s+of\s+\d+)?:\s*/i, "").trim();
}

/** Sort by start time, then label study sessions Day 1..n in that order. */
export function numberPlanDays<
  T extends { startsAt: string | number | Date; type?: string; notes?: string | null },
>(events: T[]): T[] {
  const sorted = [...events].sort((a, b) => eventTimestamp(a.startsAt) - eventTimestamp(b.startsAt));
  const studyTotal = sorted.filter((event) => event.type === "study").length;
  let studyIndex = 0;
  return sorted.map((event) => {
    const rest = stripDayPrefix(event.notes);
    if (event.type !== "study") {
      return { ...event, notes: rest || event.notes };
    }
    studyIndex += 1;
    const label = `Day ${studyIndex} of ${studyTotal || sorted.length}`;
    return { ...event, notes: rest ? `${label}: ${rest}` : label };
  });
}

export function formatStudyPlanReply(
  events: Array<{ title: string; type: string; startsAt: string | number | Date; notes?: string | null }>
): string {
  if (!events.length) return "I could not build a study plan from that request.";
  const sorted = numberPlanDays(events);
  const focus = sorted.find((e) => e.type !== "study") ?? sorted[sorted.length - 1];
  const lines = [`Here is your structured study plan for ${focus.title}:`, ""];
  let studyIndex = 0;
  const studyTotal = sorted.filter((event) => event.type === "study").length;
  sorted.forEach((event) => {
    const when =
      coerceCalendarDate(event.startsAt)?.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) ?? "";
    if (event.type === "study") {
      studyIndex += 1;
      lines.push(`Day ${studyIndex} of ${studyTotal} — ${event.title}`);
    } else {
      lines.push(`${event.type} — ${event.title}`);
    }
    lines.push(`${when}${stripDayPrefix(event.notes) ? `\n${stripDayPrefix(event.notes)}` : ""}`);
    lines.push("");
  });
  lines.push("Saved to your calendar. An alarm is set for each study day (morning) and at session time.");
  return lines.join("\n").trim();
}

function mergeStructuredPlan(skeleton: CalendarEventDraft[], llm: CalendarEventDraft[]): CalendarEventDraft[] {
  if (llm.length < 2) return numberPlanDays(skeleton);
  const exam = skeleton.find((e) => e.type !== "study") ?? skeleton[skeleton.length - 1];
  const studySlots = [...skeleton.filter((e) => e.type === "study")].sort(
    (a, b) => eventTimestamp(a.startsAt) - eventTimestamp(b.startsAt)
  );
  const llmStudy = [...llm.filter((e) => e.type === "study")].sort(
    (a, b) => eventTimestamp(a.startsAt) - eventTimestamp(b.startsAt)
  );
  const mergedStudy = studySlots.map((slot, i) => {
    const extra = llmStudy[i];
    if (!extra) return slot;
    return {
      ...slot,
      title: extra.title.slice(0, 160) || slot.title,
      notes: stripDayPrefix(extra.notes) || slot.notes,
    };
  });
  return numberPlanDays([...mergedStudy, exam].filter(Boolean) as CalendarEventDraft[]);
}

export async function proposeCalendarDrafts(message: string, toolDigest = ""): Promise<CalendarEventDraft[]> {
  const now = new Date();
  const skeleton = fallbackCalendarDrafts(message, now.getTime());
  try {
    const { text } = await withTimeout(
      generateAgentText(
        [
          {
            role: "system",
            content:
              "You write structured student revision plans. Reply with JSON only: {\"events\":[{\"title\",\"type\",\"startsAt\",\"notes\"}]}. type must be exam|test|quiz|study. Create one study session per day before the assessment, each with a distinct focus (foundations, core topics, practice, recall, mock, light review). Titles must include the subject the student named. startsAt must be ISO-8601. Do not invent extra courses. Max 14 events. No markdown.",
          },
          {
            role: "user",
            content: [
              `Today (ISO): ${now.toISOString()}`,
              `Student request: ${message}`,
              `Use this timetable skeleton (keep these dates): ${JSON.stringify(skeleton)}`,
              toolDigest ? `Progress notes: ${toolDigest.slice(0, 800)}` : "",
            ]
              .filter(Boolean)
              .join("\n\n"),
          },
        ],
        500
      ),
      12_000
    );
    const parsed = parseCalendarEventDrafts(extractJsonPayload(text), now.getTime());
    if (parsed.length >= 2) return mergeStructuredPlan(skeleton, parsed);
    return numberPlanDays(skeleton);
  } catch (error) {
    console.warn("[calendar] LLM plan refine failed, using structured skeleton", error);
  }
  return skeleton;
}

export function defaultReminderMinutes(type: CalendarEventType): number {
  if (type === "exam") return 24 * 60;
  if (type === "test") return 3 * 60;
  if (type === "quiz") return 60;
  return 30;
}

export function coerceCalendarDate(value: unknown, now = Date.now()): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^\d{10,13}$/.test(trimmed)) {
    const n = Number(trimmed);
    const ms = trimmed.length <= 10 ? n * 1000 : n;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const relative = parseLooseDate(trimmed, now);
  return relative;
}

function parseLooseDate(text: string, now: number): Date | null {
  const lower = text.toLowerCase();
  const base = new Date(now);
  if (/\btomorrow\b/.test(lower)) {
    base.setDate(base.getDate() + 1);
    base.setHours(9, 0, 0, 0);
    return base;
  }
  const inDays = lower.match(/\bin\s+(\d{1,2})\s+days?\b/);
  if (inDays) {
    base.setDate(base.getDate() + Number(inDays[1]));
    base.setHours(9, 0, 0, 0);
    return base;
  }
  return null;
}

function extractJsonPayload(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence?.[1]?.trim() ?? trimmed;
  const startObj = body.indexOf("{");
  const startArr = body.indexOf("[");
  const start =
    startArr >= 0 && (startObj < 0 || startArr < startObj) ? startArr : startObj;
  if (start < 0) return null;
  const slice = body.slice(start);
  try {
    return JSON.parse(slice);
  } catch {
    const endObj = slice.lastIndexOf("}");
    const endArr = slice.lastIndexOf("]");
    const end = Math.max(endObj, endArr);
    if (end > 0) {
      try {
        return JSON.parse(slice.slice(0, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function parseCalendarEventDrafts(raw: unknown, now = Date.now()): CalendarEventDraft[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { events?: unknown }).events)
      ? (raw as { events: unknown[] }).events
      : [];
  const out: CalendarEventDraft[] = [];
  for (const item of list) {
    const parsed = calendarDraftSchema.safeParse(item);
    if (!parsed.success) continue;
    const type = parsed.data.type ?? inferTypeFromTitle(parsed.data.title);
    const starts = coerceCalendarDate(parsed.data.startsAt, now);
    if (!starts) continue;
    const t = starts.getTime();
    if (t < now - 60 * 60 * 1000 || t > now + HORIZON_MS) continue;
    const ends = parsed.data.endsAt ? coerceCalendarDate(parsed.data.endsAt, now) : null;
    out.push({
      title: parsed.data.title.trim(),
      type,
      startsAt: starts.toISOString(),
      endsAt: ends && ends.getTime() > t ? ends.toISOString() : undefined,
      notes: parsed.data.notes?.trim() || undefined,
      reminderMinutes: parsed.data.reminderMinutes ?? defaultReminderMinutes(type),
      courseId: parsed.data.courseId,
    });
    if (out.length >= MAX_EVENTS) break;
  }
  return out;
}

function inferTypeFromTitle(title: string): CalendarEventType {
  const lower = title.toLowerCase();
  if (/\bexam\b/.test(lower)) return "exam";
  if (/\bquiz\b/.test(lower)) return "quiz";
  if (/\btest\b/.test(lower)) return "test";
  if (/\bstudy|revise|revision|review\b/.test(lower)) return "study";
  return "other";
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("calendar LLM timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export function serializeCalendarEvent(row: CalendarEvent) {
  const starts = row.startsAt instanceof Date ? row.startsAt.getTime() : Number(row.startsAt);
  const ends = row.endsAt instanceof Date ? row.endsAt.getTime() : row.endsAt ? Number(row.endsAt) : null;
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    type: row.type,
    startsAt: starts,
    endsAt: ends,
    notes: row.notes,
    courseId: row.courseId,
    reminderMinutes: row.reminderMinutes,
    reminderSentAt: row.reminderSentAt instanceof Date
      ? row.reminderSentAt.getTime()
      : row.reminderSentAt
        ? Number(row.reminderSentAt)
        : null,
    source: row.source,
  };
}

export async function listCalendarEvents(userId: number, from: number, to: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.userId, userId),
        gte(calendarEvents.startsAt, new Date(from)),
        lte(calendarEvents.startsAt, new Date(to))
      )
    )
    .orderBy(asc(calendarEvents.startsAt))
    .limit(80);
  return rows.map(serializeCalendarEvent);
}

export async function insertCalendarEvents(
  userId: number,
  drafts: CalendarEventDraft[],
  source: "user" | "agent"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const created = [];
  const ordered = numberPlanDays(drafts).slice(0, MAX_EVENTS);
  for (const draft of ordered) {
    const startsAt = coerceCalendarDate(draft.startsAt);
    if (!startsAt) continue;
    const endsAt = draft.endsAt ? coerceCalendarDate(draft.endsAt) : null;
    const [row] = await db
      .insert(calendarEvents)
      .values({
        userId,
        title: draft.title,
        type: draft.type,
        startsAt,
        endsAt: endsAt ?? undefined,
        notes: draft.notes,
        courseId: draft.courseId,
        reminderMinutes: draft.reminderMinutes ?? defaultReminderMinutes(draft.type),
        source,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    if (row) created.push(serializeCalendarEvent(row));
  }
  return created;
}

export async function deleteCalendarEvent(userId: number, id: number) {
  const db = await getDb();
  if (!db) return false;
  const [existing] = await db
    .select({ id: calendarEvents.id })
    .from(calendarEvents)
    .where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, userId)))
    .limit(1);
  if (!existing) return false;
  await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
  return true;
}

export async function dispatchDueCalendarReminders(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const now = Date.now();
  const rows = await db
    .select()
    .from(calendarEvents)
    .where(and(eq(calendarEvents.userId, userId), isNull(calendarEvents.reminderSentAt)))
    .orderBy(asc(calendarEvents.startsAt))
    .limit(40);
  const [user] = await db.select({ expoPushToken: users.expoPushToken }).from(users).where(eq(users.id, userId)).limit(1);
  let sent = 0;
  for (const row of rows) {
    const starts = row.startsAt instanceof Date ? row.startsAt.getTime() : Number(row.startsAt);
    const fireAt = starts - row.reminderMinutes * 60 * 1000;
    if (fireAt > now) continue;
    if (starts < now - 2 * 60 * 60 * 1000) continue;
    const when = new Date(starts).toLocaleString();
    const title = `${row.type === "study" ? "Study reminder" : row.type[0].toUpperCase() + row.type.slice(1) + " reminder"}`;
    const body = `${row.title} · ${when}`;
    await createNotification({
      userId,
      title,
      body,
      data: { type: "calendar", eventId: row.id },
    });
    await sendPushNotifications([user?.expoPushToken], title, body, { type: "calendar", eventId: row.id });
    await db
      .update(calendarEvents)
      .set({ reminderSentAt: new Date(), updatedAt: new Date() })
      .where(eq(calendarEvents.id, row.id));
    sent += 1;
  }
  return sent;
}
