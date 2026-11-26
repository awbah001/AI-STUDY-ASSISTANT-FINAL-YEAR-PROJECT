import { WifiLoader as ActivityIndicator } from "../../src/components/ui/WifiLoader";
import {
  centerTabOptions,
  toneTab,
  useWorkspaceTabOptions,
} from "../../src/components/staff/StaffUi";
import { Redirect, Tabs, router } from "expo-router";
import { View, TouchableOpacity, StyleSheet, Platform, Text } from "react-native";
import { trpc } from "../../src/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { design, layout, spacing } from "../../src/theme/design";
import { colors } from "../../src/theme/colors";
import { useAuth } from "../../src/contexts/AuthContext";
import { homeForRole } from "../../src/lib/roleHome";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";

export default function TabLayout() {
  const { user, loading } = useAuth();
  const navigationStyle = useWorkspaceTabOptions();
  const profile = trpc.studentLearning.onboardingStatus.useQuery(undefined, { enabled: user?.role === "user" });
  if (loading) return <ActivityIndicator color={colors.primary} />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user && user.role !== "user")
    return <Redirect href={homeForRole(user.role) as any} />;
  if (profile.isError) return (
    <View style={styles.recovery}>
      <Text accessibilityRole="header" style={design.sectionTitle}>Let's reconnect</Text>
      <Text accessibilityRole="alert" style={design.body}>Unable to load your profile. Check your connection and try again.</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: profile.isFetching, busy: profile.isFetching }} disabled={profile.isFetching} style={[styles.retry, profile.isFetching && styles.disabled]} onPress={() => profile.refetch()}><Text style={design.actionText}>{profile.isFetching ? "Retrying?" : "Try again"}</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" style={styles.offline} onPress={() => router.push("/offline-study" as any)}><Text style={styles.offlineText}>Study downloaded materials</Text></TouchableOpacity>
    </View>
  );
  if (!profile.data) return <ActivityIndicator color={colors.primary} />;
  if (!profile.data.completed) return <Redirect href="/onboarding" />;
  return (
    <Tabs
      key={user?.id != null ? `tabs-${user.id}` : "tabs-guest"}
      initialRouteName="dashboard"
      screenOptions={navigationStyle}
    >
      <Tabs.Screen
        name="dashboard"
        options={toneTab("Home", "home", "home-outline", "emerald")}
      />
      <Tabs.Screen
        name="courses"
        options={toneTab("Courses", "book", "book-outline", "blue")}
      />
      <Tabs.Screen
        name="askai"
        options={centerTabOptions("Ask AI", "sparkles")}
      />
      <Tabs.Screen
        name="planner"
        options={toneTab("Planner", "calendar", "calendar-outline", "amber")}
      />
      <Tabs.Screen
        name="profile"
        options={toneTab("Profile", "person", "person-outline", "violet")}
      />
      <Tabs.Screen name="library" options={{ href: null }} />
      <Tabs.Screen name="documents" options={{ href: null }} />
      <Tabs.Screen name="flashcards" options={{ href: null }} />
      <Tabs.Screen name="quizzes" options={{ href: null }} />
      <Tabs.Screen name="progress" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  recovery: { flex: 1, justifyContent: "center", padding: spacing.xl, gap: spacing.lg, backgroundColor: colors.bg },
  retry: { ...design.action, minHeight: layout.touchTarget },
  disabled: { opacity: 0.6 },
  offline: { ...design.card, minHeight: layout.touchTarget, padding: spacing.md, alignItems: "center", justifyContent: "center" },
  offlineText: { ...design.body, color: colors.primary, fontWeight: "700", textAlign: "center" },
});
