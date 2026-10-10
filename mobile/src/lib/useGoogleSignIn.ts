import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { useEffect } from "react";
import { Alert, Platform } from "react-native";

WebBrowser.maybeCompleteAuthSession();

const EXPO_GO_GOOGLE_MESSAGE =
  "Google doesn't allow sign-in from inside Expo Go.\n\nFor now, sign in with your email and password. Google Sign-In works in the installed version of the app.";

export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type GoogleSignIn = {
  ready: boolean;
  configured: boolean;
  blockedInExpoGo: boolean;
  prompt: () => Promise<void>;
};

export function useGoogleSignIn(onIdToken: (idToken: string) => void): GoogleSignIn {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
  const iosClientId = isExpoGo ? "" : process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
  const androidClientId = isExpoGo ? "" : process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "";
  const clientId = (Platform.OS === "ios" ? iosClientId : androidClientId) || webClientId;
  const configured = Boolean(webClientId || iosClientId || androidClientId);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: clientId || "unconfigured.apps.googleusercontent.com",
    webClientId: webClientId || clientId,
    iosClientId: iosClientId || undefined,
    androidClientId: androidClientId || undefined,
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
    ready: configured && (isExpoGo || Boolean(request)),
    configured,
    blockedInExpoGo: isExpoGo,
    prompt: async () => {
      if (isExpoGo) {
        Alert.alert("Google Sign-In not available here", EXPO_GO_GOOGLE_MESSAGE);
        return;
      }
      if (!configured) {
        Alert.alert(
          "Google sign-in",
          "Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in mobile/.env and restart Expo."
        );
        return;
      }
      await promptAsync();
    },
  };
}
