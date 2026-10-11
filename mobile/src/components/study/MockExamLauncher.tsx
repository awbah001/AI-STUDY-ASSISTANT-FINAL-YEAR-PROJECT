import { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { trpc } from "../../lib/api";
import { friendlyError } from "../../lib/friendlyError";
import { colors } from "../../theme/colors";
import { design, radius } from "../../theme/design";
import { EXAM_MINUTE_CHOICES, EXAM_QUESTION_CHOICES } from "../../../../shared/studentFeatures";

function Choices<T extends number>({
  label,
  value,
  options,
  unit,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  unit: string;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <View style={s.chips} accessibilityRole="radiogroup">
        {options.map((option) => {
          const active = option === value;
          return (
            <TouchableOpacity
              key={option}
              style={[s.chip, active && s.chipActive]}
              onPress={() => onChange(option)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>
                {option} {unit}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/** Timed exam written from the course's materials, plus recent attempts. */
export function MockExamLauncher({ courseId }: { courseId: number }) {
  const router = useRouter();
  const [questions, setQuestions] = useState<number>(EXAM_QUESTION_CHOICES[1]);
  const [minutes, setMinutes] = useState<number>(EXAM_MINUTE_CHOICES[1]);
  const history = trpc.exams.list.useQuery({ courseId });
  const create = trpc.exams.create.useMutation({
    onSuccess: ({ id }) => {
      void history.refetch();
      router.push({ pathname: "/mock-exam/[id]", params: { id } });
    },
    onError: (error) => Alert.alert("Couldn't start the exam", friendlyError(error.message, "Please try again.")),
  });

  return (
    <View style={s.card}>
      <View style={s.head}>
        <View style={s.icon}>
          <Ionicons name="school" size={20} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Mock exam</Text>
          <Text style={s.caption}>Timed questions from all course materials, marked when you hand in.</Text>
        </View>
      </View>
      <Choices label="Questions" value={questions} options={EXAM_QUESTION_CHOICES} unit="Qs" onChange={setQuestions} />
      <Choices label="Time limit" value={minutes} options={EXAM_MINUTE_CHOICES} unit="min" onChange={setMinutes} />
      <TouchableOpacity
        style={[s.start, create.isPending && { opacity: 0.75 }]}
        disabled={create.isPending}
        activeOpacity={0.85}
        onPress={() => create.mutate({ courseId, questionCount: questions, durationMinutes: minutes })}
      >
        {create.isPending ? <ActivityIndicator color={colors.white} /> : <Ionicons name="timer-outline" size={18} color={colors.white} />}
        <Text style={s.startText}>{create.isPending ? "Writing your exam..." : "Start mock exam"}</Text>
      </TouchableOpacity>
      {create.isPending ? <Text style={s.caption}>This can take up to a minute while questions are written from your notes.</Text> : null}

      {history.data?.length ? (
        <View style={{ gap: 8, marginTop: 4 }}>
          <Text style={s.label}>Previous attempts</Text>
          {history.data.slice(0, 4).map((exam) => (
            <TouchableOpacity
              key={exam.id}
              style={s.attempt}
              onPress={() => router.push({ pathname: "/mock-exam/[id]", params: { id: exam.id } })}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.attemptTitle}>
                  {new Date(exam.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {exam.questionCount} Qs ·{" "}
                  {exam.durationMinutes} min
                </Text>
                <Text style={s.caption}>
                  {exam.status === "submitted" ? "Marked" : exam.timedOut ? "Time up, tap to see result" : "In progress, tap to continue"}
                </Text>
              </View>
              {exam.status === "submitted" ? (
                <Text style={[s.score, (exam.scorePercent ?? 0) < 50 && { color: colors.error }]}>
                  {Math.round(exam.scorePercent ?? 0)}%
                </Text>
              ) : (
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { ...design.card, padding: 16, gap: 14, marginBottom: 16 },
  head: { flexDirection: "row", gap: 12, alignItems: "center" },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...design.cardTitle, fontSize: 16 },
  caption: { ...design.caption },
  label: { fontSize: 12, fontWeight: "700", color: colors.textSub, letterSpacing: 0.3 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { ...design.chip, minHeight: 34, paddingVertical: 6 },
  chipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.textSub },
  chipTextActive: { color: colors.white, fontWeight: "700" },
  start: { ...design.action, flexDirection: "row", gap: 8 },
  startText: { ...design.actionText },
  attempt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  attemptTitle: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  score: { fontSize: 16, fontWeight: "800", color: colors.primary },
});
