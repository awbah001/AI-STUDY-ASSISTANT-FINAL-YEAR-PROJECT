import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";

export default function ProgressScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const { data: progress, isLoading, refetch } = trpc.progress.stats.useQuery();
  const { data: analytics, refetch: refetchAnalytics } =
    trpc.progress.analytics.useQuery();

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
  const currentStreak =
    analytics?.currentStreak ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.pageTitle}>Progress</Text>
        <Text style={styles.pageSubtitle}>Your learning journey at a glance.</Text>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
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
                          size={16}
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
                <Ionicons
                  name="trending-up-outline"
                  size={48}
                  color={colors.primaryLight}
                />
                <Text style={styles.emptyTitle}>No activity yet</Text>
                <Text style={styles.emptyText}>
                  Complete quizzes and review flashcards to track progress.
                </Text>
              </View>
            )}
          </>
        )}
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
    <View style={[styles.metricCard, { borderTopColor: accent }]}>
      <View style={[styles.metricIcon, { backgroundColor: accent + "20" }]}>
        <Ionicons name={icon as any} size={18} color={accent} />
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
  pageTitle: { fontSize: 26, fontWeight: "800", color: colors.text, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4, marginBottom: 20 },
  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
  },
  streakIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  streakEmoji: { fontSize: 26 },
  streakValue: { fontSize: 18, fontWeight: "800", color: colors.white },
  streakLabel: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 28 },
  metricCard: {
    width: "47%",
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderTopWidth: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  metricValue: { fontSize: 20, fontWeight: "800", color: colors.text, marginBottom: 2 },
  metricLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 14 },
  docProgress: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  docProgressHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  docBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  docProgressId: { fontSize: 14, fontWeight: "600", color: colors.text },
  docProgressMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  barBg: {
    height: 8,
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 6,
  },
  barFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  barLabel: { fontSize: 12, color: colors.textMuted },
  emptyBox: { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 260,
  },
});
