import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/contexts/AuthContext";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  const { data: documents, isLoading: docsLoading, refetch: refetchDocs } =
    trpc.documents.list.useQuery();
  const { data: progress, isLoading: progressLoading, refetch: refetchProgress } =
    trpc.progress.stats.useQuery();

  const firstName = user?.name?.split(/\s+/)[0] ?? "there";
  const totalDocuments = documents?.length ?? 0;
  const totalFlashcards =
    progress?.reduce((s, p) => s + (p.flashcardsReviewed ?? 0), 0) ?? 0;
  const totalQuizzes =
    progress?.reduce((s, p) => s + (p.quizzesAttempted ?? 0), 0) ?? 0;
  const totalStudyMins =
    progress?.reduce((s, p) => s + (p.totalStudyTimeMinutes ?? 0), 0) ?? 0;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchDocs(), refetchProgress()]);
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Welcome back 👋</Text>
              <Text style={styles.name}>Hi, {firstName}</Text>
            </View>
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={() => router.push("/profile")}
              activeOpacity={0.7}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.name?.charAt(0).toUpperCase() ?? "?"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Welcome Card */}
          <View style={styles.welcomeCard}>
            <View style={styles.welcomeContent}>
              <View>
                <Text style={styles.welcomeTitle}>Ready to learn?</Text>
                <Text style={styles.welcomeSubtitle}>
                  Pick up where you left off or explore new content
                </Text>
              </View>
              <View style={styles.welcomeIcon}>
                <Ionicons name="sparkles" size={32} color={colors.white} />
              </View>
            </View>
          </View>

          {/* Stats grid */}
          <Text style={styles.sectionTitle}>Your stats</Text>
          <View style={styles.statsGrid}>
            <StatCard
              label="Documents"
              value={docsLoading ? null : totalDocuments}
              icon="document-text"
              accent={colors.primary}
            />
            <StatCard
              label="Flashcards"
              value={progressLoading ? null : totalFlashcards}
              icon="layers"
              accent="#3b82f6"
            />
            <StatCard
              label="Quizzes"
              value={progressLoading ? null : totalQuizzes}
              icon="help-circle"
              accent="#8b5cf6"
            />
            <StatCard
              label="Study time"
              value={
                progressLoading
                  ? null
                  : `${Math.floor(totalStudyMins / 60)}h ${totalStudyMins % 60}m`
              }
              icon="time"
              accent="#f59e0b"
            />
          </View>

          {/* Quick actions */}
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={styles.actions}>
            <QuickAction
              icon="book"
              label="My Courses"
              accent={colors.primary}
              onPress={() => router.push("/(tabs)/courses")}
            />
            <QuickAction
              icon="layers"
              label="Flashcards"
              accent="#3b82f6"
              onPress={() => router.push("/(tabs)/flashcards")}
            />
            <QuickAction
              icon="document-text"
              label="Documents"
              accent="#8b5cf6"
              onPress={() => router.push("/(tabs)/documents")}
            />
            <QuickAction
              icon="trending-up"
              label="Progress"
              accent="#f59e0b"
              onPress={() => router.push("/(tabs)/progress")}
            />
          </View>

          {/* Recent documents */}
          <Text style={styles.sectionTitle}>Recent documents</Text>
          {docsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : documents && documents.length > 0 ? (
            documents.slice(0, 5).map((doc) => (
              <TouchableOpacity
                key={doc.id}
                style={styles.docItem}
                onPress={() =>
                  router.push({ pathname: "/document/[id]", params: { id: doc.id } })
                }
                activeOpacity={0.7}
              >
                <View style={styles.docIconWrap}>
                  <Ionicons name="document-text" size={24} color={colors.primary} />
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docTitle} numberOfLines={2}>
                    {doc.title}
                  </Text>
                  <Text style={styles.docMeta}>
                    {new Date(doc.createdAt).toLocaleDateString(undefined, {
                      dateStyle: "medium",
                    })}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="cloud-upload-outline" size={48} color={colors.primary} />
              </View>
              <Text style={styles.emptyText}>No documents yet</Text>
              <Text style={styles.emptySubtext}>
                Your lecturer will share course materials here.
              </Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number | string | null;
  icon: string;
  accent: string;
}) {
  const [scale] = useState(new Animated.Value(1));

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[styles.statCard, { transform: [{ scale }] }]}
      onTouchStart={handlePressIn}
      onTouchEnd={handlePressOut}
    >
      <View style={[styles.statIcon, { backgroundColor: accent + "15" }]}>
        <Ionicons name={icon as any} size={22} color={accent} />
      </View>
      {value === null ? (
        <ActivityIndicator size="small" color={accent} style={{ marginVertical: 8 }} />
      ) : (
        <Text style={styles.statValue}>{value}</Text>
      )}
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

function QuickAction({
  icon,
  label,
  accent,
  onPress,
}: {
  icon: string;
  label: string;
  accent: string;
  onPress: () => void;
}) {
  const [scale] = useState(new Animated.Value(1));

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      style={styles.quickActionPressable}
      activeOpacity={1}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
    >
      <Animated.View style={[styles.quickAction, { transform: [{ scale }] }]}>
        <View style={[styles.qaIcon, { backgroundColor: accent + "12" }]}>
          <Ionicons name={icon as any} size={26} color={accent} />
        </View>
        <Text style={styles.qaLabel}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 16,
    paddingBottom: 24,
  },
  greeting: { fontSize: 14, color: colors.textMuted, fontWeight: "500" },
  name: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.75,
  },
  avatarBtn: {},
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarText: { fontSize: 20, fontWeight: "800", color: colors.white },
  welcomeCard: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    padding: 20,
    marginBottom: 28,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  welcomeContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.white,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: "#d1fae5",
    maxWidth: "75%",
    lineHeight: 20,
  },
  welcomeIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    width: "47%",
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  statValue: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 4,
  },
  statLabel: { fontSize: 13, color: colors.textMuted, fontWeight: "500" },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 16,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 28,
  },
  quickActionPressable: {
    width: "47%",
  },
  quickAction: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  qaIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  qaLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
    lineHeight: 20,
  },
  docItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  docIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  docInfo: { flex: 1 },
  docTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    lineHeight: 22,
  },
  docMeta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { fontSize: 16, fontWeight: "600", color: colors.text },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 20,
  },
});
