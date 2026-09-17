import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BackHeader } from "../../src/components/BackHeader";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"]; // kept as fallback label set

// Topics to show in the "Topics Mastered" section — pulled from progress data
const TOPIC_COLORS = [colors.primary, "#f59e0b", "#3b82f6", "#8b5cf6", "#ef4444"];

export default function ProgressScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const { data: progress, isLoading, refetch } = trpc.progress.stats.useQuery();
  const { data: analytics, refetch: refetchA } = trpc.progress.analytics.useQuery();

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchA()]);
    setRefreshing(false);
  };

  const streak = analytics?.currentStreak ?? 0;
  const totalMins =
    analytics?.totalStudyTime ??
    progress?.reduce((s, p) => s + (p.totalStudyTimeMinutes ?? 0), 0) ??
    0;
  const studyH = Math.floor(totalMins / 60);
  const studyM = totalMins % 60;
  const quizzesTaken =
    progress?.reduce((s, p) => s + (p.quizzesAttempted ?? 0), 0) ?? 0;
  const flashReviewed =
    progress?.reduce((s, p) => s + (p.flashcardsReviewed ?? 0), 0) ?? 0;
  const scored = (progress ?? []).filter((p) => (p.quizzesAttempted ?? 0) > 0);
  const avgScore =
    scored.length > 0
      ? Math.round(
          scored.reduce((s, p) => s + (p.averageQuizScore ?? 0), 0) / scored.length
        )
      : 0;

  // ── Real 7-day chart from analytics.dailyData ──────────────────────────────
  // dailyData is an array of 7 items, index 0 = 6 days ago, index 6 = today
  const dailyData = analytics?.dailyData ?? [];

  // Map real minutes to bar heights (max 80px)
  const rawMins = dailyData.map((d) => d.totalMinutes ?? 0);
  const maxMins = Math.max(...rawMins, 1); // avoid ÷0
  const bars = rawMins.map((m) => Math.max(m > 0 ? 8 : 4, Math.round((m / maxMins) * 80)));

  // Day labels from the data (Sun/Mon/Tue… from server)
  const dayLabels = dailyData.length === 7
    ? dailyData.map((d) => d.dayLabel.charAt(0)) // single letter: M T W…
    : ["M", "T", "W", "T", "F", "S", "S"];

  // Today is always the last item (index 6)
  const todayIdx = dailyData.length - 1;

  // Topics mastered from real progress data
  const topics = (progress ?? [])
    .filter(
      (p) =>
        (p.averageQuizScore ?? 0) > 0 ||
        (p.quizzesAttempted ?? 0) > 0 ||
        (p.flashcardsReviewed ?? 0) > 0 ||
        (p.totalStudyTimeMinutes ?? 0) > 0
    )
    .map((p, i) => ({
      name: p.documentTitle ?? `Material ${i + 1}`,
      pct: Math.min(
        Math.round(
          (p.averageQuizScore ?? 0) > 0
            ? p.averageQuizScore ?? 0
            : Math.min((p.flashcardsReviewed ?? 0) * 10 + (p.totalStudyTimeMinutes ?? 0), 100)
        ),
        100
      ),
      meta: `${p.quizzesAttempted ?? 0} quizzes · ${p.flashcardsReviewed ?? 0} cards`,
      color: TOPIC_COLORS[i % TOPIC_COLORS.length],
    }));

  const studiedDays = dailyData.map((d) => (d.totalMinutes ?? 0) > 0);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── Header ── */}
        <BackHeader title="My Progress" subtitle="Your real study activity" />

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={s.statsGrid}>
              <View style={s.statCard}>
                <Text style={s.statLabel}>Study time</Text>
                <Text style={s.statValue}>
                  {studyH}h {studyM}m
                </Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statLabel}>Quizzes taken</Text>
                <Text style={s.statValue}>{quizzesTaken}</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statLabel}>Flashcards reviewed</Text>
                <Text style={s.statValue}>{flashReviewed}</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statLabel}>Average quiz score</Text>
                <Text style={s.statValue}>{scored.length ? `${avgScore}%` : "—"}</Text>
              </View>
            </View>
            {/* ── 7 Day Streak card ── */}
            <View style={s.streakCard}>
              {/* top row */}
              <View style={s.streakTop}>
                <View style={s.streakTitleRow}>
                  <Text style={s.streakEmoji}>🔥</Text>
                  <Text style={s.streakTitle}>{streak} Day Streak</Text>
                </View>
                <TouchableOpacity style={s.streakMore}>
                  <Ionicons name="ellipsis-horizontal" size={16} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
              </View>
              <Text style={s.streakSub}>Keep up the great work!</Text>

              {/* day dots */}
              <View style={s.dayRow}>
                {dayLabels.map((d, i) => {
                  const done = studiedDays[i] === true;
                  const today = i === todayIdx;
                  return (
                    <View key={`${d}-${i}`} style={s.dayCol}>
                      <Text style={[s.dayLetter, (done || today) && s.dayLetterDone]}>
                        {d}
                      </Text>
                      <View
                        style={[
                          s.daydot,
                          done && s.daydotDone,
                          today && s.daydotToday,
                        ]}
                      >
                        {done && (
                          <Ionicons name="checkmark" size={11} color={colors.primary} />
                        )}
                        {today && !done && (
                          <Ionicons name="flame" size={11} color="#f59e0b" />
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* ── Study Time chart ── */}
            <View style={s.chartCard}>
              <View style={s.chartHeader}>
                <Text style={s.chartTitle}>Study Time</Text>
                <View style={s.chartRight}>
                  <Text style={s.chartValue}>
                    {studyH}h {studyM}m
                  </Text>
                  {/* Show total study minutes this week */}
                  <Text style={s.chartChange}>
                    {rawMins.reduce((a, b) => a + b, 0) > 0
                      ? `${rawMins.reduce((a, b) => a + b, 0)}m this week`
                      : "No activity yet"}
                  </Text>
                  <View style={s.weekPill}>
                    <Text style={s.weekPillText}>This Week</Text>
                  </View>
                </View>
              </View>

              {/* bar chart */}
              <View style={s.barsRow}>
                {bars.map((h, i) => (
                  <View key={i} style={s.barCol}>
                    {/* minute label above bar when > 0 */}
                    {rawMins[i] > 0 && (
                      <Text style={s.barMinLabel}>
                        {rawMins[i] >= 60
                          ? `${Math.floor(rawMins[i] / 60)}h`
                          : `${rawMins[i]}m`}
                      </Text>
                    )}
                    <View style={s.barTrack}>
                      <View
                        style={[
                          s.barFill,
                          {
                            height: h,
                            backgroundColor:
                              i === todayIdx ? colors.primary : "#bbf7d0",
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        s.barLabel,
                        i === todayIdx && { color: colors.primary, fontWeight: "700" },
                      ]}
                    >
                      {dayLabels[i] ?? DAYS[i]}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* ── Topics Mastered ── */}
            <View style={s.topicsHeader}>
              <Text style={s.sectionTitle}>Materials</Text>
            </View>

            <View style={s.topicsCard}>
              {topics.length === 0 ? (
                <Text style={s.emptyTopics}>
                  Study a document or take a quiz to see progress here.
                </Text>
              ) : (
                topics.map((t, i) => (
                  <View
                    key={t.name + i}
                    style={[
                      s.topicRow,
                      i < topics.length - 1 && s.topicRowBorder,
                    ]}
                  >
                    <View style={s.topicNameCol}>
                      <Text style={s.topicName} numberOfLines={1}>
                        {t.name}
                      </Text>
                      <Text style={s.topicMeta} numberOfLines={1}>
                        {t.meta}
                      </Text>
                    </View>
                    <View style={s.topicBarBg}>
                      <View
                        style={[
                          s.topicBarFill,
                          { width: `${t.pct}%` as any, backgroundColor: t.color },
                        ]}
                      />
                    </View>
                    <Text style={[s.topicPct, { color: t.color }]}>{t.pct}%</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5f6fa" },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },

  header: { marginBottom: 20 },
  title: { fontSize: 22, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    width: "48%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  statValue: { fontSize: 20, fontWeight: "800", color: colors.text, marginTop: 6 },

  // Streak card — green
  streakCard: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  streakTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  streakTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  streakEmoji: { fontSize: 18 },
  streakTitle: { fontSize: 16, fontWeight: "800", color: colors.white },
  streakMore: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  streakSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 16,
  },

  // Day dots row
  dayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayCol: { alignItems: "center", gap: 5 },
  dayLetter: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.55)",
  },
  dayLetterDone: { color: colors.white },
  daydot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  daydotDone: { backgroundColor: colors.white },
  daydotToday: { backgroundColor: "#fff3cd" },

  // Study Time chart card
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  chartTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  chartRight: { alignItems: "flex-end", gap: 3 },
  chartValue: { fontSize: 20, fontWeight: "800", color: colors.text },
  chartChange: { fontSize: 12, fontWeight: "700", color: colors.primary },
  weekPill: {
    backgroundColor: "#e8fdf2",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 2,
  },
  weekPillText: { fontSize: 11, fontWeight: "600", color: colors.primary },

  barsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 110,
  },
  barCol: { flex: 1, alignItems: "center", gap: 6 },
  barMinLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.textMuted,
    marginBottom: 2,
  },
  barTrack: {
    width: 18,
    height: 80,
    borderRadius: 9,
    backgroundColor: "#f1f5f9",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: { width: "100%", borderRadius: 9 },
  barLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "500" },

  // Topics Mastered
  topicsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  viewAll: { fontSize: 13, color: colors.primary, fontWeight: "700" },

  topicsCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  topicRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  topicRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topicNameCol: { width: 108 },
  topicName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  topicMeta: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  topicBarBg: {
    flex: 1,
    height: 7,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    overflow: "hidden",
  },
  topicBarFill: { height: "100%", borderRadius: 4 },
  topicPct: {
    width: 36,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },
  emptyTopics: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: 18,
  },
});
