/**
 * Push / local notification helpers.
 * Uses expo-notifications if available, silently no-ops if not installed yet.
 */

import Constants from "expo-constants";
import { Platform } from "react-native";

const ALARM_CHANNEL = "cognify-alarms";
const CAL_PREFIX = "cognify-cal-";

let Notifications: any = null;

try {
  Notifications = require("expo-notifications");
} catch {
  // expo-notifications not installed — all functions will no-op
}

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function eventStartMs(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const n = Number(value);
    return value.trim().length <= 10 ? n * 1000 : n;
  }
  if (typeof value === "string") {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

async function ensureAlarmChannel(): Promise<void> {
  if (!Notifications || Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ALARM_CHANNEL, {
    name: "Study plan alarms",
    importance: Notifications.AndroidImportance?.MAX ?? 5,
    sound: "default",
    vibrationPattern: [0, 400, 200, 400],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility?.PUBLIC ?? 1,
    bypassDnd: false,
  });
}

/**
 * Request notification permissions and return the Expo push token.
 * Returns null if permissions are denied or expo-notifications is not installed.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Notifications) return null;
  try {
    await ensureAlarmChannel();
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return token.data;
  } catch {
    return null;
  }
}

export async function notificationsAllowed(): Promise<boolean> {
  if (!Notifications) return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === "granted") return true;
    const asked = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return asked.status === "granted";
  } catch {
    return false;
  }
}

/**
 * Show a local notification immediately.
 * No-ops if expo-notifications is not installed.
 */
export async function showLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: data ?? {}, sound: true, channelId: ALARM_CHANNEL },
      trigger: null,
    });
  } catch {
    // Silently ignore
  }
}

type CalendarAlarmEvent = {
  id: number;
  title: string;
  type: string;
  startsAt: number | string | Date;
  notes?: string | null;
  reminderMinutes?: number;
};

async function cancelCalendarAlarms(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync?.();
  if (!Array.isArray(scheduled)) return;
  for (const item of scheduled) {
    const id = String(item?.identifier ?? "");
    if (id.startsWith(CAL_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }
  }
}

async function scheduleOne(
  identifier: string,
  fireAt: Date,
  title: string,
  body: string,
  eventId: number
): Promise<void> {
  if (fireAt.getTime() <= Date.now() + 4000) return;
  const DateType = Notifications.SchedulableTriggerInputTypes?.DATE;
  const trigger = DateType
    ? { type: DateType, date: fireAt, channelId: ALARM_CHANNEL }
    : { date: fireAt, channelId: ALARM_CHANNEL };
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title,
      body,
      data: { type: "calendar", eventId },
      sound: "default",
      channelId: ALARM_CHANNEL,
    },
    trigger,
  });
}

function dayLabel(notes?: string | null): string {
  const match = notes?.match(/^Day\s+\d+(?:\s+of\s+\d+)?/i);
  return match?.[0] ?? "";
}

function morningOf(startsAt: number): Date {
  const morning = new Date(startsAt);
  morning.setHours(8, 0, 0, 0);
  if (morning.getTime() >= startsAt - 5 * 60 * 1000) {
    morning.setHours(7, 0, 0, 0);
  }
  return morning;
}

/**
 * Schedule local alarms for calendar events:
 * - when that study/exam day arrives (08:00)
 * - at the session start time
 * - a lead reminder before exams/tests/quizzes
 */
export async function scheduleCalendarReminders(events: CalendarAlarmEvent[]): Promise<number> {
  if (!Notifications) return 0;
  try {
    const allowed = await notificationsAllowed();
    if (!allowed) return 0;
    await ensureAlarmChannel();
    await cancelCalendarAlarms();
    let count = 0;
    for (const event of events) {
      const startsAt = eventStartMs(event.startsAt);
      if (!startsAt) continue;
      const label = dayLabel(event.notes);
      const when = new Date(startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const morning = morningOf(startsAt);
      if (morning.getTime() + 60 * 1000 < startsAt) {
        await scheduleOne(
          `${CAL_PREFIX}${event.id}-day`,
          morning,
          event.type === "study" ? "Study day is here" : `${capitalize(event.type)} day is here`,
          label
            ? `${label}: ${event.title}. Session at ${when}.`
            : `${event.title} is today at ${when}.`,
          event.id
        );
        count += 1;
      }
      await scheduleOne(
        `${CAL_PREFIX}${event.id}-start`,
        new Date(startsAt),
        event.type === "study" ? "Time to study" : `${capitalize(event.type)} starting now`,
        event.title,
        event.id
      );
      count += 1;
      if (event.type !== "study" && event.type !== "other") {
        const leadMin = event.reminderMinutes ?? 60;
        await scheduleOne(
          `${CAL_PREFIX}${event.id}-lead`,
          new Date(startsAt - leadMin * 60 * 1000),
          `${capitalize(event.type)} reminder`,
          `${event.title} starts in ${leadMin} minutes.`,
          event.id
        );
        count += 1;
      }
    }
    return count;
  } catch {
    return 0;
  }
}

function capitalize(value: string): string {
  if (!value) return "Event";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Add a listener for notifications received while the app is foregrounded.
 * Returns a cleanup function. No-ops if expo-notifications is not installed.
 */
export function addNotificationListener(
  onReceived: (notification: any) => void,
  onResponse: (response: any) => void
): () => void {
  if (!Notifications) return () => {};
  const sub1 = Notifications.addNotificationReceivedListener(onReceived);
  const sub2 = Notifications.addNotificationResponseReceivedListener(onResponse);
  return () => {
    sub1?.remove();
    sub2?.remove();
  };
}
