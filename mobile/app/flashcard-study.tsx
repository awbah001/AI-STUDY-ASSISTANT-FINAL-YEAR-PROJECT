import { design, elevation } from "../src/theme/design";
/**
 * Flashcard Study Session — SM-2 spaced-repetition review screen.
 *
 * Route:  /flashcard-study?documentId=<id|"all">&title=<string>
 *
 * Flow:
 *   1. Loads due cards for the given document (or all docs if documentId="all").
 *   2. Shows each card one at a time in a flip animation.
 *   3. After the student reveals the answer, 4 rating buttons appear:
 *      Again / Hard / Good / Easy  (SM-2 ratings 0-3).
 *   4. Rating is sent to   trpc.flashcards.rateCard   which persists the new
 *      dueDate, easeFactor, interval, and repetitions.
 *   5. When all cards in the queue are done, a summary screen is shown.
 */

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState, useRef, useEffect } from "react";
import { trpc } from "../src/lib/api";
import { colors, gradients } from "../src/theme/colors";
import { FlippingFlashcard } from "../src/components/FlippingFlashcard";

// SM-2 rating labels, colours, and descriptions shown to the student
const RATINGS = [
  {
    label: "Again",
    value: 0 as const,
    color: colors.error,
    bg: colors.errorSoft,
    icon: "refresh",
    hint: "Forgot",
  },
  {
    label: "Hard",
    value: 1 as const,
    color: "#d97706",
    bg: colors.warningSoft,
    icon: "hourglass",
    hint: "Struggled",
  },
  {
    label: "Good",
    value: 2 as const,
    color: colors.primary,
    bg: colors.primaryLight,
    icon: "checkmark",
    hint: "With effort",
  },
  {
    label: "Easy",
    value: 3 as const,
    color: colors.info,
    bg: colors.infoSoft,
    icon: "flash",
    hint: "Instant",
  },
] as const;

type Rating = 0 | 1 | 2 | 3;

interface CardResult {
  cardId: number;
  question: string;
  rating: Rating;
}

export default function FlashcardStudyScreen() {
  const { documentId, title } = useLocalSearchParams<{
    documentId: string;
    title: string;
  }>();
  const router = useRouter();
  const utils = trpc.useUtils();

  const isAllDocs = documentId === "all";
  const docId = isAllDocs ? undefined : Number(documentId);

  const { data: dueCards, isLoading } = trpc.flashcards.due.useQuery(
    { documentId: docId },
    { staleTime: 0 } // always re-fetch so the queue is fresh
  );

  const [queue, setQueue] = useState<typeof dueCards>([]);
  const [current, setCurrent] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<CardResult[]>([]);
  const [sessionDone, setSessionDone] = useState(false);
  const sessionStart = useRef(Date.now());

  useEffect(() => {
    if (dueCards && dueCards.length > 0 && queue.length === 0) {
      setQueue([...dueCards]);
    }
  }, [dueCards]);

  useEffect(() => {
    setRevealed(false);
  }, [current]);

  const rateCard = trpc.flashcards.rateCard.useMutation({
    onSuccess: () => {
      // Invalidate due counts so the tab badge updates immediately
      utils.flashcards.dueCounts.invalidate();
    },
  });

  const flipCard = () => {
    setRevealed(true);
  };

  const handleRate = (rating: Rating) => {
    const card = queue[current];
    if (!card) return;

    const studyMins = Math.round(
      (Date.now() - sessionStart.current) /
        60000 /
        Math.max(results.length + 1, 1)
    );

    rateCard.mutate({
      flashcardId: card.id,
      rating,
      studyTimeMinutes: studyMins > 0 ? studyMins : undefined,
    });

    setResults(prev => [
      ...prev,
      { cardId: card.id, question: card.question, rating },
    ]);

    const next = current + 1;
    if (next >= queue.length) {
      setSessionDone(true);
    } else {
      setCurrent(next);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
        <Header title={title ?? "Study"} onBack={() => router.back()} />
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={s.loadingText}>Loading your review queue…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isLoading && queue.length === 0) {
    return (
      <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
        <Header title={title ?? "Study"} onBack={() => router.back()} />
        <View style={s.center}>
          <View style={s.emptyHalo}>
            <View style={s.emptyIcon}>
              <Ionicons name="checkmark-done" size={34} color={colors.primary} />
            </View>
          </View>
          <Text style={s.emptyTitle}>All caught up</Text>
          <Text style={s.emptyText}>
            No cards are due for review right now.{"\n"}
            Come back later when your next cards are scheduled.
          </Text>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={16} color={colors.white} />
            <Text style={s.backBtnText}>Back to flashcards</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (sessionDone) {
    const totalMins = Math.round((Date.now() - sessionStart.current) / 60000);
    const again = results.filter(r => r.rating === 0).length;
    const hard = results.filter(r => r.rating === 1).length;
    const good = results.filter(r => r.rating === 2).length;
    const easy = results.filter(r => r.rating === 3).length;

    return (
      <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
        <Header title="Session complete" onBack={() => router.back()} />
        <ScrollView contentContainerStyle={s.summaryScroll}>
          <LinearGradient
            colors={gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.trophyCard}
          >
            <View style={s.trophyRing} />
            <View style={s.trophyIcon}>
              <Ionicons name="trophy" size={30} color="#fbbf24" />
            </View>
            <Text style={s.summaryTitle}>Great work!</Text>
            <Text style={s.summarySub}>
              You reviewed {results.length} card
              {results.length !== 1 ? "s" : ""} in{" "}
              {totalMins < 1 ? "<1" : totalMins} min
            </Text>
          </LinearGradient>

          <View style={s.breakdownCard}>
            <Text style={s.breakdownTitle}>Rating breakdown</Text>
            {[
              { label: "Again", count: again, color: colors.error },
              { label: "Hard", count: hard, color: "#d97706" },
              { label: "Good", count: good, color: colors.primary },
              { label: "Easy", count: easy, color: colors.info },
            ].map(r => (
              <View key={r.label} style={s.breakdownRow}>
                <View style={[s.breakdownDot, { backgroundColor: r.color }]} />
                <Text style={s.breakdownLabel}>{r.label}</Text>
                <View style={s.breakdownBarBg}>
                  <View
                    style={[
                      s.breakdownBarFill,
                      {
                        width:
                          results.length > 0
                            ? (`${(r.count / results.length) * 100}%` as any)
                            : "0%",
                        backgroundColor: r.color,
                      },
                    ]}
                  />
                </View>
                <Text style={s.breakdownCount}>{r.count}</Text>
              </View>
            ))}
          </View>

          {again > 0 && (
            <View style={s.nextDueCard}>
              <View style={s.nextDueIcon}>
                <Ionicons name="alarm" size={18} color="#d97706" />
              </View>
              <Text style={s.nextDueText}>
                {again} card{again !== 1 ? "s" : ""} marked "Again" will be due
                again tomorrow.
              </Text>
            </View>
          )}

          <TouchableOpacity style={s.doneBtn} onPress={() => router.back()}>
            <Text style={s.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const card = queue[current]!;
  const progress = current / queue.length;
  const studyCardHeight = Math.min(
    420,
    Math.max(320, Dimensions.get("window").height * 0.42)
  );

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <Header
        title={title ?? "Study"}
        onBack={() => router.back()}
        right={`${current + 1} / ${queue.length}`}
      />

      <View style={s.progressWrap}>
        <View style={s.progressBg}>
          <View
            style={[s.progressFill, { width: `${progress * 100}%` as any }]}
          />
        </View>
      </View>

      <View style={s.cardArea}>
        <FlippingFlashcard
          key={card.id}
          question={card.question}
          answer={card.answer}
          flipped={revealed}
          allowFlipBack={false}
          onFlip={showingAnswer => {
            if (showingAnswer) setRevealed(true);
          }}
          height={studyCardHeight}
          style={{ marginBottom: 0 }}
        />

        {revealed ? (
          <View style={s.ratingArea}>
            <Text style={s.ratingPrompt}>How well did you know this?</Text>
            <View style={s.ratingRow}>
              {RATINGS.map(r => (
                <TouchableOpacity
                  key={r.value}
                  style={s.ratingBtn}
                  onPress={() => handleRate(r.value)}
                  activeOpacity={0.8}
                  disabled={rateCard.isPending}
                >
                  <View style={[s.ratingIcon, { backgroundColor: r.bg }]}>
                    <Ionicons name={r.icon as any} size={19} color={r.color} />
                  </View>
                  <Text style={[s.ratingLabel, { color: r.color }]}>
                    {r.label}
                  </Text>
                  <Text style={s.ratingHint}>{r.hint}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={s.revealWrap}
            onPress={flipCard}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={gradients.hero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.revealBtn}
            >
              <Ionicons name="eye-outline" size={20} color={colors.white} />
              <Text style={s.revealBtnText}>Reveal answer</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

function Header({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  right?: string;
}) {
  return (
    <View style={s.headerBar}>
      <TouchableOpacity
        onPress={onBack}
        style={s.backArrow}
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={21} color={colors.text} />
      </TouchableOpacity>
      <View style={s.headerCenter}>
        <Text style={s.headerEyebrow}>Flashcards</Text>
        <Text style={s.headerTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {right ? (
        <View style={s.progressBadge}>
          <Text style={s.progressBadgeText}>{right}</Text>
        </View>
      ) : (
        <View style={{ width: 44 }} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, ...design.page },

  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backArrow: { ...design.iconButton, borderRadius: 22 },
  headerCenter: { flex: 1, alignItems: "center" },
  headerEyebrow: { ...design.eyebrow, color: colors.primary, fontSize: 10 },
  headerTitle: { ...design.cardTitle, fontSize: 16.5, marginTop: 1 },
  progressBadge: {
    minWidth: 44,
    backgroundColor: colors.primaryLight,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: "center",
  },
  progressBadgeText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: colors.primaryDark,
  },

  progressWrap: { paddingHorizontal: 20, paddingTop: 6 },
  progressBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderLight,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.primary,
  },

  cardArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 20,
    justifyContent: "space-between",
  },

  revealWrap: { borderRadius: 18, ...elevation.brand },
  revealBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 17,
    borderRadius: 18,
  },
  revealBtnText: { fontSize: 16, fontWeight: "800", color: colors.white },

  ratingArea: { gap: 12 },
  ratingPrompt: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    textAlign: "center",
  },
  ratingRow: { flexDirection: "row", gap: 8 },
  ratingBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: "center",
    gap: 5,
    ...design.card,
    borderRadius: 18,
  },
  ratingIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingLabel: { fontSize: 13.5, fontWeight: "800" },
  ratingHint: { fontSize: 10.5, color: colors.textMuted, textAlign: "center" },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 32,
  },
  loadingText: { fontSize: 14, color: colors.textMuted },
  emptyHalo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...elevation.sm,
  },
  emptyTitle: { ...design.screenTitle, fontSize: 24 },
  emptyText: { textAlign: "center", ...design.body },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  backBtnText: { fontSize: 15, fontWeight: "700", color: colors.white },

  summaryScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
  },
  trophyCard: {
    alignItems: "center",
    gap: 6,
    padding: 28,
    borderRadius: 26,
    overflow: "hidden",
  },
  trophyRing: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    right: -90,
    top: -110,
  },
  trophyIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  summaryTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: colors.white,
    letterSpacing: -0.4,
  },
  summarySub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
  },

  breakdownCard: { padding: 20, gap: 14, ...design.card },
  breakdownTitle: { marginBottom: 2, ...design.sectionTitle },
  breakdownRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  breakdownDot: { width: 8, height: 8, borderRadius: 4 },
  breakdownLabel: {
    width: 44,
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  breakdownBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: colors.borderLight,
    borderRadius: 4,
    overflow: "hidden",
  },
  breakdownBarFill: { height: "100%", borderRadius: 4 },
  breakdownCount: {
    width: 24,
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
    textAlign: "right",
  },

  nextDueCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.warningSoft,
  },
  nextDueIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  nextDueText: { flex: 1, fontSize: 13, color: "#92400e", lineHeight: 18 },

  doneBtn: { paddingVertical: 16, marginTop: 4, ...design.action },
  doneBtnText: { fontSize: 16, fontWeight: "800", color: colors.white },
});
