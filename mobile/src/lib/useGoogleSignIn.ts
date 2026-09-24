import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { useEffect } from "react";
import { Alert, Platform } from "react-native";

WebBrowser.maybeCompleteAuthSession();

const EXPO_GO_GOOGLE_MESSAGE =
  "Google blocks sign-in inside Expo Go because the return link starts with exp://, which Google no longer allows.\n\nCreate an account with email and password instead. Google Sign-In works after you install a development or production build of Cognify.";

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
        Alert.alert("Google Sign-In unavailable in Expo Go", EXPO_GO_GOOGLE_MESSAGE);
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
