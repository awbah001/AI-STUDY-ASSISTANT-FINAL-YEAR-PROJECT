import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { getAuthSessionKey, subscribeAuthSession } from "../src/lib/authSession";
import { trpc, createTrpcClient } from "../src/lib/api";
import {
  registerForPushNotifications,
  addNotificationListener,
} from "../src/lib/notifications";

SplashScreen.preventAutoHideAsync();

function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        gcTime: 0,
        retry: 1,
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 4_000),
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
  });
}

export default function RootLayout() {
  const [loaded] = useFonts({});
  const sessionKey = useSyncExternalStore(subscribeAuthSession, getAuthSessionKey, getAuthSessionKey);
  const queryClient = useMemo(() => createAppQueryClient(), [sessionKey]);
  const trpcClient = useMemo(() => createTrpcClient(), [sessionKey]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <AuthProvider>
            <StatusBar style="dark" backgroundColor="#f4f6f9" />
            <AuthedNavigation />
          </AuthProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

function AuthedNavigation() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const sessionKey = user?.id != null ? `user-${user.id}` : "guest";

  useEffect(() => {
    registerForPushNotifications();
    const cleanup = addNotificationListener(
      () => {
        queryClient.invalidateQueries();
      },
      (response) => {
        const data = response.notification.request.content.data as {
          courseId?: number;
          type?: string;
        };
        queryClient.invalidateQueries();
        if (data?.type === "calendar") router.push("/(tabs)/planner");
        else if (data?.courseId) router.push({ pathname: "/course/[id]", params: { id: String(data.courseId) } });
        else router.push("/notifications");
      }
    );
    return cleanup;
  }, [queryClient, router]);

  return (
    <Stack
      key={sessionKey}
      initialRouteName="index"
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#f5f6fa" } }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="flashcard-study" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="upload-document" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="submit-assignment" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="notifications" options={{ headerShown: false, presentation: "card" }} />
    </Stack>
  );
}
