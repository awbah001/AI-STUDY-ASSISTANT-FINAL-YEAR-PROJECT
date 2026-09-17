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
import { useState, useRef, useEffect } from "react";
import { trpc } from "../src/lib/api";
import { colors } from "../src/theme/colors";
import { FlippingFlashcard } from "../src/components/FlippingFlashcard";

// SM-2 rating labels, colours, and descriptions shown to the student
const RATINGS = [
  { label: "Again",  value: 0 as const, color: "#ef4444", bg: "#fef2f2", icon: "refresh",       hint: "Forgot completely" },
  { label: "Hard",   value: 1 as const, color: "#f59e0b", bg: "#fffbeb", icon: "hourglass",     hint: "Difficult but correct" },
  { label: "Good",   value: 2 as const, color: colors.primary, bg: "#e8fdf2", icon: "checkmark",hint: "Correct with effort" },
  { label: "Easy",   value: 3 as const, color: "#3b82f6", bg: "#eff6ff", icon: "flash",         hint: "Instant recall" },
] as const;

type Rating = 0 | 1 | 2 | 3;

interface CardResult {
  cardId: number;
  question: string;
  rating: Rating;
}

export default function FlashcardStudyScreen() {
  const { documentId, title } = useLocalSearchParams<{ documentId: string; title: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();

  const isAllDocs = documentId === "all";
  const docId = isAllDocs ? undefined : Number(documentId);

  // ── Load due cards ─────────────────────────────────────────────────────────
  const { data: dueCards, isLoading } = trpc.flashcards.due.useQuery(
    { documentId: docId },
    { staleTime: 0 } // always re-fetch so the queue is fresh
  );

  // ── Session state ──────────────────────────────────────────────────────────
  const [queue, setQueue] = useState<typeof dueCards>([]);
  const [current, setCurrent] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<CardResult[]>([]);
  const [sessionDone, setSessionDone] = useState(false);
  const sessionStart = useRef(Date.now());

  // Populate queue once data arrives
  useEffect(() => {
    if (dueCards && dueCards.length > 0 && queue.length === 0) {
      setQueue([...dueCards]);
    }
  }, [dueCards]);

  // Reset flip when card changes
  useEffect(() => {
    setRevealed(false);
  }, [current]);

  // ── SM-2 rating mutation ───────────────────────────────────────────────────
  const rateCard = trpc.flashcards.rateCard.useMutation({
    onSuccess: () => {
      // Invalidate due counts so the tab badge updates immediately
      utils.flashcards.dueCounts.invalidate();
    },
  });

  // ── Flip card ─────────────────────────────────────────────────────────────
  const flipCard = () => {
    setRevealed(true);
  };

  // ── Rate and advance ───────────────────────────────────────────────────────
  const handleRate = (rating: Rating) => {
    const card = queue[current];
    if (!card) return;

    const studyMins = Math.round((Date.now() - sessionStart.current) / 60000 / Math.max(results.length + 1, 1));

    rateCard.mutate({
      flashcardId: card.id,
      rating,
      studyTimeMinutes: studyMins > 0 ? studyMins : undefined,
    });

    setResults((prev) => [
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

  // ── Flip interpolations ────────────────────────────────────────────────────
  const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const backRotate  = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });
  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 0.5, 0.5, 1], outputRange: [1, 1, 0, 0] });
  const backOpacity  = flipAnim.interpolate({ inputRange: [0, 0.5, 0.5, 1], outputRange: [0, 0, 1, 1] });

  // ── Empty / loading states ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <Header title={title ?? "Study"} onBack={() => router.back()} />
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={s.loadingText}>Loading your review queue…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isLoading && (queue.length === 0)) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <Header title={title ?? "Study"} onBack={() => router.back()} />
        <View style={s.center}>
          <View style={s.emptyIcon}>
            <Ionicons name="checkmark-circle" size={52} color={colors.primary} />
          </View>
          <Text style={s.emptyTitle}>All caught up! 🎉</Text>
          <Text style={s.emptyText}>
            No cards are due for review right now.{"\n"}
            Come back later when your next cards are scheduled.
          </Text>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backBtnText}>Back to Flashcards</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Session complete ───────────────────────────────────────────────────────
  if (sessionDone) {
    const totalMins = Math.round((Date.now() - sessionStart.current) / 60000);
    const again = results.filter((r) => r.rating === 0).length;
    const hard  = results.filter((r) => r.rating === 1).length;
    const good  = results.filter((r) => r.rating === 2).length;
    const easy  = results.filter((r) => r.rating === 3).length;

    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <Header title="Session Complete" onBack={() => router.back()} />
        <ScrollView contentContainerStyle={s.summaryScroll}>
          {/* Trophy */}
          <View style={s.trophyWrap}>
            <Text style={s.trophyEmoji}>🏆</Text>
            <Text style={s.summaryTitle}>Great work!</Text>
            <Text style={s.summarySub}>
              You reviewed {results.length} card{results.length !== 1 ? "s" : ""} in {totalMins < 1 ? "<1" : totalMins} min
            </Text>
          </View>

          {/* Rating breakdown */}
          <View style={s.breakdownCard}>
            <Text style={s.breakdownTitle}>Rating breakdown</Text>
            {[
              { label: "Again", count: again, color: "#ef4444" },
              { label: "Hard",  count: hard,  color: "#f59e0b" },
              { label: "Good",  count: good,  color: colors.primary },
              { label: "Easy",  count: easy,  color: "#3b82f6" },
            ].map((r) => (
              <View key={r.label} style={s.breakdownRow}>
                <Text style={[s.breakdownLabel, { color: r.color }]}>{r.label}</Text>
                <View style={s.breakdownBarBg}>
                  <View
                    style={[
                      s.breakdownBarFill,
                      {
                        width: results.length > 0 ? `${(r.count / results.length) * 100}%` as any : "0%",
                        backgroundColor: r.color,
                      },
                    ]}
                  />
                </View>
                <Text style={s.breakdownCount}>{r.count}</Text>
              </View>
            ))}
          </View>

          {/* Next due info */}
          {again > 0 && (
            <View style={s.nextDueCard}>
              <Ionicons name="alarm-outline" size={18} color="#f59e0b" />
              <Text style={s.nextDueText}>
                {again} card{again !== 1 ? "s" : ""} marked "Again" will be due again tomorrow.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={s.doneBtn}
            onPress={() => router.back()}
          >
            <Text style={s.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Active study card ──────────────────────────────────────────────────────
  const card = queue[current]!;
  const progress = current / queue.length;
  const studyCardHeight = Math.min(420, Math.max(320, Dimensions.get("window").height * 0.42));

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <Header
        title={title ?? "Study"}
        onBack={() => router.back()}
        right={`${current + 1} / ${queue.length}`}
      />

      {/* Progress bar */}
      <View style={s.progressBg}>
        <View style={[s.progressFill, { width: `${progress * 100}%` as any }]} />
      </View>

      <View style={s.cardArea}>
        <FlippingFlashcard
          key={card.id}
          question={card.question}
          answer={card.answer}
          flipped={revealed}
          allowFlipBack={false}
          onFlip={(showingAnswer) => {
            if (showingAnswer) setRevealed(true);
          }}
          height={studyCardHeight}
          style={{ marginBottom: 0 }}
        />

        {/* ── SM-2 rating buttons (visible after reveal) ── */}
        {revealed ? (
          <View style={s.ratingArea}>
            <Text style={s.ratingPrompt}>How well did you know this?</Text>
            <View style={s.ratingRow}>
              {RATINGS.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[s.ratingBtn, { backgroundColor: r.bg, borderColor: r.color + "55" }]}
                  onPress={() => handleRate(r.value)}
                  activeOpacity={0.8}
                  disabled={rateCard.isPending}
                >
                  <View style={[s.ratingIcon, { backgroundColor: r.color + "22" }]}>
                    <Ionicons name={r.icon as any} size={18} color={r.color} />
                  </View>
                  <Text style={[s.ratingLabel, { color: r.color }]}>{r.label}</Text>
                  <Text style={s.ratingHint}>{r.hint}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <TouchableOpacity style={s.revealBtn} onPress={flipCard} activeOpacity={0.85}>
            <Ionicons name="eye-outline" size={20} color={colors.white} />
            <Text style={s.revealBtnText}>Reveal Answer</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Small header component ─────────────────────────────────────────────────────
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
      <TouchableOpacity onPress={onBack} style={s.backArrow}>
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </TouchableOpacity>
      <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
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

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5f6fa" },

  // Header
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backArrow: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.text, textAlign: "center" },
  progressBadge: {
    minWidth: 44,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: "center",
  },
  progressBadgeText: { fontSize: 12, fontWeight: "700", color: colors.primaryDark },

  // Session progress bar
  progressBg: {
    height: 4,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
  },

  // Card area
  cardArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 20,
  },
  cardWrapper: {
    flex: 1,
    position: "relative",
  },
  card: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 28,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    backfaceVisibility: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  cardFront: { borderTopWidth: 4, borderTopColor: colors.primary },
  cardBack:  { borderTopWidth: 4, borderTopColor: "#3b82f6" },
  cardLabel: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  cardLabelText: { fontSize: 12, fontWeight: "700", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.5 },
  cardQuestion: { fontSize: 18, fontWeight: "700", color: colors.text, textAlign: "center", lineHeight: 28 },
  cardAnswer:   { fontSize: 16, fontWeight: "500", color: colors.textSub, textAlign: "center", lineHeight: 26 },
  tapHint: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
  tapHintText: { fontSize: 12, color: colors.textLight },

  // Reveal button
  revealBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  revealBtnText: { fontSize: 16, fontWeight: "800", color: colors.white },

  // Rating buttons
  ratingArea: { gap: 12 },
  ratingPrompt: { fontSize: 13, fontWeight: "600", color: colors.textMuted, textAlign: "center" },
  ratingRow: { flexDirection: "row", gap: 8 },
  ratingBtn: {
    flex: 1,
    borderRadius: 16,
    padding: 10,
    alignItems: "center",
    gap: 5,
    borderWidth: 1.5,
  },
  ratingIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingLabel: { fontSize: 13, fontWeight: "800" },
  ratingHint:  { fontSize: 9, color: colors.textLight, textAlign: "center" },

  // Empty / loading
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 32 },
  loadingText: { fontSize: 14, color: colors.textMuted },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 22, fontWeight: "800", color: colors.text },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 22 },
  backBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  backBtnText: { fontSize: 15, fontWeight: "700", color: colors.white },

  // Session summary
  summaryScroll: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40, gap: 20 },
  trophyWrap: { alignItems: "center", gap: 10, marginBottom: 4 },
  trophyEmoji: { fontSize: 56 },
  summaryTitle: { fontSize: 24, fontWeight: "900", color: colors.text },
  summarySub: { fontSize: 14, color: colors.textMuted, textAlign: "center" },

  breakdownCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  breakdownTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 4 },
  breakdownRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  breakdownLabel: { width: 44, fontSize: 13, fontWeight: "700" },
  breakdownBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    overflow: "hidden",
  },
  breakdownBarFill: { height: "100%", borderRadius: 4 },
  breakdownCount: { width: 24, fontSize: 13, fontWeight: "700", color: colors.textMuted, textAlign: "right" },

  nextDueCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fffbeb",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  nextDueText: { flex: 1, fontSize: 13, color: "#92400e", lineHeight: 18 },

  doneBtn: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
    marginTop: 8,
  },
  doneBtnText: { fontSize: 16, fontWeight: "800", color: colors.white },
});
