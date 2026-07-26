import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from "react-native";
import { useState, useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";

export default function ProgressScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  const { data: progress, isLoading, refetch } = trpc.progress.stats.useQuery();
  const { data: analytics, refetch: refetchAnalytics } =
    trpc.progress.analytics.useQuery();

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchAnalytics()]);
    setRefreshing(false);
  };

  const totalStudyMins =
    progress?.reduce((s, p) => s + (p.totalStudyTimeMinutes ?? 0), 0) ?? 0;
  const totalQuizzes =
    progress?.reduce((s, p) => s + (p.quizzesAttempted ?? 0), 0) ?? 0;
  const totalFlashcards =
    progress?.reduce((s, p) => s + (p.flashcardsReviewed ?? 0), 0) ?? 0;
  const avgScore =
    progress && progress.length > 0
      ? (
          progress.reduce((s, p) => s + (p.averageQuizScore ?? 0), 0) /
          progress.length
        ).toFixed(1)
      : "0.0";
  const currentStreak = analytics?.currentStreak ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing} onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.pageTitle}>Progress</Text>
          <Text style={styles.pageSubtitle}>Your learning journey at a glance.</Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : (
            <>
              {/* Streak banner */}
              <View style={styles.streakCard}>
                <View style={styles.streakIcon}>
                  <Text style={styles.streakEmoji}>🔥</Text>
                </View>
                <View>
                  <Text style={styles.streakValue}>{currentStreak} day streak</Text>
                  <Text style={styles.streakLabel}>Keep it up!</Text>
                </View>
              </View>

              {/* Key stats */}
              <View style={styles.statsGrid}>
                <MetricCard
                  label="Study time"
                  value={`${Math.floor(totalStudyMins / 60)}h ${totalStudyMins % 60}m`}
                  icon="time"
                  accent={colors.primary}
                />
                <MetricCard
                  label="Quizzes done"
                  value={String(totalQuizzes)}
                  icon="help-circle"
                  accent="#8b5cf6"
                />
                <MetricCard
                  label="Flashcards reviewed"
                  value={String(totalFlashcards)}
                  icon="layers"
                  accent="#3b82f6"
                />
                <MetricCard
                  label="Avg quiz score"
                  value={`${avgScore}%`}
                  icon="star"
                  accent="#f59e0b"
                />
              </View>

              {/* Per-document breakdown */}
              {progress && progress.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>Document breakdown</Text>
                  {progress.map((p) => (
                    <View key={p.id} style={styles.docProgress}>
                      <View style={styles.docProgressHeader}>
                        <View style={styles.docBadge}>
                          <Ionicons
                            name="document-text"
                            size={20}
                            color={colors.primary}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.docProgressId}>
                            Document #{p.documentId}
                          </Text>
                          <Text style={styles.docProgressMeta}>
                            {p.quizzesAttempted} quiz · {p.flashcardsReviewed} cards ·{" "}
                            {p.totalStudyTimeMinutes} min
                          </Text>
                        </View>
                      </View>
                      {/* Score bar */}
                      <View style={styles.barBg}>
                        <View
                          style={[
                            styles.barFill,
                            { width: `${Math.min(p.averageQuizScore ?? 0, 100)}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.barLabel}>
                        Avg score: {(p.averageQuizScore ?? 0).toFixed(1)}%
                      </Text>
                    </View>
                  ))}
                </>
              ) : (
                <View style={styles.emptyBox}>
                  <View style={styles.emptyIconWrap}>
                    <Ionicons
                      name="trending-up-outline"
                      size={48}
                      color={colors.primary}
                    />
                  </View>
                  <Text style={styles.emptyTitle}>No activity yet</Text>
                  <Text style={styles.emptyText}>
                    Complete quizzes and review flashcards to track progress.
                  </Text>
                </View>
              )}
            </>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: string;
  accent: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: accent + "15" }]}>
        <Ionicons name={icon as any} size={22} color={accent} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 20 },
  pageTitle: { fontSize: 28, fontWeight: "800", color: colors.text, letterSpacing: -0.75 },
  pageSubtitle: { fontSize: 15, color: colors.textMuted, marginTop: 6, marginBottom: 24 },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 48,
  },
  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: colors.primary,
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  streakIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  streakEmoji: { fontSize: 30 },
  streakValue: { fontSize: 20, fontWeight: "800", color: colors.white },
  streakLabel: { fontSize: 14, color: "rgba(255,255,255,0.8)", marginTop: 3 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 32 },
  metricCard: {
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
  metricIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  metricValue: { fontSize: 24, fontWeight: "800", color: colors.text, marginBottom: 3 },
  metricLabel: { fontSize: 13, color: colors.textMuted, fontWeight: "500" },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 16 },
  docProgress: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  docProgressHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  docBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  docProgressId: { fontSize: 15, fontWeight: "600", color: colors.text },
  docProgressMeta: { fontSize: 13, color: colors.textMuted, marginTop: 3 },
  barBg: {
    height: 10,
    backgroundColor: "#e2e8f0",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 8,
  },
  barFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  barLabel: { fontSize: 13, color: colors.textMuted },
  emptyBox: { alignItems: "center", paddingVertical: 56, gap: 12 },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 20,
  },
});
