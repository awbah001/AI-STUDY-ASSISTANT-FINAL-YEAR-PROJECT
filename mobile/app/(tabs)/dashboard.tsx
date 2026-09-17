import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect, useMemo } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/contexts/AuthContext";
import { trpc } from "../../src/lib/api";
import { API_URL } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";
import { registerForPushNotifications, scheduleCalendarReminders } from "../../src/lib/notifications";

const cognifyBot = require("../../assets/cognify-auth-bot.png");

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: documents,
    isLoading: docsLoading,
    refetch: refetchDocs,
  } = trpc.documents.list.useQuery();
  const { data: progress, refetch: refetchProgress } =
    trpc.progress.stats.useQuery();
  const { data: analytics, refetch: refetchAnalytics } =
    trpc.progress.analytics.useQuery();
  const { data: unreadNotifs, refetch: refetchNotifs } =
    trpc.notifications.unreadCount.useQuery();
  const { data: enrolledCourses } = trpc.studentCourses.list.useQuery();
  const { data: plan, refetch: refetchPlan } = trpc.planner.today.useQuery();
  const upcomingRange = useMemo(
    () => ({
      from: Date.now(),
      to: Date.now() + 14 * 24 * 60 * 60 * 1000,
    }),
    []
  );
  const { data: cal, refetch: refetchCal } = trpc.planner.calendar.useQuery(upcomingRange);

  useEffect(() => {
    if (!cal?.events?.length) return;
    void registerForPushNotifications();
    void scheduleCalendarReminders(cal.events);
  }, [cal?.events]);

  const hour = new Date().getHours();
  const hello =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.name?.split(/\s+/)[0] ?? "there";
  const totalDocs = documents?.length ?? 0;
  const totalFlashcards =
    progress?.reduce((s, p) => s + (p.flashcardsReviewed ?? 0), 0) ?? 0;
  const totalQuizzes =
    progress?.reduce((s, p) => s + (p.quizzesAttempted ?? 0), 0) ?? 0;
  const progressStudyMins =
    progress?.reduce((s, p) => s + (p.totalStudyTimeMinutes ?? 0), 0) ?? 0;
  const progressStreak = Math.max(0, ...(progress ?? []).map((p) => p.currentStreak ?? 0));
  const lastStudyToday = (progress ?? []).some((p) => {
    if (!p.lastStudyDate && !p.lastActivityAt) return false;
    const d = new Date(p.lastStudyDate ?? p.lastActivityAt ?? 0);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  });
  const rawStudyMins = Math.max(analytics?.totalStudyTime ?? 0, progressStudyMins);
  const totalStudyMins =
    rawStudyMins > 0 ? rawStudyMins : totalFlashcards + totalQuizzes * 2;
  const streak = Math.max(
    analytics?.currentStreak ?? 0,
    progressStreak,
    lastStudyToday ? 1 : 0
  );
  const studyHours = Math.floor(totalStudyMins / 60);
  const studyMinsRem = totalStudyMins % 60;

  const dailyData = analytics?.dailyData ?? [];
  const dailyGoalMins = plan?.goal.dailyStudyMinutes ?? 30;
  const todayFromSessions = dailyData[dailyData.length - 1]?.totalMinutes ?? 0;
  const todayMins = Math.max(
    todayFromSessions,
    lastStudyToday ? Math.max(1, Math.min(totalStudyMins || 1, dailyGoalMins)) : 0
  );
  const goalPct = Math.min(100, Math.round((todayMins / Math.max(dailyGoalMins, 1)) * 100));

  const recentDocs = [...(documents ?? [])]
    .sort((a, b) => {
      const aAt = progress?.find((p) => p.documentId === a.id)?.lastActivityAt;
      const bAt = progress?.find((p) => p.documentId === b.id)?.lastActivityAt;
      const aTime = aAt ? new Date(aAt).getTime() : 0;
      const bTime = bAt ? new Date(bAt).getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })
    .slice(0, 3);

  const thisWeekMins = Math.max(
    dailyData.reduce((s, d) => s + (d.totalMinutes ?? 0), 0),
    todayMins
  );

  const studyChangeLabel = (() => {
    if (thisWeekMins === 0 && totalStudyMins === 0) return "No activity";
    if (thisWeekMins < 60) return `${thisWeekMins || totalStudyMins}m logged`;
    return `${Math.floor(thisWeekMins / 60)}h ${thisWeekMins % 60}m logged`;
  })();

  /**
   * Derive a real per-document progress % from the progress tracking data.
   * Treats 10 flashcard reviews + 1 quiz attempt as "100% engaged".
   * Returns 0 if no activity at all.
   */
  const getDocProgress = (docId: number): number => {
    const p = progress?.find((row) => row.documentId === docId);
    if (!p) return 0;
    const reviews = p.flashcardsReviewed ?? 0;
    const quizzes = p.quizzesAttempted ?? 0;
    const studyMins = p.totalStudyTimeMinutes ?? 0;
    if (reviews === 0 && quizzes === 0 && studyMins === 0) return 0;
    // Score: 10 flashcard reviews = 50%, 1 quiz attempt = 30%, 30+ study mins = 20%
    const score =
      Math.min(reviews / 10, 1) * 50 +
      Math.min(quizzes / 1, 1) * 30 +
      Math.min(studyMins / 30, 1) * 20;
    // Always show at least 5% if any activity exists (bar is visible)
    return Math.max(5, Math.round(score));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchDocs(),
      refetchProgress(),
      refetchAnalytics(),
      refetchNotifs(),
      refetchPlan(),
      refetchCal(),
    ]);
    setRefreshing(false);
  };

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
        <View style={s.header}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={s.greeting}>
              {hello}, {firstName}
            </Text>
            <Text style={s.subtitle}>Cognify is ready when you are.</Text>
          </View>
          <View style={s.headerRight}>
            <TouchableOpacity style={s.notifBtn} onPress={() => router.push("/notifications" as any)}>
              <Ionicons
                name="notifications-outline"
                size={22}
                color={colors.text}
              />
              {(unreadNotifs ?? 0) > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{(unreadNotifs ?? 0) > 9 ? "9+" : unreadNotifs}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/profile" as any)}
            >
              {user?.avatarUrl ? (
                <Image
                  source={{ uri: user.avatarUrl.startsWith("/") ? `${API_URL}${user.avatarUrl}` : user.avatarUrl }}
                  style={s.avatarImg}
                />
              ) : (
                <View style={s.avatar}>
                  <Text style={s.avatarText}>
                    {user?.name?.charAt(0).toUpperCase() ?? "?"}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Daily Goal Card ── */}
        <TouchableOpacity style={s.goalCard} activeOpacity={0.9} onPress={() => router.push("/(tabs)/planner" as any)}>
          <View style={s.goalContent}>
            <Text style={s.goalLabel}>Today's study</Text>
            <View style={s.goalTopRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <View style={s.goalFractionRow}>
                  <Text style={s.goalNum}>{todayMins}</Text>
                  <Text style={s.goalSlash}>/</Text>
                  <Text style={s.goalDenom}>{dailyGoalMins} min</Text>
                </View>
                <Text style={s.goalMeta}>
                  {enrolledCourses?.length ?? 0} courses · {totalDocs} materials
                </Text>
              </View>
              <View style={s.ringOuter}>
                <View style={s.ringInner}>
                  <Text style={s.ringPct}>{goalPct}%</Text>
                </View>
              </View>
            </View>
            <View style={s.goalBarBg}>
              <View
                style={[s.goalBarFill, { width: `${goalPct}%` as any }]}
              />
            </View>
            <Text style={s.goalQuote}>
              {goalPct >= 100
                ? "Daily goal complete. Great work."
                : todayMins > 0
                  ? `${Math.max(0, dailyGoalMins - todayMins)} min left to hit today's goal.`
                  : "Ask AI, flip flashcards, or take a quiz to log time."}
            </Text>
          </View>
          <Image source={cognifyBot} style={s.goalBot} resizeMode="contain" />
        </TouchableOpacity>

        {!!cal?.events?.length && (
          <TouchableOpacity
            style={s.calPreview}
            activeOpacity={0.9}
            onPress={() => router.push("/(tabs)/planner" as any)}
          >
            <View style={s.calPreviewHead}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text style={s.calPreviewTitle}>Upcoming timetable</Text>
              <Text style={s.calPreviewLink}>Open</Text>
            </View>
            {cal.events.slice(0, 3).map((event) => (
              <Text key={event.id} style={s.calPreviewRow}>
                {event.type.toUpperCase()} · {event.title} ·{" "}
                {new Date(event.startsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </Text>
            ))}
          </TouchableOpacity>
        )}

        {/* ── Overview ── */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>Overview</Text>
          <View style={s.weekPill}>
            <Text style={s.weekPillText}>{thisWeekMins}m this week</Text>
          </View>
        </View>

        <View style={s.statsGrid}>
          <StatTile
            icon="time-outline"
            label="Study Time"
            value={`${studyHours}h ${studyMinsRem}m`}
            change={studyChangeLabel}
            accent={colors.primary}
            accentBg="#e8fdf2"
          />
          <StatTile
            icon="help-circle-outline"
            label="Quizzes"
            value={String(totalQuizzes)}
            change={totalQuizzes > 0 ? `${totalQuizzes} taken` : "None yet"}
            accent="#8b5cf6"
            accentBg="#f3f0ff"
          />
          <StatTile
            icon="layers-outline"
            label="Flashcards"
            value={String(totalFlashcards)}
            change={totalFlashcards > 0 ? `${totalFlashcards} reviewed` : "None yet"}
            accent="#3b82f6"
            accentBg="#eff6ff"
          />
          <StreakTile streak={streak} />
        </View>

        {/* ── Continue Learning ── */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>Continue Learning</Text>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/library" as any)}
          >
            <Text style={s.viewAll}>View all</Text>
          </TouchableOpacity>
        </View>

        {docsLoading ? (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginVertical: 16 }}
          />
        ) : recentDocs.length === 0 ? (
          <View style={s.emptyLearn}>
            <Ionicons
              name="book-outline"
              size={36}
              color={colors.textLight}
            />
            <Text style={s.emptyLearnText}>
              No documents yet. Go to Library to get started.
            </Text>
          </View>
        ) : (
          recentDocs.map((doc, idx) => {
            const pct = getDocProgress(doc.id);
            // alternate icon colours: red, teal, blue
            const iconColors = ["#ef4444", "#14b8a6", "#3b82f6"];
            const iconBg = ["#fef2f2", "#f0fdfa", "#eff6ff"];
            const ic = iconColors[idx % iconColors.length];
            const ibg = iconBg[idx % iconBg.length];
            return (
              <TouchableOpacity
                key={doc.id}
                style={s.learnCard}
                onPress={() =>
                  router.push({
                    pathname: "/document/[id]",
                    params: { id: doc.id },
                  })
                }
                activeOpacity={0.8}
              >
                {/* doc icon */}
                <View style={[s.learnIcon, { backgroundColor: ibg }]}>
                  <Ionicons
                    name={
                      doc.mimeType?.includes("pdf")
                        ? "document-text"
                        : "document"
                    }
                    size={22}
                    color={ic}
                  />
                </View>

                {/* info + bar */}
                <View style={s.learnInfo}>
                  <Text style={s.learnTitle} numberOfLines={1}>
                    {doc.title}
                  </Text>
                  <Text style={s.learnSubtitle} numberOfLines={1}>
                    {doc.mimeType?.includes("pdf") ? "PDF" : "Document"} ·{" "}
                    {(doc.fileSize / 1024).toFixed(0)} KB
                  </Text>
                  <View style={s.learnBarRow}>
                    <View style={s.learnBarBg}>
                      <View
                        style={[s.learnBarFill, { width: `${pct}%` as any }]}
                      />
                    </View>
                    <Text style={s.learnPct}>
                      {pct === 0 ? "New" : `${pct}%`}
                    </Text>
                  </View>
                </View>

                {/* play button */}
                <View style={s.playBtn}>
                  <Ionicons name="play" size={14} color={colors.white} />
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* bottom padding so FAB doesn't cover last card */}
        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Stat tile (Study Time / Quizzes / Flashcards) ────────────────────────────
function StatTile({
  icon,
  label,
  value,
  change,
  accent,
  accentBg,
}: {
  icon: string;
  label: string;
  value: string;
  change: string;
  accent: string;
  accentBg: string;
}) {
  return (
    <View style={s.statTile}>
      {/* top row: icon + change badge */}
      <View style={s.statTopRow}>
        <View style={[s.statIcon, { backgroundColor: accentBg }]}>
          <Ionicons name={icon as any} size={18} color={accent} />
        </View>
        <View style={[s.changeBadge, { backgroundColor: accentBg }]}>
          <Text style={[s.changeText, { color: accent }]}>{change}</Text>
        </View>
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

// ── Streak tile (special layout matching image) ───────────────────────────────
function StreakTile({ streak }: { streak: number }) {
  return (
    <View style={[s.statTile, s.streakTile]}>
      <View style={s.statTopRow}>
        <View style={[s.statIcon, { backgroundColor: "#fff7ed" }]}>
          <Ionicons name="flame" size={18} color="#f59e0b" />
        </View>
        <View style={[s.changeBadge, { backgroundColor: "#fff7ed" }]}>
          <Text style={[s.changeText, { color: "#f59e0b" }]}>
            {streak > 0 ? "On a roll" : "Start today"}
          </Text>
        </View>
      </View>
      <Text style={s.statValue}>{streak} days</Text>
      <Text style={s.statLabel}>Streak</Text>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5f6fa" },
  scroll: { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 14 },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  greeting: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.3,
  },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 3 },
  notifBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  badgeText: { fontSize: 9, fontWeight: "800", color: colors.white },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: { fontSize: 17, fontWeight: "800", color: colors.white },

  // Daily Goal card — dark green like the image
  goalCard: {
    backgroundColor: "#033c35",
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 26,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    minHeight: 168,
  },
  goalContent: { flex: 1, gap: 10, zIndex: 2 },
  goalLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.65)",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  goalTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  goalFractionRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  goalNum: {
    fontSize: 40,
    fontWeight: "900",
    color: colors.white,
    lineHeight: 46,
  },
  goalSlash: {
    fontSize: 24,
    color: "rgba(255,255,255,0.55)",
    fontWeight: "300",
  },
  goalDenom: {
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    fontWeight: "600",
  },
  goalMeta: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "600",
  },
  // circular ring indicator (border-only ring)
  ringOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34,197,94,0.12)",
  },
  ringInner: { alignItems: "center", justifyContent: "center" },
  ringPct: { fontSize: 16, fontWeight: "800", color: colors.white },

  goalBarBg: {
    height: 5,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 3,
    overflow: "hidden",
  },
  goalBarFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  goalQuote: {
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    fontStyle: "italic",
  },
  goalBot: {
    width: 118,
    height: 148,
    marginRight: -8,
    marginBottom: -18,
  },
  calPreview: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: colors.border,
  },
  calPreviewHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  calPreviewTitle: { flex: 1, fontSize: 15, fontWeight: "800", color: colors.text },
  calPreviewLink: { fontSize: 13, fontWeight: "700", color: colors.primary },
  calPreviewRow: { fontSize: 13, color: colors.textMuted, marginTop: 4 },

  // Section row
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  weekPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weekPillText: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  viewAll: { fontSize: 13, color: colors.primary, fontWeight: "700" },

  // Stats grid — 2 columns
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 28,
  },
  statTile: {
    width: "47%",
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  streakTile: {},
  statTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  changeBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  changeText: { fontSize: 11, fontWeight: "700" },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    lineHeight: 26,
  },
  statLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },

  // Continue Learning cards
  learnCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  learnIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  learnInfo: { flex: 1, gap: 4 },
  learnTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  learnSubtitle: { fontSize: 12, color: colors.textMuted },
  learnBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  learnBarBg: {
    flex: 1,
    height: 5,
    backgroundColor: "#f1f5f9",
    borderRadius: 3,
    overflow: "hidden",
  },
  learnBarFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  learnPct: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    minWidth: 28,
    textAlign: "right",
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },

  emptyLearn: {
    alignItems: "center",
    paddingVertical: 36,
    gap: 10,
  },
  emptyLearnText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 240,
  },
});
