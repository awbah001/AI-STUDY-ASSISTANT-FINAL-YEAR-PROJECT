import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { trpc } from "../../lib/api";
import { friendlyError } from "../../lib/friendlyError";
import { colors } from "../../theme/colors";
import { design, radius } from "../../theme/design";

type Source = { kind: "quiz"; quizId: number; answers: Record<string, string> } | { kind: "exam"; examId: number };

function when(ms: number | null) {
  return ms
    ? new Date(ms).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "";
}

/** Turns wrong answers into flashcards, a retry quiz and two planner sessions. */
export function PracticeMistakes({ source, mistakes }: { source: Source; mistakes: number }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const onSuccess = () => {
    void utils.flashcards.invalidate();
    void utils.quizzes.invalidate();
    void utils.planner.invalidate();
    void utils.studentLearning.dashboard.invalidate();
  };
  const onError = (error: { message: string }) =>
    Alert.alert("Couldn't build practice", friendlyError(error.message, "Please try again."));
  const fromQuiz = trpc.practice.fromQuiz.useMutation({ onSuccess, onError });
  const fromExam = trpc.practice.fromExam.useMutation({ onSuccess, onError });
  const mutation = source.kind === "quiz" ? fromQuiz : fromExam;
  const result = mutation.data;

  if (mistakes === 0) return null;

  if (result) {
    return (
      <View style={s.card} accessibilityLiveRegion="polite">
        <View style={s.head}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={s.title}>{result.alreadyCreated ? "Practice set already made" : "Practice set ready"}</Text>
        </View>
        {!result.alreadyCreated && (
          <>
            <Text style={s.line}>
              {result.flashcardsCreated
                ? `${result.flashcardsCreated} flashcard${result.flashcardsCreated === 1 ? "" : "s"} added to your review queue.`
                : "These questions are already in your flashcards."}
            </Text>
            {result.retryQuizzes.map((q) => (
              <Text key={q.id} style={s.line}>
                {q.title} · {q.questions} question{q.questions === 1 ? "" : "s"}
              </Text>
            ))}
            {result.reviewAt ? (
              <Text style={s.line}>
                Review on {when(result.reviewAt)}, re-quiz on {when(result.requizAt)}. Both are in your planner.
              </Text>
            ) : null}
          </>
        )}
        <View style={s.actions}>
          <TouchableOpacity style={s.linkBtn} onPress={() => router.push("/(tabs)/flashcards")}>
            <Ionicons name="layers-outline" size={15} color={colors.primary} />
            <Text style={s.linkText}>Flashcards</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.linkBtn} onPress={() => router.push("/(tabs)/planner")}>
            <Ionicons name="calendar-outline" size={15} color={colors.primary} />
            <Text style={s.linkText}>Planner</Text>
          </TouchableOpacity>
          {result.retryQuizzes[0] ? (
            <TouchableOpacity
              style={s.linkBtn}
              onPress={() =>
                router.push({
                  pathname: "/document/[id]",
                  params: { id: result.retryQuizzes[0].documentId, tab: "quiz", quizId: result.retryQuizzes[0].id },
                })
              }
            >
              <Ionicons name="refresh" size={15} color={colors.primary} />
              <Text style={s.linkText}>Retry quiz</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[s.button, mutation.isPending && { opacity: 0.7 }]}
      disabled={mutation.isPending}
      activeOpacity={0.85}
      accessibilityRole="button"
      onPress={() =>
        source.kind === "quiz"
          ? fromQuiz.mutate({ quizId: source.quizId, answers: source.answers })
          : fromExam.mutate({ examId: source.examId })
      }
    >
      {mutation.isPending ? (
        <ActivityIndicator color={colors.primary} size="small" />
      ) : (
        <Ionicons name="locate" size={18} color={colors.primary} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={s.buttonText}>
          {mutation.isPending ? "Building your practice set..." : `Practise my ${mistakes} mistake${mistakes === 1 ? "" : "s"}`}
        </Text>
        <Text style={s.buttonHint}>Flashcards, a retry quiz and planner reminders</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.primary} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    marginVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    backgroundColor: colors.primaryLight,
  },
  buttonText: { fontSize: 14.5, fontWeight: "700", color: colors.primaryDark },
  buttonHint: { ...design.caption, marginTop: 1 },
  card: { ...design.card, padding: 14, marginVertical: 8, gap: 6, borderColor: colors.primaryMuted },
  head: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { ...design.cardTitle },
  line: { ...design.body, fontSize: 13.5 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
  },
  linkText: { fontSize: 12.5, fontWeight: "700", color: colors.primary },
});
