/**
 * Push / local notification helpers.
 * Uses expo-notifications if available, silently no-ops if not installed yet.
 */

let Notifications: any = null;

// Lazy-load expo-notifications so the app doesn't crash if it's not installed
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

/**
 * Request notification permissions and return the Expo push token.
 * Returns null if permissions are denied or expo-notifications is not installed.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Notifications) return null;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch {
    return null;
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
      content: { title, body, data: data ?? {}, sound: true },
      trigger: null,
    });
  } catch {
    // Silently ignore
  }
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
