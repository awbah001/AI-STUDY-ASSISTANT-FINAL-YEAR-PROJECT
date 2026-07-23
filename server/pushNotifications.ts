/**
 * Expo Push Notification helper.
 * Uses Expo's free push API — no Firebase/APNs credentials needed for Expo Go.
 * Docs: https://docs.expo.dev/push-notifications/sending-notifications/
 */

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
}

/**
 * Send push notifications to one or more Expo push tokens.
 * Silently ignores invalid tokens.
 */
export async function sendPushNotifications(
  tokens: (string | null | undefined)[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  const validTokens = tokens.filter(
    (t): t is string => typeof t === "string" && t.startsWith("ExponentPushToken[")
  );

  if (validTokens.length === 0) return;

  const messages: ExpoPushMessage[] = validTokens.map((to) => ({
    to,
    title,
    body,
    sound: "default",
    data: data ?? {},
  }));

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.error("[Push] Failed to send notifications:", response.status);
      return;
    }

    const result = await response.json() as { data: ExpoPushTicket[] };
    const errors = result.data?.filter((t) => t.status === "error") ?? [];
    if (errors.length > 0) {
      console.warn("[Push] Some notifications failed:", errors);
    }
  } catch (err) {
    console.error("[Push] Error sending notifications:", err);
  }
}
