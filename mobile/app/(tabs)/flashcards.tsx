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
  SectionHeader,
  StatBanner,
} from "../../src/components/ui/Kit";

const STUDY_ACCENTS = [
  { gradient: gradients.hero, bar: colors.accent, text: colors.primaryDark },
  { gradient: ["#3b6fd8", "#1e3a8a"] as const, bar: "#93c5fd", text: "#1e3a8a" },
];
const DECK_ACCENTS = [
  colors.primaryLight,
  colors.infoSoft,
  colors.warningSoft,
  colors.violetSoft,
  colors.errorSoft,
];
const DECK_ICON_COLORS = [
  colors.primary,
  colors.info,
  "#d97706",
  colors.violet,
  colors.error,
];

export default function FlashcardsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  // Real data from server
  const {
    data: documents,
    isLoading,
    refetch,
  } = trpc.documents.list.useQuery();
  const { data: dueCounts, refetch: refetchDue } =
    trpc.flashcards.dueCounts.useQuery();
  const { data: progress, refetch: refetchP } = trpc.progress.stats.useQuery();

  // Compute stats from real due-count data
  const totalDueToday = (dueCounts ?? []).reduce((s, d) => s + d.dueCount, 0);
  const totalReviewed = (progress ?? []).reduce(
    (s, p) => s + (p.flashcardsReviewed ?? 0),
    0
  );

  // Total cards = sum of flashcard lists per doc (we approximate from dueCounts + reviewed)
  // A better UX metric: how many unique docs have ANY due card
  const docsWithDue = new Set(
    (dueCounts ?? []).filter(d => d.dueCount > 0).map(d => d.documentId)
  );

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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── Header ── */}
        <BackHeader title="Flashcards" subtitle="Review your decks" />

        <StatBanner
          style={s.statsBanner}
          items={[
            { value: masteredApprox, label: "Reviewed" },
            { value: documents?.length ?? 0, label: "Decks" },
            { value: totalDueToday, label: "Due today", highlight: totalDueToday > 0 },
          ]}
        />

        {/* ── Due-today alert banner (shown only when cards are due) ── */}
        {totalDueToday > 0 && (
          <TouchableOpacity
            style={s.dueBanner}
            onPress={() => {
              // Navigate to all-due study across all docs
              router.push({
                pathname: "/flashcard-study",
                params: { documentId: "all", title: "Due Today" },
              });
            }}
            activeOpacity={0.85}
          >
            <View style={s.dueBannerLeft}>
              <View style={s.dueFlame}>
                <Ionicons name="flame" size={20} color={colors.warning} />
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text style={s.dueBannerTitle}>
                  {totalDueToday} card{totalDueToday !== 1 ? "s" : ""} due for
                  review
                </Text>
                <Text style={s.dueBannerSub}>
                  Tap to study • {docsWithDue.size} deck
                  {docsWithDue.size !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>
            <View style={s.dueGo}>
              <Ionicons name="arrow-forward" size={15} color={colors.white} />
            </View>
          </TouchableOpacity>
        )}

        <SectionHeader title="Study now" />

        {isLoading ? (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginBottom: 24 }}
          />
        ) : studyNow.length === 0 ? (
          <EmptyCard
            icon="layers-outline"
            title="No decks yet"
            body="Ask your lecturer to share materials or upload your own."
          />
        ) : (
          <View style={s.studyRow}>
            {studyNow.map((doc, idx) => {
              const ac = STUDY_ACCENTS[idx % STUDY_ACCENTS.length];
              // Real due count for this specific document
              const due =
                (dueCounts ?? []).find(d => d.documentId === doc.id)
                  ?.dueCount ?? 0;
              const reviewed =
                (progress ?? []).find(p => p.documentId === doc.id)
                  ?.flashcardsReviewed ?? 0;

              return (
                <TouchableOpacity
                  key={doc.id}
                  style={s.studyCardWrap}
                  onPress={() => startStudy(doc.id, doc.title)}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={ac.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.studyCard}
                  >
                    <View style={s.studyRing} />
                    <View style={s.studyIcon}>
                      <Ionicons name="layers" size={16} color={colors.white} />
                    </View>
                    <Text style={s.studyCardTitle} numberOfLines={2}>
                      {doc.title}
                    </Text>

                    {due > 0 ? (
                      <View style={s.duePill}>
                        <Ionicons name="alarm-outline" size={11} color="#fde68a" />
                        <Text style={s.duePillText}>{due} due</Text>
                      </View>
                    ) : (
                      <Text style={s.studyCardCount}>{reviewed} reviewed</Text>
                    )}

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
                      style={s.continueBtn}
                      onPress={() => startStudy(doc.id, doc.title)}
                    >
                      <Text style={[s.continueBtnText, { color: ac.text }]}>
                        {due > 0 ? `Review ${due}` : "Study"}
                      </Text>
                      <Ionicons name="arrow-forward" size={13} color={ac.text} />
                    </TouchableOpacity>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <SectionHeader title="Recent decks" style={{ marginTop: 24 }} />

        {recentDecks.length === 0 ? (
          <Text style={s.emptyInline}>No more decks available.</Text>
        ) : (
          recentDecks.map((doc, idx) => {
            const ibg = DECK_ACCENTS[idx % DECK_ACCENTS.length];
            const ic = DECK_ICON_COLORS[idx % DECK_ICON_COLORS.length];
            const due =
              (dueCounts ?? []).find(d => d.documentId === doc.id)?.dueCount ??
              0;

            return (
              <TouchableOpacity
                key={doc.id}
                style={s.deckRow}
                onPress={() => startStudy(doc.id, doc.title)}
                activeOpacity={0.75}
              >
                <IconTile icon="layers" color={ic} bg={ibg} size={46} />
                <View style={s.deckInfo}>
                  <Text style={s.deckTitle} numberOfLines={1}>
                    {doc.title}
                  </Text>
                  {due > 0 ? (
                    <Text style={[s.deckCount, { color: "#c2710c", fontWeight: "700" }]}>
                      {due} card{due !== 1 ? "s" : ""} due
                    </Text>
                  ) : (
                    <View style={s.upToDate}>
                      <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                      <Text style={[s.deckCount, { marginTop: 0 }]}>Up to date</Text>
                    </View>
                  )}
                </View>
                {due > 0 && (
                  <View style={s.dueDot}>
                    <Text style={s.dueDotText}>{due}</Text>
                  </View>
                )}
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textLight}
                />
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
  safe: { flex: 1, ...design.page },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { ...design.screenTitle },
  trophyBtn: { ...design.iconButton },

  statsBanner: { marginBottom: 14 },

  dueBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.warningSoft,
    borderRadius: 18,
    padding: 14,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: "#fde6b0",
  },
  dueBannerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  dueFlame: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  dueBannerTitle: { fontSize: 14, fontWeight: "700", color: "#7c3a06" },
  dueBannerSub: { fontSize: 12, color: "#a16207", marginTop: 2 },
  dueGo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.warning,
    alignItems: "center",
    justifyContent: "center",
  },

  studyRow: { flexDirection: "row", gap: 12, marginBottom: 4 },
  studyCardWrap: { flex: 1, borderRadius: 22, ...elevation.md },
  studyCard: {
    flex: 1,
    padding: 16,
    gap: 10,
    minHeight: 190,
    borderRadius: 22,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  studyRing: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    right: -60,
    top: -60,
  },
  studyIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  studyCardTitle: { ...design.cardTitle, color: colors.white },
  studyCardCount: { fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: "600" },
  duePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(253,230,138,0.18)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  duePillText: { fontSize: 11, fontWeight: "700", color: "#fde68a" },
  studyBarBg: {
    height: 5,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 3,
    overflow: "hidden",
  },
  studyBarFill: { height: "100%", borderRadius: 3 },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 12,
    paddingVertical: 9,
    backgroundColor: colors.white,
  },
  continueBtnText: { fontSize: 12.5, fontWeight: "800" },

  deckRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginBottom: 10,
    gap: 12,
    ...design.card,
  },
  deckInfo: { flex: 1 },
  deckTitle: { ...design.cardTitle },
  deckCount: { marginTop: 3, ...design.caption },
  upToDate: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  dueDot: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.warning,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  dueDotText: { fontSize: 11, fontWeight: "800", color: colors.white },

  emptyInline: { fontSize: 13, color: colors.textMuted, marginBottom: 20 },
});
