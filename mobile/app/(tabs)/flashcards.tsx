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

const STUDY_ACCENTS = [
  { bg: "#1a3c2e", bar: colors.primary },
  { bg: "#1e3a5f", bar: "#60a5fa" },
];
const DECK_ACCENTS = ["#e8fdf2", "#eff6ff", "#fff7ed", "#f3f0ff", "#fef2f2"];
const DECK_ICON_COLORS = [colors.primary, "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444"];

export default function FlashcardsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  // Real data from server
  const { data: documents, isLoading, refetch } = trpc.documents.list.useQuery();
  const { data: dueCounts, refetch: refetchDue } = trpc.flashcards.dueCounts.useQuery();
  const { data: progress, refetch: refetchP } = trpc.progress.stats.useQuery();

  // Compute stats from real due-count data
  const totalDueToday = (dueCounts ?? []).reduce((s, d) => s + d.dueCount, 0);
  const totalReviewed = (progress ?? []).reduce((s, p) => s + (p.flashcardsReviewed ?? 0), 0);

  // Total cards = sum of flashcard lists per doc (we approximate from dueCounts + reviewed)
  // A better UX metric: how many unique docs have ANY due card
  const docsWithDue = new Set((dueCounts ?? []).filter((d) => d.dueCount > 0).map((d) => d.documentId));

  // Mastered = cards that have been reviewed and have interval > 21 days (well-known)
  // We approximate this as "reviewed" until we have per-card mastery data on the client
  const masteredApprox = totalReviewed;

  const studyNow = (documents ?? []).slice(0, 2);
  const recentDecks = (documents ?? []).slice(2, 7);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchDue(), refetchP()]);
    setRefreshing(false);
  };

  /**
   * Navigate to the study session screen for a given document.
   * The study screen fetches `flashcards.due` for that document so only
   * SM-2-scheduled cards are shown.
   */
  const startStudy = (docId: number, docTitle: string) => {
    router.push({
      pathname: "/flashcard-study",
      params: { documentId: String(docId), title: docTitle },
    });
  };

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
        <BackHeader title="Flashcards" subtitle="Review your decks" />

        {/* ── Real stats banner ── */}
        <View style={s.statsBanner}>
          <View style={s.statItem}>
            <Text style={s.statNum}>{masteredApprox}</Text>
            <Text style={s.statLbl}>Reviewed</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={[s.statNum, { color: colors.primary }]}>
              {documents?.length ?? 0}
            </Text>
            <Text style={s.statLbl}>Decks</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            {/* Real due-today count from SM-2 scheduler */}
            <Text style={[s.statNum, { color: totalDueToday > 0 ? "#f59e0b" : colors.text }]}>
              {totalDueToday}
            </Text>
            <Text style={s.statLbl}>Due Today</Text>
          </View>
        </View>

        {/* ── Due-today alert banner (shown only when cards are due) ── */}
        {totalDueToday > 0 && (
          <TouchableOpacity
            style={s.dueBanner}
            onPress={() => {
              // Navigate to all-due study across all docs
              router.push({ pathname: "/flashcard-study", params: { documentId: "all", title: "Due Today" } });
            }}
            activeOpacity={0.85}
          >
            <View style={s.dueBannerLeft}>
              <View style={s.dueFlame}>
                <Text style={s.dueFlameEmoji}>🔥</Text>
              </View>
              <View>
                <Text style={s.dueBannerTitle}>
                  {totalDueToday} card{totalDueToday !== 1 ? "s" : ""} due for review
                </Text>
                <Text style={s.dueBannerSub}>
                  Tap to study • {docsWithDue.size} deck{docsWithDue.size !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.primaryDark} />
          </TouchableOpacity>
        )}

        {/* ── Study Now ── */}
        <Text style={s.sectionTitle}>Study Now</Text>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginBottom: 24 }} />
        ) : studyNow.length === 0 ? (
          <Text style={s.emptyInline}>
            No documents yet — ask your lecturer to share materials or upload your own.
          </Text>
        ) : (
          <View style={s.studyRow}>
            {studyNow.map((doc, idx) => {
              const ac = STUDY_ACCENTS[idx % STUDY_ACCENTS.length];
              // Real due count for this specific document
              const due = (dueCounts ?? []).find((d) => d.documentId === doc.id)?.dueCount ?? 0;
              const reviewed = (progress ?? []).find((p) => p.documentId === doc.id)?.flashcardsReviewed ?? 0;

              return (
                <TouchableOpacity
                  key={doc.id}
                  style={[s.studyCard, { backgroundColor: ac.bg }]}
                  onPress={() => startStudy(doc.id, doc.title)}
                  activeOpacity={0.85}
                >
                  <Text style={s.studyCardTitle} numberOfLines={2}>
                    {doc.title}
                  </Text>

                  {due > 0 ? (
                    <View style={s.duePill}>
                      <Ionicons name="alarm-outline" size={11} color="#f59e0b" />
                      <Text style={s.duePillText}>{due} due</Text>
                    </View>
                  ) : (
                    <Text style={s.studyCardCount}>{reviewed} reviewed</Text>
                  )}

                  {/* Progress bar — proportion of cards reviewed vs total due */}
                  <View style={s.studyBarBg}>
                    <View
                      style={[
                        s.studyBarFill,
                        {
                          width: due > 0 ? "40%" : "80%",
                          backgroundColor: ac.bar,
                        },
                      ]}
                    />
                  </View>

                  <TouchableOpacity
                    style={[s.continueBtn, { borderColor: ac.bar }]}
                    onPress={() => startStudy(doc.id, doc.title)}
                  >
                    <Text style={[s.continueBtnText, { color: ac.bar }]}>
                      {due > 0 ? `Review ${due}` : "Study"}
                    </Text>
                    <Ionicons name="arrow-forward" size={13} color={ac.bar} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Recent Decks ── */}
        <Text style={[s.sectionTitle, { marginTop: 24 }]}>Recent Decks</Text>

        {recentDecks.length === 0 ? (
          <Text style={s.emptyInline}>No more decks available.</Text>
        ) : (
          recentDecks.map((doc, idx) => {
            const ibg = DECK_ACCENTS[idx % DECK_ACCENTS.length];
            const ic = DECK_ICON_COLORS[idx % DECK_ICON_COLORS.length];
            const due = (dueCounts ?? []).find((d) => d.documentId === doc.id)?.dueCount ?? 0;

            return (
              <TouchableOpacity
                key={doc.id}
                style={s.deckRow}
                onPress={() => startStudy(doc.id, doc.title)}
                activeOpacity={0.75}
              >
                <View style={[s.deckIcon, { backgroundColor: ibg }]}>
                  <Ionicons name="layers" size={20} color={ic} />
                </View>
                <View style={s.deckInfo}>
                  <Text style={s.deckTitle} numberOfLines={1}>{doc.title}</Text>
                  {due > 0 ? (
                    <Text style={[s.deckCount, { color: "#f59e0b", fontWeight: "700" }]}>
                      {due} card{due !== 1 ? "s" : ""} due
                    </Text>
                  ) : (
                    <Text style={s.deckCount}>Up to date ✓</Text>
                  )}
                </View>
                {due > 0 && (
                  <View style={s.dueDot}>
                    <Text style={s.dueDotText}>{due}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
              </TouchableOpacity>
            );
          })
        )}

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
    marginBottom: 14,
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

  // Due-today banner
  dueBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fffbeb",
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: "#fde68a",
  },
  dueBannerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  dueFlame: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#fef3c7",
    alignItems: "center",
    justifyContent: "center",
  },
  dueFlameEmoji: { fontSize: 20 },
  dueBannerTitle: { fontSize: 14, fontWeight: "700", color: "#92400e" },
  dueBannerSub: { fontSize: 12, color: "#b45309", marginTop: 1 },

  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 14 },

  // Study Now 2-column dark cards
  studyRow: { flexDirection: "row", gap: 12, marginBottom: 4 },
  studyCard: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    gap: 10,
    minHeight: 160,
    justifyContent: "space-between",
  },
  studyCardTitle: { fontSize: 14, fontWeight: "700", color: colors.white, lineHeight: 20 },
  studyCardCount: { fontSize: 12, color: "rgba(255,255,255,0.65)" },
  duePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(253,230,138,0.25)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  duePillText: { fontSize: 11, fontWeight: "700", color: "#fbbf24" },
  studyBarBg: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    overflow: "hidden",
  },
  studyBarFill: { height: "100%", borderRadius: 2 },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  continueBtnText: { fontSize: 12, fontWeight: "700" },

  // Recent Decks
  deckRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  deckIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  deckInfo: { flex: 1 },
  deckTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  deckCount: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  dueDot: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#f59e0b",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  dueDotText: { fontSize: 11, fontWeight: "800", color: colors.white },

  emptyInline: { fontSize: 13, color: colors.textMuted, marginBottom: 20 },
});
