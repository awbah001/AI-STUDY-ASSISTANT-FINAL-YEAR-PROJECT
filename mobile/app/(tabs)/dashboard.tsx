import { design } from "../../src/theme/design";
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
import {
  registerForPushNotifications,
  scheduleCalendarReminders,
} from "../../src/lib/notifications";
import {
  EmptyCard,
  HeaderIconButton,
  HeroGradient,
  IconTile,
  Pill,
  ProgressBar,
  SectionHeader,
} from "../../src/components/ui/Kit";

const cognifyBot = require("../../assets/cognify-auth-bot.png");

const QUICK_LINKS = [
  { href: "/(tabs)/library", label: "Library", icon: "folder-open-outline", color: colors.primary, bg: colors.primaryLight },
  { href: "/(tabs)/flashcards", label: "Flashcards", icon: "layers-outline", color: colors.info, bg: colors.infoSoft },
  { href: "/(tabs)/quizzes", label: "Quizzes", icon: "help-circle-outline", color: colors.violet, bg: colors.violetSoft },
  { href: "/(tabs)/progress", label: "Progress", icon: "stats-chart-outline", color: colors.warning, bg: colors.warningSoft },
] as const;

const EVENT_TONES: Record<string, { fg: string; bg: string }> = {
  exam: { fg: colors.error, bg: colors.errorSoft },
  test: { fg: "#c2410c", bg: colors.warningSoft },
  quiz: { fg: colors.violet, bg: colors.violetSoft },
  study: { fg: colors.primary, bg: colors.primaryLight },
};

const DOC_TONES = [
  { fg: "#e5484d", bg: "#fdecec" },
  { fg: "#0d9488", bg: "#e6f7f5" },
  { fg: colors.info, bg: colors.infoSoft },
];

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const signedIn = !!user?.id;

  const {
    data: documents,
    isLoading: docsLoading,
    refetch: refetchDocs,
  } = trpc.documents.list.useQuery(undefined, { enabled: signedIn });
  const { data: progress, refetch: refetchProgress } =
    trpc.progress.stats.useQuery(undefined, { enabled: signedIn });
  const { data: analytics, refetch: refetchAnalytics } =
    trpc.progress.analytics.useQuery(undefined, { enabled: signedIn });
  const { data: unreadNotifs, refetch: refetchNotifs } =
    trpc.notifications.unreadCount.useQuery(undefined, { enabled: signedIn });
  const { data: enrolledCourses, refetch: refetchCourses } =
    trpc.studentCourses.list.useQuery(undefined, { enabled: signedIn });
  const { data: plan, refetch: refetchPlan } = trpc.planner.today.useQuery(
    undefined,
    { enabled: signedIn }
  );
  const upcomingRange = useMemo(
    () => ({
      from: Date.now(),
      to: Date.now() + 14 * 24 * 60 * 60 * 1000,
    }),
    []
  );
  const { data: cal, refetch: refetchCal } = trpc.planner.calendar.useQuery(
    upcomingRange,
    { enabled: signedIn }
  );

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
  const progressStreak = Math.max(
    0,
    ...(progress ?? []).map(p => p.currentStreak ?? 0)
  );
  const lastStudyToday = (progress ?? []).some(p => {
    if (!p.lastStudyDate && !p.lastActivityAt) return false;
    const d = new Date(p.lastStudyDate ?? p.lastActivityAt ?? 0);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  });
  const rawStudyMins = Math.max(
    analytics?.totalStudyTime ?? 0,
    progressStudyMins
  );
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
    lastStudyToday
      ? Math.max(1, Math.min(totalStudyMins || 1, dailyGoalMins))
      : 0
  );
  const goalPct = Math.min(
    100,
    Math.round((todayMins / Math.max(dailyGoalMins, 1)) * 100)
  );

  const recentDocs = [...(documents ?? [])]
    .sort((a, b) => {
      const aAt = progress?.find(p => p.documentId === a.id)?.lastActivityAt;
      const bAt = progress?.find(p => p.documentId === b.id)?.lastActivityAt;
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
    const p = progress?.find(row => row.documentId === docId);
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
      refetchCourses(),
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
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/profile" as any)}
            style={s.avatarRing}
            accessibilityLabel="Open profile"
          >
            {user?.avatarUrl ? (
              <Image
                source={{
                  uri: user.avatarUrl.startsWith("/")
                    ? `${API_URL}${user.avatarUrl}`
                    : user.avatarUrl,
                }}
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
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>{hello}</Text>
            <Text style={s.greeting} numberOfLines={1}>
              Hi, {firstName}
            </Text>
          </View>
          <HeaderIconButton
            icon="notifications-outline"
            label="Notifications"
            badge={unreadNotifs ?? 0}
            onPress={() => router.push("/notifications" as any)}
          />
        </View>

        {/* ── Daily Goal Card ── */}
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => router.push("/(tabs)/planner" as any)}
          style={s.goalWrap}
        >
          <HeroGradient style={s.goalCard}>
            <View style={s.goalContent}>
              <View style={s.goalLabelRow}>
                <View style={s.goalLabelDot} />
                <Text style={s.goalLabel}>Today's study</Text>
              </View>
              <View style={s.goalTopRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <View style={s.goalFractionRow}>
                    <Text style={s.goalNum}>{todayMins}</Text>
                    <Text style={s.goalDenom}>/ {dailyGoalMins} min</Text>
                  </View>
                  <Text style={s.goalMeta}>
                    {enrolledCourses?.length ?? 0} courses · {totalDocs}{" "}
                    materials
                  </Text>
                </View>
                <View style={s.ringOuter}>
                  <Text style={s.ringPct}>{goalPct}%</Text>
                  <Text style={s.ringCaption}>goal</Text>
                </View>
              </View>
              <View style={s.goalBarBg}>
                <View
                  style={[s.goalBarFill, { width: `${goalPct}%` as any }]}
                />
              </View>
              <View style={s.goalFooter}>
                <Text style={s.goalQuote} numberOfLines={2}>
                  {goalPct >= 100
                    ? "Daily goal complete. Great work."
                    : todayMins > 0
                      ? `${Math.max(0, dailyGoalMins - todayMins)} min left to hit today's goal.`
                      : "Ask AI, flip flashcards, or take a quiz to log time."}
                </Text>
                <View style={s.goalCta}>
                  <Ionicons name="arrow-forward" size={15} color={colors.primaryDark} />
                </View>
              </View>
            </View>
            <Image
              source={cognifyBot}
              style={s.goalBot}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </HeroGradient>
        </TouchableOpacity>

        {/* ── Quick access ── */}
        <View style={s.quickRow}>
          {QUICK_LINKS.map(link => (
            <TouchableOpacity
              key={link.href}
              style={s.quickItem}
              activeOpacity={0.8}
              onPress={() => router.push(link.href as any)}
            >
              <IconTile icon={link.icon} color={link.color} bg={link.bg} size={46} />
              <Text style={s.quickLabel}>{link.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {!!cal?.events?.length && (
          <>
            <SectionHeader
              title="Upcoming"
              action="Planner"
              onAction={() => router.push("/(tabs)/planner" as any)}
            />
            <View style={s.agenda}>
              {cal.events.slice(0, 3).map((event, i, list) => {
                const d = new Date(event.startsAt);
                const tone = EVENT_TONES[event.type] ?? EVENT_TONES.study;
                return (
                  <TouchableOpacity
                    key={event.id}
                    style={[s.agendaRow, i < list.length - 1 && s.agendaDivider]}
                    activeOpacity={0.8}
                    onPress={() => router.push("/(tabs)/planner" as any)}
                  >
                    <View style={[s.dateBlock, { backgroundColor: tone.bg }]}>
                      <Text style={[s.dateDay, { color: tone.fg }]}>
                        {d.getDate()}
                      </Text>
                      <Text style={[s.dateMonth, { color: tone.fg }]}>
                        {d.toLocaleDateString(undefined, { month: "short" })}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={s.agendaTitle} numberOfLines={1}>
                        {event.title}
                      </Text>
                      <View style={s.agendaMeta}>
                        <Pill label={event.type} color={tone.fg} bg={tone.bg} />
                        <Text style={s.agendaTime}>
                          {d.toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* ── Overview ── */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>Overview</Text>
          <View style={s.weekPill}>
            <Ionicons name="trending-up" size={13} color={colors.primary} />
            <Text style={s.weekPillText}>{thisWeekMins}m this week</Text>
          </View>
        </View>

        <View style={s.statsGrid}>
          <StatTile
            icon="time-outline"
            label="Study time"
            value={`${studyHours}h ${studyMinsRem}m`}
            change={studyChangeLabel}
            accent={colors.primary}
            accentBg={colors.primaryLight}
          />
          <StatTile
            icon="help-circle-outline"
            label="Quizzes"
            value={String(totalQuizzes)}
            change={totalQuizzes > 0 ? `${totalQuizzes} taken` : "None yet"}
            accent={colors.violet}
            accentBg={colors.violetSoft}
          />
          <StatTile
            icon="layers-outline"
            label="Flashcards"
            value={String(totalFlashcards)}
            change={
              totalFlashcards > 0 ? `${totalFlashcards} reviewed` : "None yet"
            }
            accent={colors.info}
            accentBg={colors.infoSoft}
          />
          <StreakTile streak={streak} />
        </View>

        {/* ── Continue Learning ── */}
        <SectionHeader
          title="Continue learning"
          action="View all"
          onAction={() => router.push("/(tabs)/library" as any)}
        />

        {docsLoading ? (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginVertical: 16 }}
          />
        ) : recentDocs.length === 0 ? (
          <EmptyCard
            icon="book-outline"
            title="No documents yet"
            body="Open your library to upload notes or join a course."
            action="Go to Library"
            onAction={() => router.push("/(tabs)/library" as any)}
          />
        ) : (
          recentDocs.map((doc, idx) => {
            const pct = getDocProgress(doc.id);
            const tone = DOC_TONES[idx % DOC_TONES.length];
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
                <IconTile
                  icon={
                    doc.mimeType?.includes("pdf") ? "document-text" : "document"
                  }
                  color={tone.fg}
                  bg={tone.bg}
                  size={48}
                />

                <View style={s.learnInfo}>
                  <Text style={s.learnTitle} numberOfLines={1}>
                    {doc.title}
                  </Text>
                  <Text style={s.learnSubtitle} numberOfLines={1}>
                    {doc.mimeType?.includes("pdf") ? "PDF" : "Document"} ·{" "}
                    {(doc.fileSize / 1024).toFixed(0)} KB
                  </Text>
                  <View style={s.learnBarRow}>
                    <View style={{ flex: 1 }}>
                      <ProgressBar value={pct} color={tone.fg} track={colors.surfaceAlt} height={5} />
                    </View>
                    <Text style={[s.learnPct, pct > 0 && { color: tone.fg }]}>
                      {pct === 0 ? "New" : `${pct}%`}
                    </Text>
                  </View>
                </View>

                <View style={s.playBtn}>
                  <Ionicons name="play" size={13} color={colors.white} style={{ marginLeft: 2 }} />
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
          <Text style={[s.changeText, { color: accent }]} numberOfLines={1}>
            {change}
          </Text>
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
        <View style={[s.statIcon, { backgroundColor: colors.warningSoft }]}>
          <Ionicons name="flame" size={18} color={colors.warning} />
        </View>
        <View style={[s.changeBadge, { backgroundColor: colors.warningSoft }]}>
          <Text style={[s.changeText, { color: "#c2710c" }]}>
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
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 32 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  avatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    padding: 2,
    borderWidth: 2,
    borderColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  avatarText: { fontSize: 16, fontWeight: "800", color: colors.white },
  eyebrow: { ...design.eyebrow, color: colors.primary, marginBottom: 2 },
  greeting: { ...design.screenTitle, fontSize: 24, lineHeight: 30 },

  goalWrap: {
    marginBottom: 22,
    borderRadius: 24,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  goalCard: {
    padding: 20,
    paddingRight: 8,
    minHeight: 168,
    flexDirection: "row",
    alignItems: "center",
  },
  goalContent: { flex: 1, gap: 14, zIndex: 2 },
  goalBot: {
    width: 96,
    height: 128,
    marginLeft: 4,
    marginRight: -6,
    marginBottom: -24,
    alignSelf: "flex-end",
  },
  goalLabelRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  goalLabelDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  goalLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#d1fae5",
  },
  goalTopRow: { flexDirection: "row", alignItems: "center" },
  goalFractionRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  goalNum: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: "800",
    letterSpacing: -1.5,
    color: colors.white,
    fontVariant: ["tabular-nums"],
  },
  goalDenom: { fontSize: 15, fontWeight: "600", color: "#a7d8c6" },
  goalMeta: { fontSize: 12.5, color: "#bfe3d6", marginTop: 2 },
  ringOuter: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 4,
    borderColor: colors.accent,
    backgroundColor: "#ffffff14",
    alignItems: "center",
    justifyContent: "center",
  },
  ringPct: { fontSize: 15, fontWeight: "800", color: colors.white },
  ringCaption: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#bfe3d6",
    marginTop: -1,
  },
  goalBarBg: {
    height: 7,
    borderRadius: 4,
    backgroundColor: "#ffffff22",
    overflow: "hidden",
  },
  goalBarFill: { height: "100%", borderRadius: 4, backgroundColor: colors.accent },
  goalFooter: { flexDirection: "row", alignItems: "center", gap: 12 },
  goalQuote: { flex: 1, fontSize: 13, lineHeight: 19, color: "#d9f0e7" },
  goalCta: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },

  quickRow: {
    ...design.card,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 10,
    marginBottom: 24,
  },
  quickItem: { flex: 1, alignItems: "center", gap: 8 },
  quickLabel: { fontSize: 12, fontWeight: "600", color: colors.textSub },

  agenda: { ...design.card, paddingHorizontal: 14, marginBottom: 24 },
  agendaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
  },
  agendaDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dateBlock: {
    width: 48,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dateDay: { fontSize: 18, lineHeight: 21, fontWeight: "800" },
  dateMonth: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  agendaTitle: { ...design.cardTitle, fontSize: 14.5 },
  agendaMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  agendaTime: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },

  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: design.sectionTitle,
  weekPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
  },
  weekPillText: { fontSize: 12, fontWeight: "700", color: colors.primary },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 26,
  },
  statTile: {
    ...design.card,
    width: "47.9%",
    flexGrow: 1,
    padding: 14,
  },
  streakTile: { backgroundColor: "#fffbf3", borderColor: "#fdecc8" },
  statTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 14,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  changeBadge: {
    flexShrink: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  changeText: { fontSize: 10.5, fontWeight: "700" },
  statValue: { ...design.metric, fontSize: 24, lineHeight: 29 },
  statLabel: { ...design.caption, marginTop: 2, fontWeight: "600" },

  learnCard: {
    ...design.card,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    marginBottom: 12,
  },
  learnInfo: { flex: 1, gap: 3 },
  learnTitle: design.cardTitle,
  learnSubtitle: design.caption,
  learnBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  learnPct: {
    minWidth: 34,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
