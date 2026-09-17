import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/contexts/AuthContext";
import { trpc, createTrpcClient } from "../src/lib/api";
import {
  registerForPushNotifications,
  addNotificationListener,
} from "../src/lib/notifications";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1, retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 4_000), refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    },
  }));
  const [trpcClient] = useState(() => createTrpcClient());

  const [loaded] = useFonts({});

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  useEffect(() => {
    // Request push permission on mount (no-ops if expo-notifications not installed)
    registerForPushNotifications();

    // Listen for notifications
    const cleanup = addNotificationListener(
      () => {
        // Refresh the inbox/badge as soon as a foreground notification arrives.
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

  if (!loaded) return null;

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <AuthProvider>
            <StatusBar style="dark" backgroundColor="#f4f6f9" />
            <Stack
              initialRouteName="index"
              screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#f5f6fa" } }}
            >
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="flashcard-study" options={{ headerShown: false, presentation: "card" }} />
              <Stack.Screen name="upload-document" options={{ headerShown: false, presentation: "card" }} />
              <Stack.Screen name="submit-assignment" options={{ headerShown: false, presentation: "card" }} />
              <Stack.Screen name="notifications" options={{ headerShown: false, presentation: "card" }} />
            </Stack>
          </AuthProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
