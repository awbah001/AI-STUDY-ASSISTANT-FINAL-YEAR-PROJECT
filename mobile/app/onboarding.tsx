import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "../src/lib/api";
import { AuthBotHero } from "../src/components/AuthBotHero";

const bot = require("../assets/cognify-auth-bot.png");

const LEARN_MODES: Array<{ id: string; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: "read", label: "Read explanations", icon: "book-outline" },
  { id: "practice", label: "Practice with questions", icon: "help-circle-outline" },
  { id: "flashcards", label: "Use flashcards", icon: "layers-outline" },
  { id: "ai", label: "Ask the AI tutor", icon: "sparkles-outline" },
  { id: "summarize", label: "Summarize topics", icon: "document-text-outline" },
  { id: "planner", label: "Follow structured sessions", icon: "calendar-outline" },
];

const FOCUS_GOALS: Array<{ id: string; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: "difficult", label: "Understanding difficult topics", icon: "bulb-outline" },
  { id: "exams", label: "Preparing for exams", icon: "school-outline" },
  { id: "assignments", label: "Completing assignments", icon: "clipboard-outline" },
  { id: "revise", label: "Revising course materials", icon: "refresh-outline" },
  { id: "habits", label: "Building consistent study habits", icon: "fitness-outline" },
];

const WELCOME_POINTS: Array<{ label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { label: "Understand your course materials", icon: "document-text-outline" },
  { label: "Ask questions about your courses", icon: "chatbubble-ellipses-outline" },
  { label: "Practice with quizzes", icon: "help-circle-outline" },
  { label: "Create and review flashcards", icon: "layers-outline" },
  { label: "Organize your study sessions", icon: "calendar-outline" },
  { label: "Track your progress", icon: "trending-up-outline" },
];

const AI_PROMPTS: Array<{ label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { label: "Explain database normalization", icon: "sparkles-outline" },
  { label: "Create flashcards from Chapter 3", icon: "layers-outline" },
  { label: "Quiz me on computer networks", icon: "help-circle-outline" },
  { label: "Explain this like I'm a beginner", icon: "happy-outline" },
  { label: "Summarize this document", icon: "reader-outline" },
];

const STEPS = ["welcome", "academic", "courses", "preferences", "ai"] as const;
const STEP_META: Record<(typeof STEPS)[number], { title: string; caption: string }> = {
  welcome: { title: "Welcome", caption: "Meet Cognify" },
  academic: { title: "Profile", caption: "Confirm your details" },
  courses: { title: "Courses", caption: "Your learning scope" },
  preferences: { title: "Preferences", caption: "How you like to learn" },
  ai: { title: "AI Tutor", caption: "Your study companion" },
};

export default function OnboardingScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const status = trpc.studentLearning.onboardingStatus.useQuery();
  const saveAcademic = trpc.studentLearning.saveAcademic.useMutation();
  const confirmCourses = trpc.studentLearning.confirmCourses.useMutation();
  const savePrefs = trpc.studentLearning.savePreferences.useMutation();
  const complete = trpc.studentLearning.completeOnboarding.useMutation();

  const [step, setStep] = useState<(typeof STEPS)[number]>("welcome");
  const [faculty, setFaculty] = useState("");
  const [department, setDepartment] = useState("");
  const [programme, setProgramme] = useState("");
  const [academicLevel, setAcademicLevel] = useState("");
  const [semester, setSemester] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [selectedCourses, setSelectedCourses] = useState<number[]>([]);
  const [learnModes, setLearnModes] = useState<string[]>([]);
  const [focusGoals, setFocusGoals] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const enter = useRef(new Animated.Value(0)).current;

  const enrolled = status.data?.enrolledCourses ?? [];
  const catalog = status.data?.catalog ?? [];
  const firstName = status.data?.studentName?.split(/\s+/)[0] ?? "there";

  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [enter, step]);

  useEffect(() => {
    if (!status.data || hydrated) return;
    if (status.data.completed) {
      router.replace("/(tabs)/dashboard");
      return;
    }
    setFaculty(status.data.profile?.faculty ?? "");
    setDepartment(status.data.profile?.department ?? "");
    setProgramme(status.data.profile?.programme ?? "");
    setAcademicLevel(status.data.profile?.academicLevel ?? "");
    setSemester(status.data.profile?.semester ?? "");
    setAcademicYear(status.data.profile?.academicYear ?? "");
    setLearnModes(status.data.profile?.learnModes ?? []);
    setFocusGoals(status.data.profile?.focusGoals ?? []);
    const enrolledIds = (status.data.enrolledCourses ?? []).map((c) => c.id);
    setSelectedCourses(enrolledIds);
    const next = STEPS.includes(status.data.step as (typeof STEPS)[number])
      ? (status.data.step as (typeof STEPS)[number])
      : "welcome";
    setStep(next === "done" ? "welcome" : next);
    setHydrated(true);
  }, [status.data, hydrated, router]);

  const busy =
    saveAcademic.isPending || confirmCourses.isPending || savePrefs.isPending || complete.isPending;

  const goDashboard = async () => {
    try {
      await complete.mutateAsync();
    } catch (err: any) {
      const alreadyDone = /only available to newly registered/i.test(err?.message ?? "");
      if (!alreadyDone) {
        Alert.alert("Could not continue", err?.message || "Please try again.");
        return;
      }
    }
    await Promise.all([
      utils.studentLearning.onboardingStatus.invalidate(),
      utils.studentLearning.dashboard.invalidate(),
    ]);
    router.replace("/(tabs)/dashboard");
  };

  const toggle = (list: string[], id: string, setter: (v: string[]) => void) => {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const goBack = () => {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]);
  };

  if (status.isLoading || !hydrated) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color="#12a06e" style={{ marginTop: 64 }} />
        <Text style={styles.loadingHint}>Preparing your study space…</Text>
      </SafeAreaView>
    );
  }

  if (status.isError) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.errorWrap}>
          <View style={styles.errorIcon}>
            <Ionicons name="cloud-offline-outline" size={28} color="#12a06e" />
          </View>
          <Text style={styles.pageTitle}>Unable to start onboarding</Text>
          <Text style={styles.pageCopy}>Your account is safe. Check your connection and try again.</Text>
          <PrimaryButton label="Retry" onPress={() => status.refetch()} />
        </View>
      </SafeAreaView>
    );
  }

  const idx = STEPS.indexOf(step);
  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View pointerEvents="none" style={styles.mintGlowTop} />
        <View pointerEvents="none" style={styles.mintGlowBottom} />

        <View style={styles.topBar}>
          {idx > 0 ? (
            <Pressable onPress={goBack} hitSlop={10} style={styles.backBtn} accessibilityLabel="Back">
              <Ionicons name="chevron-back" size={20} color="#07805f" />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          ) : (
            <View style={{ width: 64 }} />
          )}
          <Text style={styles.stepCount}>
            {idx + 1} of {STEPS.length}
          </Text>
          <View style={{ width: 64 }} />
        </View>

        <View style={styles.progressTrack}>
          {STEPS.map((s, i) => (
            <View key={s} style={[styles.progressSeg, i <= idx && styles.progressSegOn]} />
          ))}
        </View>
        <Text style={styles.stepCaption}>{STEP_META[step].caption}</Text>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: enter, transform: [{ translateY }] }}>
            {step === "welcome" && (
              <>
                <AuthBotHero compact />
                <Text style={styles.pageTitle}>Welcome to Cognify, {firstName}</Text>
                <Text style={styles.pageCopy}>Your AI-powered learning companion for course-specific study.</Text>
                <View style={styles.featureGrid}>
                  {WELCOME_POINTS.map((item) => (
                    <View key={item.label} style={styles.featureCard}>
                      <View style={styles.featureIcon}>
                        <Ionicons name={item.icon} size={18} color="#12a06e" />
                      </View>
                      <Text style={styles.featureLabel}>{item.label}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.footnote}>We’ll personalize your Home dashboard as you study.</Text>
                <PrimaryButton
                  label={busy ? "Opening Home…" : "Get started"}
                  icon="arrow-forward"
                  disabled={busy}
                  onPress={goDashboard}
                />
              </>
            )}

            {step === "academic" && (
              <>
                <StepHero icon="school-outline" title="Your academic profile" copy="Confirm what we already know. Leave a field blank if it does not apply." />
                <Field icon="library-outline" value={programme} onChangeText={setProgramme} placeholder="Programme" />
                <Field icon="business-outline" value={department} onChangeText={setDepartment} placeholder="Department" />
                <Field icon="git-branch-outline" value={faculty} onChangeText={setFaculty} placeholder="Faculty" />
                <Field icon="ribbon-outline" value={academicLevel} onChangeText={setAcademicLevel} placeholder="Academic level" />
                <Field icon="albums-outline" value={semester} onChangeText={setSemester} placeholder="Semester" />
                <Field icon="calendar-outline" value={academicYear} onChangeText={setAcademicYear} placeholder="Academic year" />
                <PrimaryButton
                  label={busy ? "Saving…" : "Continue"}
                  icon="arrow-forward"
                  disabled={busy}
                  onPress={async () => {
                    await saveAcademic.mutateAsync({
                      faculty,
                      department,
                      programme,
                      academicLevel,
                      semester,
                      academicYear,
                    });
                    setStep("courses");
                  }}
                />
              </>
            )}

            {step === "courses" && (
              <>
                <StepHero
                  icon="book-outline"
                  title="Your courses"
                  copy={
                    enrolled.length
                      ? "These courses are already assigned to you. Uncheck any you will not study now."
                      : catalog.length
                        ? "Select the courses you are taking this semester."
                        : "No catalog is available yet. Continue and join later with a course code."
                  }
                />
                {(enrolled.length ? enrolled : catalog).length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons name="book-outline" size={28} color="#12a06e" />
                    <Text style={styles.emptyTitle}>No courses yet</Text>
                    <Text style={styles.pageCopy}>Your courses will appear here once they are assigned.</Text>
                  </View>
                ) : (
                  (enrolled.length ? enrolled : catalog).map((course) => {
                    const on = selectedCourses.includes(course.id);
                    return (
                      <Pressable
                        key={course.id}
                        style={[styles.checkRow, on && styles.checkRowOn]}
                        onPress={() =>
                          setSelectedCourses((prev) =>
                            prev.includes(course.id) ? prev.filter((id) => id !== course.id) : [...prev, course.id]
                          )
                        }
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                      >
                        <View style={[styles.rowIcon, on && styles.rowIconOn]}>
                          <Ionicons name="book" size={18} color={on ? "#fff" : "#12a06e"} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.checkTitle}>{course.title}</Text>
                          {course.subject ? <Text style={styles.checkMeta}>{course.subject}</Text> : null}
                        </View>
                        <Ionicons
                          name={on ? "checkmark-circle" : "ellipse-outline"}
                          size={22}
                          color={on ? "#12a06e" : "#c5d4e0"}
                        />
                      </Pressable>
                    );
                  })
                )}
                <PrimaryButton
                  label={busy ? "Saving…" : "Continue"}
                  icon="arrow-forward"
                  disabled={busy}
                  onPress={async () => {
                    await confirmCourses.mutateAsync({ courseIds: selectedCourses });
                    setStep("preferences");
                  }}
                />
              </>
            )}

            {step === "preferences" && (
              <>
                <StepHero icon="options-outline" title="How do you prefer to learn?" copy="Choose as many as you like. These later influence recommendations." />
                <View style={styles.chipWrap}>
                  {LEARN_MODES.map((mode) => {
                    const on = learnModes.includes(mode.id);
                    return (
                      <Pressable
                        key={mode.id}
                        style={[styles.chip, on && styles.chipOn]}
                        onPress={() => toggle(learnModes, mode.id, setLearnModes)}
                      >
                        <Ionicons name={mode.icon} size={16} color={on ? "#fff" : "#12a06e"} />
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{mode.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.sectionLabel}>What are you focusing on?</Text>
                {FOCUS_GOALS.map((goal) => {
                  const on = focusGoals.includes(goal.id);
                  return (
                    <Pressable
                      key={goal.id}
                      style={[styles.checkRow, on && styles.checkRowOn]}
                      onPress={() => toggle(focusGoals, goal.id, setFocusGoals)}
                    >
                      <View style={[styles.rowIcon, on && styles.rowIconOn]}>
                        <Ionicons name={goal.icon} size={18} color={on ? "#fff" : "#12a06e"} />
                      </View>
                      <Text style={styles.checkTitle}>{goal.label}</Text>
                      <Ionicons
                        name={on ? "checkmark-circle" : "ellipse-outline"}
                        size={22}
                        color={on ? "#12a06e" : "#c5d4e0"}
                      />
                    </Pressable>
                  );
                })}
                <PrimaryButton
                  label={busy ? "Saving…" : "Continue"}
                  icon="arrow-forward"
                  disabled={busy}
                  onPress={async () => {
                    await savePrefs.mutateAsync({ learnModes, focusGoals });
                    setStep("ai");
                  }}
                />
              </>
            )}

            {step === "ai" && (
              <>
                <View style={styles.aiHero}>
                  <Image source={bot} style={styles.aiBot} resizeMode="contain" />
                </View>
                <Text style={styles.pageTitle}>Meet your AI learning assistant</Text>
                <Text style={styles.pageCopy}>
                  Ask Cognify about your course materials. Inside a course, answers stay scoped to that course.
                </Text>
                {AI_PROMPTS.map((item) => (
                  <View key={item.label} style={styles.promptRow}>
                    <View style={styles.promptIcon}>
                      <Ionicons name={item.icon} size={16} color="#12a06e" />
                    </View>
                    <Text style={styles.promptText}>“{item.label}”</Text>
                  </View>
                ))}
                <PrimaryButton
                  label={busy ? "Opening…" : "Try AI Tutor"}
                  icon="sparkles"
                  disabled={busy}
                  onPress={async () => {
                    await complete.mutateAsync();
                    await utils.studentLearning.dashboard.invalidate();
                    router.replace("/(tabs)/askai");
                  }}
                />
                <Pressable style={styles.secondary} disabled={busy} onPress={goDashboard} accessibilityRole="button">
                  <Text style={styles.secondaryText}>Skip to dashboard</Text>
                </Pressable>
              </>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StepHero({
  icon,
  title,
  copy,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  copy: string;
}) {
  return (
    <View style={styles.stepHero}>
      <View style={styles.stepHeroIcon}>
        <Ionicons name={icon} size={22} color="#12a06e" />
      </View>
      <Text style={styles.pageTitle}>{title}</Text>
      <Text style={styles.pageCopy}>{copy}</Text>
    </View>
  );
}

function Field(props: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.inputShell}>
      <Ionicons name={props.icon} size={20} color="#5f7890" style={styles.fieldIcon} />
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor="#91a5b8"
        autoCorrect={false}
      />
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.cta, pressed && styles.pressed, disabled && styles.disabled]}
      accessibilityRole="button"
    >
      <Text style={styles.ctaText}>{label}</Text>
      {icon ? <Ionicons name={icon} size={18} color="#fff" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f7fdfb" },
  mintGlowTop: {
    position: "absolute",
    top: -170,
    left: -120,
    height: 330,
    width: 390,
    borderRadius: 220,
    backgroundColor: "#e8faf4",
  },
  mintGlowBottom: {
    position: "absolute",
    bottom: -180,
    right: -140,
    height: 320,
    width: 360,
    borderRadius: 220,
    backgroundColor: "#e4f8f0",
  },
  loadingHint: { textAlign: "center", marginTop: 12, color: "#8aa0b4", fontWeight: "600" },
  errorWrap: { paddingHorizontal: 28, paddingTop: 48, alignItems: "center" },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#e8faf4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  backBtn: { alignItems: "center", flexDirection: "row", gap: 2, minHeight: 44 },
  backText: { color: "#12a06e", fontSize: 14, fontWeight: "600" },
  stepCount: { color: "#8aa0b4", fontSize: 13, fontWeight: "700" },
  progressTrack: { flexDirection: "row", gap: 6, paddingHorizontal: 20, marginTop: 8 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "#e4ebf0" },
  progressSegOn: { backgroundColor: "#12a06e" },
  stepCaption: {
    paddingHorizontal: 20,
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#12a06e",
    letterSpacing: 0.3,
  },
  scroll: { paddingHorizontal: 24, paddingBottom: 36, paddingTop: 8, maxWidth: 480, width: "100%", alignSelf: "center" },
  pageTitle: {
    color: "#143044",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginBottom: 8,
    textAlign: "center",
  },
  pageCopy: { color: "#8aa0b4", fontSize: 14, lineHeight: 21, textAlign: "center", marginBottom: 18 },
  footnote: { color: "#8aa0b4", fontSize: 13, textAlign: "center", marginBottom: 8, marginTop: 4 },
  featureGrid: { gap: 8, marginBottom: 8 },
  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e4ebf0",
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#e8faf4",
    alignItems: "center",
    justifyContent: "center",
  },
  featureLabel: { flex: 1, fontSize: 14, fontWeight: "600", color: "#17354a" },
  stepHero: { alignItems: "center", marginBottom: 8 },
  stepHeroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#e8faf4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  inputShell: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#e4ebf0",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    height: 50,
    marginBottom: 10,
  },
  fieldIcon: { marginLeft: 16 },
  input: { color: "#17354a", flex: 1, fontSize: 15, height: "100%", paddingHorizontal: 12 },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e4ebf0",
    minHeight: 56,
  },
  checkRowOn: { borderColor: "#12a06e", backgroundColor: "#f3fbf7" },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#e8faf4",
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconOn: { backgroundColor: "#12a06e" },
  checkTitle: { fontSize: 15, fontWeight: "700", color: "#143044", flex: 1 },
  checkMeta: { fontSize: 12, color: "#8aa0b4", marginTop: 2 },
  emptyCard: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e4ebf0",
    padding: 24,
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: "#143044", marginTop: 8, marginBottom: 4 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4ebf0",
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  chipOn: { backgroundColor: "#12a06e", borderColor: "#12a06e" },
  chipText: { fontSize: 13, fontWeight: "700", color: "#17354a" },
  chipTextOn: { color: "#fff" },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#143044",
    marginBottom: 10,
  },
  aiHero: { alignItems: "center", height: 160, justifyContent: "center", marginBottom: 4 },
  aiBot: { width: 180, height: 160 },
  promptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e4ebf0",
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  promptIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#e8faf4",
    alignItems: "center",
    justifyContent: "center",
  },
  promptText: { flex: 1, fontSize: 14, color: "#17354a", fontWeight: "600" },
  cta: {
    marginTop: 14,
    backgroundColor: "#12a06e",
    borderRadius: 26,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  pressed: { transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.65 },
  secondary: { marginTop: 8, minHeight: 44, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: "#8aa0b4", fontWeight: "700", fontSize: 14 },
});
