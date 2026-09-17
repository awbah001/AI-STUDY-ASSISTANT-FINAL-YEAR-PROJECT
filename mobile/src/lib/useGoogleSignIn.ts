import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";

WebBrowser.maybeCompleteAuthSession();

type GoogleSignIn = {
  ready: boolean;
  configured: boolean;
  prompt: () => Promise<void>;
};

export function useGoogleSignIn(onIdToken: (idToken: string) => void): GoogleSignIn {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "";
  const clientId = iosClientId || androidClientId || webClientId;
  const configured = Boolean(clientId);

  // Expo's Google hook requires the platform-specific field (iosClientId on iOS).
  // Until native iOS/Android OAuth clients exist, reuse the Web client ID.
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: clientId || "unconfigured.apps.googleusercontent.com",
    webClientId: webClientId || clientId,
    iosClientId: iosClientId || clientId,
    androidClientId: androidClientId || clientId,
    scopes: ["openid", "profile", "email"],
  });

  useEffect(() => {
    if (response?.type !== "success") return;
    const idToken =
      response.params.id_token ||
      response.authentication?.idToken ||
      "";
    if (idToken) onIdToken(idToken);
  }, [response, onIdToken]);

  return {
    ready: configured && Boolean(request),
    configured,
    prompt: async () => {
      await promptAsync();
    },
  };
}
