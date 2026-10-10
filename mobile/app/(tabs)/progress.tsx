import { design } from "../../src/theme/design";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BackHeader } from "../../src/components/BackHeader";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";
import {
  EmptyCard,
  HeroGradient,
  IconTile,
  Pill,
  ProgressBar,
  SectionHeader,
} from "../../src/components/ui/Kit";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

const TOPIC_COLORS = [
  colors.primary,
  "#d97706",
  colors.info,
  colors.violet,
  colors.error,
];

export default function ProgressScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const { data: progress, isLoading, refetch } = trpc.progress.stats.useQuery();
  const { data: analytics, refetch: refetchA } =
    trpc.progress.analytics.useQuery();
  const { data: dash, refetch: refetchDash } =
    trpc.studentLearning.dashboard.useQuery();

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchA(), refetchDash()]);
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
  const scored = (progress ?? []).filter(p => (p.quizzesAttempted ?? 0) > 0);
  const avgScore =
    scored.length > 0
      ? Math.round(
          scored.reduce((s, p) => s + (p.averageQuizScore ?? 0), 0) /
            scored.length
        )
      : 0;

  // dailyData holds 7 items: index 0 = 6 days ago, index 6 = today
  const dailyData = analytics?.dailyData ?? [];
  const rawMins = dailyData.map(d => d.totalMinutes ?? 0);
  const maxMins = Math.max(...rawMins, 1);
  const bars = rawMins.map(m =>
    Math.max(m > 0 ? 8 : 4, Math.round((m / maxMins) * 96))
  );
  const weekMins = rawMins.reduce((a, b) => a + b, 0);

  const dayLabels =
    dailyData.length === 7
      ? dailyData.map(d => d.dayLabel.charAt(0))
      : DAYS;
  const todayIdx = dailyData.length - 1;

  const topics = (progress ?? [])
    .filter(
      p =>
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
            ? (p.averageQuizScore ?? 0)
            : Math.min(
                (p.flashcardsReviewed ?? 0) * 10 +
                  (p.totalStudyTimeMinutes ?? 0),
                100
              )
        ),
        100
      ),
      meta: `${p.quizzesAttempted ?? 0} quizzes · ${p.flashcardsReviewed ?? 0} cards`,
      color: TOPIC_COLORS[i % TOPIC_COLORS.length],
    }));

  const studiedDays = dailyData.map(d => (d.totalMinutes ?? 0) > 0);
  const activeDays = studiedDays.filter(Boolean).length;

  const stats = [
    {
      icon: "time-outline" as const,
      label: "Study time",
      value: `${studyH}h ${studyM}m`,
      fg: colors.primary,
      bg: colors.primaryLight,
    },
    {
      icon: "help-circle-outline" as const,
      label: "Quizzes taken",
      value: `${quizzesTaken}`,
      fg: "#d97706",
      bg: colors.warningSoft,
    },
    {
      icon: "layers-outline" as const,
      label: "Cards reviewed",
      value: `${flashReviewed}`,
      fg: colors.info,
      bg: colors.infoSoft,
    },
    {
      icon: "trophy-outline" as const,
      label: "Avg quiz score",
      value: scored.length ? `${avgScore}%` : "—",
      fg: colors.violet,
      bg: colors.violetSoft,
    },
  ];

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
        <BackHeader title="My progress" subtitle="Your real study activity" />

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <HeroGradient style={s.streakCard}>
              <View style={s.streakTop}>
                <View style={s.flame}>
                  <Ionicons name="flame" size={22} color="#fbbf24" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.streakTitle}>
                    {streak} day streak
                  </Text>
                  <Text style={s.streakSub}>
                    {activeDays > 0
                      ? `Active ${activeDays} of the last 7 days`
                      : "Study today to start a streak"}
                  </Text>
                </View>
              </View>

              <View style={s.dayRow}>
                {dayLabels.map((d, i) => {
                  const done = studiedDays[i] === true;
                  const today = i === todayIdx;
                  return (
                    <View key={`${d}-${i}`} style={s.dayCol}>
                      <View
                        style={[
                          s.daydot,
                          done && s.daydotDone,
                          today && !done && s.daydotToday,
                        ]}
                      >
                        {done ? (
                          <Ionicons
                            name="checkmark"
                            size={14}
                            color={colors.primary}
                          />
                        ) : today ? (
                          <Ionicons name="flame" size={13} color="#fbbf24" />
                        ) : null}
                      </View>
                      <Text
                        style={[
                          s.dayLetter,
                          (done || today) && s.dayLetterDone,
                        ]}
                      >
                        {d}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </HeroGradient>

            <View style={s.statsGrid}>
              {stats.map(st => (
                <View key={st.label} style={s.statCard}>
                  <IconTile
                    icon={st.icon}
                    color={st.fg}
                    bg={st.bg}
                    size={36}
                    iconSize={18}
                  />
                  <Text style={s.statValue}>{st.value}</Text>
                  <Text style={s.statLabel}>{st.label}</Text>
                </View>
              ))}
            </View>

            {(dash?.insights?.length ?? 0) > 0 && (
              <View style={s.infoCard}>
                <View style={s.infoHead}>
                  <IconTile
                    icon="bulb-outline"
                    color={colors.primary}
                    bg={colors.primaryLight}
                    size={34}
                    iconSize={17}
                  />
                  <Text style={s.infoTitle}>Insights</Text>
                </View>
                {dash!.insights.map(line => (
                  <View key={line} style={s.infoLine}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={s.infoText}>{line}</Text>
                  </View>
                ))}
              </View>
            )}

            {(dash?.weakTopics?.length ?? 0) > 0 && (
              <View style={s.infoCard}>
                <View style={s.infoHead}>
                  <IconTile
                    icon="alert-circle-outline"
                    color="#d97706"
                    bg={colors.warningSoft}
                    size={34}
                    iconSize={17}
                  />
                  <Text style={s.infoTitle}>Needs review</Text>
                </View>
                {dash!.weakTopics.map(topic => (
                  <View
                    key={`${topic.courseId}-${topic.topic}`}
                    style={s.weakRow}
                  >
                    <Text style={s.weakTopic} numberOfLines={2}>
                      {topic.topic}
                    </Text>
                    {topic.lastScore != null && (
                      <Pill
                        label={`${Math.round(topic.lastScore)}%`}
                        color="#b45309"
                        bg={colors.warningSoft}
                      />
                    )}
                  </View>
                ))}
              </View>
            )}

            <View style={s.chartCard}>
              <View style={s.chartHeader}>
                <View>
                  <Text style={s.chartTitle}>Study time</Text>
                  <Text style={s.chartSub}>
                    {weekMins > 0 ? `${weekMins}m this week` : "No activity yet"}
                  </Text>
                </View>
                <View style={s.chartRight}>
                  <Text style={s.chartValue}>
                    {studyH}h {studyM}m
                  </Text>
                  <Text style={s.chartCaption}>all time</Text>
                </View>
              </View>

              <View style={s.barsRow}>
                {bars.map((h, i) => {
                  const today = i === todayIdx;
                  return (
                    <View key={i} style={s.barCol}>
                      <Text style={s.barMinLabel}>
                        {rawMins[i] > 0
                          ? rawMins[i] >= 60
                            ? `${Math.floor(rawMins[i] / 60)}h`
                            : `${rawMins[i]}m`
                          : " "}
                      </Text>
                      <View style={s.barTrack}>
                        <View
                          style={[
                            s.barFill,
                            {
                              height: h,
                              backgroundColor: today
                                ? colors.primary
                                : rawMins[i] > 0
                                  ? colors.accent
                                  : colors.primaryMuted,
                            },
                          ]}
                        />
                      </View>
                      <View style={[s.barDay, today && s.barDayToday]}>
                        <Text
                          style={[s.barLabel, today && s.barLabelToday]}
                        >
                          {dayLabels[i] ?? DAYS[i]}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            <SectionHeader title="Materials" />

            {topics.length === 0 ? (
              <EmptyCard
                icon="bar-chart-outline"
                title="No activity yet"
                body="Study a document or take a quiz to see progress here."
              />
            ) : (
              <View style={s.topicsCard}>
                {topics.map((t, i) => (
                  <View
                    key={t.name + i}
                    style={[
                      s.topicRow,
                      i < topics.length - 1 && s.topicRowBorder,
                    ]}
                  >
                    <View style={s.topicTop}>
                      <View style={[s.topicDot, { backgroundColor: t.color }]} />
                      <Text style={s.topicName} numberOfLines={1}>
                        {t.name}
                      </Text>
                      <Text style={[s.topicPct, { color: t.color }]}>
                        {t.pct}%
                      </Text>
                    </View>
                    <ProgressBar
                      value={t.pct}
                      color={t.color}
                      track={colors.borderLight}
                      height={7}
                    />
                    <Text style={s.topicMeta} numberOfLines={1}>
                      {t.meta}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, ...design.page },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },

  streakCard: { padding: 20, marginBottom: 14 },
  streakTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },
  flame: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  streakTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.white,
    letterSpacing: -0.3,
  },
  streakSub: { fontSize: 12.5, color: "rgba(255,255,255,0.75)", marginTop: 2 },

  dayRow: { flexDirection: "row", justifyContent: "space-between" },
  dayCol: { alignItems: "center", gap: 6 },
  dayLetter: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.5)",
  },
  dayLetterDone: { color: colors.white },
  daydot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  daydotDone: { backgroundColor: colors.white },
  daydotToday: {
    backgroundColor: "rgba(251,191,36,0.16)",
    borderWidth: 1.5,
    borderColor: "#fbbf24",
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    marginBottom: 14,
  },
  statCard: { width: "48.3%", padding: 14, ...design.card },
  statValue: { ...design.metric, marginTop: 12 },
  statLabel: { ...design.caption, fontWeight: "600", marginTop: 2 },

  infoCard: { padding: 16, marginBottom: 14, gap: 10, ...design.card },
  infoHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoTitle: { ...design.cardTitle, fontSize: 15.5 },
  infoLine: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  infoText: { flex: 1, fontSize: 13.5, color: colors.textSub, lineHeight: 20 },
  weakRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
  },
  weakTopic: { flex: 1, fontSize: 13.5, fontWeight: "600", color: colors.text },

  chartCard: { padding: 18, marginBottom: 22, ...design.card },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  chartTitle: { ...design.sectionTitle },
  chartSub: { fontSize: 12.5, fontWeight: "700", color: colors.primary, marginTop: 3 },
  chartRight: { alignItems: "flex-end" },
  chartValue: { fontSize: 20, fontWeight: "800", color: colors.text },
  chartCaption: { ...design.caption, marginTop: 1 },

  barsRow: { flexDirection: "row", alignItems: "flex-end" },
  barCol: { flex: 1, alignItems: "center", gap: 6 },
  barMinLabel: { fontSize: 10, fontWeight: "700", color: colors.textMuted },
  barTrack: {
    width: 22,
    height: 96,
    borderRadius: 11,
    backgroundColor: colors.surfaceAlt,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: { width: "100%", borderRadius: 11 },
  barDay: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  barDayToday: { backgroundColor: colors.primaryLight },
  barLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },
  barLabelToday: { color: colors.primary, fontWeight: "800" },

  topicsCard: { paddingHorizontal: 16, ...design.card },
  topicRow: { paddingVertical: 14, gap: 8 },
  topicRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  topicTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  topicDot: { width: 8, height: 8, borderRadius: 4 },
  topicName: { ...design.cardTitle, flex: 1 },
  topicPct: { fontSize: 14, fontWeight: "800" },
  topicMeta: { ...design.caption },
});
