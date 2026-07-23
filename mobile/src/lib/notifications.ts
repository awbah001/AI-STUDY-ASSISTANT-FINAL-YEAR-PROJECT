import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Configure how notifications appear when the app is in the foreground.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Request notification permissions and return the Expo push token.
 * Returns null if permissions are denied or the device can't receive push.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Push tokens only work on physical devices
  if (Platform.OS === "web") return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch {
    // Simulator or environment doesn't support push tokens
    return null;
  }
}

/**
 * Show a local notification immediately (no server needed).
 * Used to notify students of new announcements when the app is open.
 */
export async function showLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data ?? {},
      sound: true,
    },
    trigger: null, // fire immediately
  });
}
