import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BackHeader } from "../../src/components/BackHeader";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";

export default function QuizzesScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: progress, isLoading, refetch } = trpc.progress.stats.useQuery();
  const { data: analytics, refetch: refetchA } = trpc.progress.analytics.useQuery();

  const scored = (progress ?? []).filter((p) => (p.quizzesAttempted ?? 0) > 0);
  const totalQuizzes = scored.reduce((s, p) => s + (p.quizzesAttempted ?? 0), 0);
  const avgScore =
    scored.length > 0
      ? Math.round(
          scored.reduce((s, p) => s + (p.averageQuizScore ?? 0), 0) / scored.length
        )
      : 0;
  const streak = analytics?.currentStreak ?? 0;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchA()]);
    setRefreshing(false);
  };

  const recentQuizzes = [...scored]
    .sort((a, b) => {
      const aT = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
      const bT = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
      return bT - aT;
    })
    .map((p) => ({
      id: p.documentId,
      docId: p.documentId,
      title: p.documentTitle ?? "Quiz",
      attempts: p.quizzesAttempted ?? 0,
      score: Math.round(p.averageQuizScore ?? 0),
    }));

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* ── Header ── */}
        <BackHeader title="Quiz history" subtitle="Scores from your attempts" />

        {/* ── Stats banner ── */}
        <View style={s.statsBanner}>
          <View style={s.statItem}>
            <Text style={s.statNum}>{totalQuizzes}</Text>
            <Text style={s.statLbl}>Taken</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={[s.statNum, { color: colors.primary }]}>
              {scored.length ? `${avgScore}%` : "—"}
            </Text>
            <Text style={s.statLbl}>Average</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={[s.statNum, { color: "#f59e0b" }]}>{streak}</Text>
            <Text style={s.statLbl}>Streak</Text>
          </View>
        </View>

        {/* ── Recent Quizzes ── */}
        <Text style={s.sectionTitle}>Recent Quizzes</Text>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginBottom: 20 }} />
        ) : recentQuizzes.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="help-circle-outline" size={36} color={colors.textLight} />
            <Text style={s.emptyTitle}>No quizzes yet</Text>
            <Text style={s.emptyText}>
              Open a document and generate a quiz to get started.
            </Text>
          </View>
        ) : (
          recentQuizzes.map((quiz) => {
            const passed = quiz.score >= 80;
            return (
              <TouchableOpacity
                key={quiz.id}
                style={s.quizRow}
                onPress={() =>
                  router.push({
                    pathname: "/document/[id]",
                    params: { id: quiz.docId, tab: "quiz" },
                  })
                }
                activeOpacity={0.75}
              >
                {/* left icon */}
                <View style={[s.quizIcon, { backgroundColor: passed ? "#e8fdf2" : "#fff7ed" }]}>
                  <Ionicons
                    name="document-text-outline"
                    size={20}
                    color={passed ? colors.primary : "#f59e0b"}
                  />
                </View>

                {/* info */}
                <View style={s.quizInfo}>
                  <Text style={s.quizTitle} numberOfLines={1}>
                    {quiz.title}
                  </Text>
                  <Text style={s.quizMeta}>
                    {quiz.attempts} attempt{quiz.attempts === 1 ? "" : "s"} · {quiz.score}% avg
                  </Text>
                </View>

                {/* check badge */}
                <View style={[s.checkBadge, { backgroundColor: passed ? "#e8fdf2" : "#fff7ed" }]}>
                  <Ionicons
                    name={passed ? "checkmark-circle" : "time-outline"}
                    size={20}
                    color={passed ? colors.primary : "#f59e0b"}
                  />
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* ── Browse All button ── */}
        <TouchableOpacity
          style={s.browseBtn}
          onPress={() => router.push("/(tabs)/library" as any)}
        >
          <Text style={s.browseBtnText}>Browse All Quizzes</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5f6fa" },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 22, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  trophyBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#fff7ed",
    alignItems: "center",
    justifyContent: "center",
  },

  // Stats banner
  statsBanner: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: { flex: 1, alignItems: "center", gap: 4 },
  statNum: { fontSize: 28, fontWeight: "900", color: colors.text },
  statLbl: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },
  statDivider: { width: 1, backgroundColor: colors.border, alignSelf: "stretch" },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 14,
  },

  // Quiz rows
  quizRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  quizIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  quizInfo: { flex: 1 },
  quizTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  quizMeta: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  checkBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  // Browse all
  browseBtn: {
    marginTop: 8,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  browseBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.white,
  },

  // Empty
  emptyBox: { alignItems: "center", paddingVertical: 36, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 240,
  },
});
