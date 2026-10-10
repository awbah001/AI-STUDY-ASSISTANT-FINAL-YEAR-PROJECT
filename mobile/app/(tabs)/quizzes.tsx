import { design, elevation } from "../../src/theme/design";
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
import { LinearGradient } from "expo-linear-gradient";
import { BackHeader } from "../../src/components/BackHeader";
import { trpc } from "../../src/lib/api";
import { colors, gradients } from "../../src/theme/colors";
import {
  EmptyCard,
  IconTile,
  ProgressBar,
  SectionHeader,
  StatBanner,
} from "../../src/components/ui/Kit";

export default function QuizzesScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: progress, isLoading, refetch } = trpc.progress.stats.useQuery();
  const { data: analytics, refetch: refetchA } =
    trpc.progress.analytics.useQuery();

  const scored = (progress ?? []).filter(p => (p.quizzesAttempted ?? 0) > 0);
  const totalQuizzes = scored.reduce(
    (s, p) => s + (p.quizzesAttempted ?? 0),
    0
  );
  const avgScore =
    scored.length > 0
      ? Math.round(
          scored.reduce((s, p) => s + (p.averageQuizScore ?? 0), 0) /
            scored.length
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
    .map(p => ({
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <BackHeader title="Quiz history" subtitle="Scores from your attempts" />

        <StatBanner
          style={s.statsBanner}
          items={[
            { value: totalQuizzes, label: "Taken" },
            { value: scored.length ? `${avgScore}%` : "—", label: "Average" },
            { value: streak, label: "Day streak", highlight: streak > 0 },
          ]}
        />

        <SectionHeader title="Recent quizzes" />

        {isLoading ? (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginBottom: 20 }}
          />
        ) : recentQuizzes.length === 0 ? (
          <EmptyCard
            icon="help-circle-outline"
            title="No quizzes yet"
            body="Open a document and generate a quiz to get started."
          />
        ) : (
          recentQuizzes.map(quiz => {
            const passed = quiz.score >= 80;
            const tone = passed ? colors.primary : "#d97706";
            const toneBg = passed ? colors.primaryLight : colors.warningSoft;
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
                activeOpacity={0.8}
              >
                <IconTile
                  icon={passed ? "trophy-outline" : "document-text-outline"}
                  color={tone}
                  bg={toneBg}
                  size={46}
                />

                <View style={s.quizInfo}>
                  <View style={s.quizTop}>
                    <Text style={s.quizTitle} numberOfLines={1}>
                      {quiz.title}
                    </Text>
                    <Text style={[s.quizScore, { color: tone }]}>
                      {quiz.score}%
                    </Text>
                  </View>
                  <ProgressBar
                    value={quiz.score}
                    color={tone}
                    track={colors.borderLight}
                    height={6}
                  />
                  <View style={s.quizBottom}>
                    <Text style={s.quizMeta}>
                      {quiz.attempts} attempt{quiz.attempts === 1 ? "" : "s"}
                    </Text>
                    <View style={s.status}>
                      <Ionicons
                        name={passed ? "checkmark-circle" : "time-outline"}
                        size={13}
                        color={tone}
                      />
                      <Text style={[s.statusText, { color: tone }]}>
                        {passed ? "Mastered" : "Keep practising"}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <TouchableOpacity
          style={s.browseWrap}
          onPress={() => router.push("/(tabs)/library" as any)}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.browseBtn}
          >
            <Ionicons name="library-outline" size={18} color={colors.white} />
            <Text style={s.browseBtnText}>Browse all quizzes</Text>
            <View style={s.browseArrow}>
              <Ionicons name="arrow-forward" size={14} color={colors.primary} />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, ...design.page },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },

  statsBanner: { marginBottom: 26 },

  quizRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginBottom: 10,
    gap: 14,
    ...design.card,
  },
  quizInfo: { flex: 1, gap: 8 },
  quizTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  quizTitle: { ...design.cardTitle, flex: 1 },
  quizScore: { fontSize: 15, fontWeight: "800" },
  quizBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quizMeta: { ...design.caption },
  status: { flexDirection: "row", alignItems: "center", gap: 4 },
  statusText: { fontSize: 11.5, fontWeight: "700" },

  browseWrap: { marginTop: 14, borderRadius: 18, ...elevation.brand },
  browseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  browseBtnText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: colors.white,
  },
  browseArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
});
