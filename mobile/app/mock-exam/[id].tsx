import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { trpc, type AppRouter } from "../../src/lib/api";
import type { inferRouterOutputs } from "@trpc/server";
import { friendlyError } from "../../src/lib/friendlyError";
import { colors, gradients } from "../../src/theme/colors";
import { design, radius } from "../../src/theme/design";
import { GreenAppBar, HEADER_GREEN } from "../../src/components/GreenAppBar";
import { ProgressBar } from "../../src/components/ui/Kit";
import { PracticeMistakes } from "../../src/components/study/PracticeMistakes";
import { EXAM_ANSWER_MAX, formatCountdown, scoreBand, topicBreakdown } from "../../../shared/studentFeatures";

type Exam = inferRouterOutputs<AppRouter>["exams"]["get"];

export default function MockExamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const examId = Number(id);
  const query = trpc.exams.get.useQuery({ examId }, { enabled: examId > 0 });

  if (query.isLoading) {
    return (
      <View style={st.root}>
        <GreenAppBar title="Mock exam" onBack={() => router.back()} />
        <View style={[st.sheet, st.center]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }
  if (!query.data) {
    return (
      <View style={st.root}>
        <GreenAppBar title="Mock exam" onBack={() => router.back()} />
        <View style={[st.sheet, st.center]}>
          <Text style={design.body}>{friendlyError(query.error?.message, "This exam could not be loaded.")}</Text>
          <TouchableOpacity style={[st.primaryBtn, { marginTop: 16, paddingHorizontal: 24 }]} onPress={() => query.refetch()}>
            <Text style={st.primaryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  return query.data.status === "submitted" ? <Results exam={query.data} /> : <Sitting exam={query.data} />;
}

function Sitting({ exam }: { exam: Exam }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(exam.questions.map((q) => [String(q.id), q.userAnswer ?? ""]))
  );
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const endsAt = useMemo(() => Date.now() + exam.remainingSeconds * 1000, [exam.id]);
  const [remaining, setRemaining] = useState(exam.remainingSeconds);
  const dirty = useRef(false);
  const handedIn = useRef(false);
  const save = trpc.exams.saveAnswers.useMutation();
  const submit = trpc.exams.submit.useMutation({
    onSuccess: (result) => {
      utils.exams.get.setData({ examId: exam.id }, result);
      void utils.exams.list.invalidate();
      void utils.progress.invalidate();
      void utils.studentLearning.dashboard.invalidate();
    },
    onError: (error) => {
      handedIn.current = false;
      Alert.alert("Couldn't hand in", friendlyError(error.message, "Check your connection and try again."));
    },
  });

  const flush = () => {
    if (!dirty.current || handedIn.current) return;
    dirty.current = false;
    save.mutate({ examId: exam.id, answers: answersRef.current });
  };
  const handIn = () => {
    if (handedIn.current) return;
    handedIn.current = true;
    submit.mutate({ examId: exam.id, answers: answersRef.current });
  };

  useEffect(() => {
    const tick = setInterval(() => setRemaining(Math.max(0, Math.round((endsAt - Date.now()) / 1000))), 1000);
    return () => clearInterval(tick);
  }, [endsAt]);

  useEffect(() => {
    if (remaining > 0) return;
    if (!handedIn.current) Alert.alert("Time is up", "Your exam has been handed in for marking.");
    handIn();
  }, [remaining]);

  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(flush, 2500);
    return () => clearTimeout(timer);
  }, [answers]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") flush();
    });
    return () => sub.remove();
  }, []);

  const leave = () => {
    Alert.alert("Leave the exam?", "Your answers are saved, but the timer keeps running.", [
      { text: "Stay", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () => {
          flush();
          router.back();
        },
      },
    ]);
    return true;
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", leave);
    return () => sub.remove();
  }, []);

  const setAnswer = (questionId: number, value: string) => {
    dirty.current = true;
    setAnswers((prev) => ({ ...prev, [String(questionId)]: value.slice(0, EXAM_ANSWER_MAX) }));
  };
  const answered = exam.questions.filter((q) => answers[String(q.id)]?.trim()).length;
  const lowTime = remaining <= 60;
  const confirmHandIn = () => {
    const missing = exam.questions.length - answered;
    if (!missing) return handIn();
    Alert.alert(
      "Hand in now?",
      `You have ${missing} unanswered question${missing === 1 ? "" : "s"}.`,
      [
        { text: "Keep working", style: "cancel" },
        { text: "Hand in", onPress: handIn },
      ]
    );
  };

  return (
    <View style={st.root}>
      <GreenAppBar
        title={exam.courseTitle}
        onBack={leave}
        right={
          <View style={[st.timer, lowTime && st.timerLow]} accessibilityLabel={`Time remaining ${formatCountdown(remaining)}`}>
            <Ionicons name="time-outline" size={14} color={lowTime ? "#fecaca" : colors.white} />
            <Text style={[st.timerText, lowTime && { color: "#fecaca" }]}>{formatCountdown(remaining)}</Text>
          </View>
        }
      >
        <Text style={st.heroMeta}>
          {answered}/{exam.questions.length} answered{save.isPending ? " · Saving..." : save.data?.saved ? " · Saved" : ""}
        </Text>
        <View style={{ marginTop: 8 }}>
          <ProgressBar
            value={(answered / Math.max(1, exam.questions.length)) * 100}
            color={colors.accent}
            track="rgba(255,255,255,0.16)"
          />
        </View>
      </GreenAppBar>
      <KeyboardAvoidingView style={st.sheet} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
          {exam.questions.map((q, index) => (
            <View key={q.id} style={st.qCard}>
              <View style={st.qHead}>
                <Text style={st.qNumber}>Question {index + 1}</Text>
                <Text style={st.marks}>
                  {q.marks} mark{q.marks === 1 ? "" : "s"}
                </Text>
              </View>
              <Text style={st.qText}>{q.question}</Text>
              {q.type === "mcq" ? (
                q.options.map((option, i) => {
                  const checked = answers[String(q.id)] === option;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[st.option, checked && st.optionOn]}
                      onPress={() => setAnswer(q.id, option)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked }}
                    >
                      <View style={[st.dot, checked && st.dotOn]}>
                        {checked ? <Ionicons name="checkmark" size={12} color={colors.white} /> : null}
                      </View>
                      <Text style={[st.optionText, checked && { color: colors.primaryDark, fontWeight: "600" }]}>{option}</Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <>
                  <TextInput
                    style={st.input}
                    multiline
                    placeholder="Write your answer in a few sentences."
                    placeholderTextColor={colors.textPlaceholder}
                    value={answers[String(q.id)] ?? ""}
                    maxLength={EXAM_ANSWER_MAX}
                    onChangeText={(text) => setAnswer(q.id, text)}
                    onBlur={flush}
                    textAlignVertical="top"
                    accessibilityLabel={`Answer to question ${index + 1}`}
                  />
                  <Text style={st.counter}>
                    {(answers[String(q.id)] ?? "").length}/{EXAM_ANSWER_MAX}
                  </Text>
                </>
              )}
            </View>
          ))}
          <View style={{ height: 90 }} />
        </ScrollView>
        <View style={[st.footer, { paddingBottom: Math.max(insets.bottom, 12) + 6 }]}>
          <TouchableOpacity style={[st.primaryBtn, submit.isPending && { opacity: 0.75 }]} disabled={submit.isPending} onPress={confirmHandIn}>
            {submit.isPending ? <ActivityIndicator color={colors.white} /> : <Ionicons name="send" size={16} color={colors.white} />}
            <Text style={st.primaryText}>{submit.isPending ? "Marking your answers..." : "Hand in exam"}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Results({ exam }: { exam: Exam }) {
  const router = useRouter();
  const percent = exam.scorePercent ?? 0;
  const band = scoreBand(percent);
  const topics = topicBreakdown(exam.questions);
  const mistakes = exam.questions.filter((q) => (q.awardedMarks ?? 0) < q.marks).length;

  return (
    <View style={st.root}>
      <GreenAppBar title="Exam results" onBack={() => router.back()} />
      <View style={st.sheet}>
        <ScrollView contentContainerStyle={st.content}>
          <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.scoreCard}>
            <Text style={st.scoreValue}>{Math.round(percent)}%</Text>
            <Text style={st.scoreLabel}>
              {band.label} · {exam.earnedMarks ?? 0}/{exam.totalMarks ?? 0} marks
            </Text>
            <Text style={st.scoreSub}>{exam.title}</Text>
          </LinearGradient>

          {exam.practiceCreatedAt ? (
            <Text style={[design.caption, { marginBottom: 8 }]}>Your practice set from this exam is in your flashcards and planner.</Text>
          ) : (
            <PracticeMistakes source={{ kind: "exam", examId: exam.id }} mistakes={mistakes} />
          )}

          {topics.length > 1 ? (
            <View style={st.qCard}>
              <Text style={st.sectionTitle}>By topic</Text>
              {topics.map((t) => (
                <View key={t.topic} style={{ gap: 4, marginTop: 8 }}>
                  <View style={st.qHead}>
                    <Text style={st.topicName} numberOfLines={1}>
                      {t.topic}
                    </Text>
                    <Text style={design.caption}>
                      {t.earned}/{t.total}
                    </Text>
                  </View>
                  <ProgressBar
                    value={Math.max(4, t.percent)}
                    color={t.percent >= 70 ? colors.success : t.percent >= 50 ? colors.warning : colors.error}
                    track={colors.surfaceAlt}
                  />
                </View>
              ))}
            </View>
          ) : null}

          <Text style={[st.sectionTitle, { marginVertical: 10 }]}>Answer review</Text>
          {exam.questions.map((q, index) => {
            const full = (q.awardedMarks ?? 0) >= q.marks;
            const none = (q.awardedMarks ?? 0) === 0;
            const tone = full ? colors.success : none ? colors.error : colors.warning;
            return (
              <View key={q.id} style={[st.qCard, { borderLeftWidth: 4, borderLeftColor: tone }]}>
                <View style={st.qHead}>
                  <Text style={st.qNumber}>Q{index + 1}</Text>
                  <Text style={[st.marks, { color: tone }]}>
                    {q.awardedMarks ?? 0}/{q.marks}
                  </Text>
                </View>
                <Text style={st.qText}>{q.question}</Text>
                <Text style={st.reviewLabel}>Your answer</Text>
                <Text style={st.reviewText}>{q.userAnswer?.trim() || "No answer"}</Text>
                <Text style={st.reviewLabel}>{q.type === "mcq" ? "Correct answer" : "Model answer"}</Text>
                <Text style={[st.reviewText, { color: colors.success }]}>{q.correctAnswer}</Text>
                {q.type === "short" && q.keyPoints.length ? (
                  <>
                    <Text style={st.reviewLabel}>Key points</Text>
                    {q.keyPoints.map((p, i) => (
                      <Text key={i} style={st.reviewText}>
                        • {p}
                      </Text>
                    ))}
                  </>
                ) : null}
                {q.feedback || q.explanation ? (
                  <View style={st.feedback}>
                    <Ionicons name="bulb" size={13} color="#b45309" />
                    <Text style={st.feedbackText}>{q.feedback || q.explanation}</Text>
                  </View>
                ) : null}
                {q.documentTitle ? <Text style={[design.caption, { marginTop: 6 }]}>From {q.documentTitle}</Text> : null}
              </View>
            );
          })}
          <View style={{ height: 30 }} />
        </ScrollView>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: HEADER_GREEN },
  sheet: {
    flex: 1,
    marginTop: -14,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    ...design.page,
  },
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  content: { padding: 20, paddingTop: 22 },
  heroMeta: { color: "#d1fae5", fontSize: 13, fontWeight: "600" },
  timer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  timerLow: { backgroundColor: "rgba(229,72,77,0.35)" },
  timerText: { color: colors.white, fontWeight: "800", fontSize: 13, fontVariant: ["tabular-nums"] },
  qCard: { ...design.card, padding: 16, marginBottom: 12 },
  qHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  qNumber: { ...design.eyebrow, color: colors.primary },
  marks: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  qText: { ...design.cardTitle, marginTop: 8, marginBottom: 10 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    marginBottom: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dotOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { flex: 1, fontSize: 14, color: colors.text },
  input: { ...design.input, minHeight: 120 },
  counter: { ...design.caption, textAlign: "right", marginTop: 4 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: "rgba(245,247,246,0.97)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  primaryBtn: { ...design.action, flexDirection: "row", gap: 8 },
  primaryText: { ...design.actionText },
  scoreCard: { borderRadius: radius.xl, padding: 22, alignItems: "center", marginBottom: 12 },
  scoreValue: { color: colors.white, fontSize: 44, fontWeight: "800", letterSpacing: -1 },
  scoreLabel: { color: "#d1fae5", fontSize: 14, fontWeight: "700", marginTop: 2 },
  scoreSub: { color: "#a7d8c6", fontSize: 12.5, marginTop: 6, textAlign: "center" },
  sectionTitle: { ...design.sectionTitle },
  topicName: { flex: 1, fontSize: 13.5, fontWeight: "600", color: colors.text },
  reviewLabel: { ...design.eyebrow, marginTop: 8 },
  reviewText: { ...design.body, marginTop: 2 },
  feedback: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.warningSoft,
  },
  feedbackText: { flex: 1, fontSize: 13, lineHeight: 19, color: "#78350f" },
});
