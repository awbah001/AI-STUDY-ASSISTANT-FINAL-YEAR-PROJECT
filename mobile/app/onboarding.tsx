import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { Ionicons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import {
  SEMESTERS,
  findProgramme,
  isSemester,
  levelLabel,
  levelsFor,
  parseLevel,
} from "../../shared/academics";
import { academicProfileSchema } from "../../shared/studentLearning";
import { FIELD_ERROR_COLOR, FieldError } from "../src/components/FieldError";
import { useAuth } from "../src/contexts/AuthContext";
import { trpc } from "../src/lib/api";
import { homeForRole } from "../src/lib/roleHome";
import { colors } from "../src/theme/colors";

type TextKey = "faculty" | "department" | "programme";
const TEXT_FIELDS: Array<{ key: TextKey; label: string }> = [
  { key: "faculty", label: "Faculty" },
  { key: "department", label: "Department" },
  { key: "programme", label: "Programme" },
];

export default function OnboardingScreen() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const utils = trpc.useUtils();
  const isStudent = user?.role === "user";
  const status = trpc.studentLearning.onboardingStatus.useQuery(undefined, { enabled: isStudent });
  const catalogue = trpc.academics.catalogue.useQuery(undefined, { enabled: isStudent });
  const complete = trpc.studentLearning.completeProfileSetup.useMutation();

  const [hydrated, setHydrated] = useState(false);
  const [studentNumber, setStudentNumber] = useState("");
  const [facultyId, setFacultyId] = useState(0);
  const [departmentId, setDepartmentId] = useState(0);
  const [programmeId, setProgrammeId] = useState(0);
  const [text, setText] = useState<Record<TextKey, string>>({ faculty: "", department: "", programme: "" });
  const [level, setLevel] = useState("");
  const [semester, setSemester] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [picked, setPicked] = useState<Set<number> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const faculties = catalogue.data?.faculties ?? [];
  const listed = faculties.length > 0;
  const term = catalogue.data?.term;
  const yearOptions = useMemo(() => {
    const options = catalogue.data?.yearOptions ?? [];
    return term && !options.includes(term.academicYear) ? [term.academicYear, ...options] : options;
  }, [catalogue.data?.yearOptions, term]);

  useEffect(() => {
    if (!status.data || !catalogue.data || hydrated) return;
    const profile = status.data.profile;
    const initial = findProgramme(catalogue.data.faculties, profile.programmeId);
    setStudentNumber(profile.studentNumber ?? "");
    setFacultyId(initial?.faculty.id ?? 0);
    setDepartmentId(initial?.department.id ?? 0);
    setProgrammeId(initial?.programme.id ?? 0);
    setText({ faculty: profile.faculty ?? "", department: profile.department ?? "", programme: profile.programme ?? "" });
    setLevel(profile.academicLevel ?? "");
    setSemester(isSemester(profile.semester) ? profile.semester : catalogue.data.term.semester);
    setAcademicYear(
      profile.academicYear && catalogue.data.yearOptions.includes(profile.academicYear)
        ? profile.academicYear
        : catalogue.data.term.academicYear
    );
    setHydrated(true);
  }, [status.data, catalogue.data, hydrated]);

  const faculty = faculties.find(f => f.id === facultyId);
  const department = faculty?.departments.find(d => d.id === departmentId);
  const programme = department?.programmes.find(p => p.id === programmeId);
  const levelNumber = parseLevel(level);
  const ready = listed && Boolean(programme) && Boolean(levelNumber) && isSemester(semester);
  const suggestions = trpc.academics.suggestedCourses.useQuery(
    { programmeId, level: levelNumber ?? 1, semester: isSemester(semester) ? semester : "First" },
    { enabled: ready }
  );
  const suggested = useMemo(() => (ready ? suggestions.data ?? [] : []), [ready, suggestions.data]);
  useEffect(() => setPicked(null), [programmeId, level, semester]);
  const chosen = picked ?? new Set(suggested.map(c => c.id));

  if (loading)
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== "user") return <Redirect href={homeForRole(user.role) as any} />;
  if (status.data?.completed) return <Redirect href="/(tabs)/dashboard" />;
  if (status.isError || catalogue.isError)
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>Unable to load your profile</Text>
        <Text style={styles.copy}>Check your connection and try again.</Text>
        <Pressable
          style={styles.button}
          onPress={() => {
            void status.refetch();
            void catalogue.refetch();
          }}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  if (!hydrated)
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );

  const busy = complete.isPending;
  const clear = (key: string) => setErrors(({ [key]: _, ...rest }) => rest);
  const pickProgramme = (next: { facultyId?: number; departmentId?: number; programmeId?: number }) => {
    if (next.facultyId !== undefined) {
      setFacultyId(next.facultyId);
      setDepartmentId(0);
      setProgrammeId(0);
    }
    if (next.departmentId !== undefined) {
      setDepartmentId(next.departmentId);
      setProgrammeId(0);
    }
    if (next.programmeId !== undefined) setProgrammeId(next.programmeId);
    const durationYears = faculties
      .flatMap(f => f.departments)
      .flatMap(d => d.programmes)
      .find(p => p.id === next.programmeId)?.durationYears;
    if (!durationYears || !levelsFor(durationYears).includes(levelNumber ?? 0)) setLevel("");
    clear("programmeId");
  };

  const save = async () => {
    const payload = {
      studentNumber,
      ...(listed ? { programmeId: programmeId || undefined } : text),
      academicLevel: level,
      semester,
      academicYear,
      courseIds: [...chosen],
    };
    const result = academicProfileSchema.safeParse(payload);
    const next: Record<string, string> = {};
    if (listed && !programmeId) next.programmeId = "Choose your programme.";
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !next[key]) next[key] = issue.message;
      }
    }
    setErrors(next);
    if (!result.success || Object.keys(next).length) {
      setError("Fix the highlighted fields to continue.");
      return;
    }
    setError("");
    try {
      const saved = await complete.mutateAsync(result.data);
      await utils.invalidate();
      if (saved.enrolled.length) {
        Alert.alert("Profile saved", `Enrolled in ${saved.enrolled.length} course${saved.enrolled.length === 1 ? "" : "s"}.`);
      }
      router.replace("/(tabs)/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile. Please try again.");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Complete your student profile</Text>
          <Text style={styles.copy}>Choose your programme and current term to continue to your dashboard.</Text>
          <View style={styles.card}>
            <Field label="Student ID" error={errors.studentNumber}>
              <TextInput
                style={[styles.input, errors.studentNumber ? { borderColor: FIELD_ERROR_COLOR } : null]}
                accessibilityLabel="Student ID"
                value={studentNumber}
                maxLength={80}
                editable={!busy}
                autoCorrect={false}
                autoCapitalize="none"
                onChangeText={value => {
                  setStudentNumber(value);
                  clear("studentNumber");
                }}
              />
            </Field>

            {listed ? (
              <>
                <Field label="Faculty">
                  <Choices
                    options={faculties.map(f => ({ value: f.id, label: f.name }))}
                    value={facultyId}
                    disabled={busy}
                    onChange={id => pickProgramme({ facultyId: id })}
                  />
                </Field>
                {faculty ? (
                  <Field label="Department">
                    <Choices
                      options={faculty.departments.map(d => ({ value: d.id, label: d.name }))}
                      value={departmentId}
                      disabled={busy}
                      onChange={id => pickProgramme({ departmentId: id })}
                    />
                  </Field>
                ) : null}
                {department ? (
                  <Field label="Programme" error={errors.programmeId}>
                    <Choices
                      options={department.programmes.map(p => ({ value: p.id, label: p.name }))}
                      value={programmeId}
                      disabled={busy}
                      onChange={id => pickProgramme({ programmeId: id })}
                    />
                  </Field>
                ) : (
                  <FieldError message={errors.programmeId} />
                )}
                {programme ? (
                  <Field label="Year" error={errors.academicLevel}>
                    <Choices
                      options={levelsFor(programme.durationYears).map(l => ({ value: l, label: levelLabel(l) }))}
                      value={levelNumber ?? 0}
                      disabled={busy}
                      onChange={l => {
                        setLevel(String(l));
                        clear("academicLevel");
                      }}
                    />
                  </Field>
                ) : null}
              </>
            ) : (
              <>
                {TEXT_FIELDS.map(({ key, label }) => (
                  <Field key={key} label={label} error={errors[key]}>
                    <TextInput
                      style={[styles.input, errors[key] ? { borderColor: FIELD_ERROR_COLOR } : null]}
                      accessibilityLabel={label}
                      value={text[key]}
                      maxLength={120}
                      editable={!busy}
                      autoCapitalize="words"
                      onChangeText={value => {
                        setText(t => ({ ...t, [key]: value }));
                        clear(key);
                      }}
                    />
                  </Field>
                ))}
                <Field label="Year" error={errors.academicLevel}>
                  <TextInput
                    style={[styles.input, errors.academicLevel ? { borderColor: FIELD_ERROR_COLOR } : null]}
                    accessibilityLabel="Year"
                    placeholder="e.g. 300"
                    placeholderTextColor={colors.textLight}
                    value={level}
                    maxLength={80}
                    editable={!busy}
                    keyboardType="number-pad"
                    onChangeText={value => {
                      setLevel(value);
                      clear("academicLevel");
                    }}
                  />
                </Field>
              </>
            )}

            <Field label="Semester" error={errors.semester}>
              <Choices
                options={SEMESTERS.map(s => ({ value: s, label: `${s} semester` }))}
                value={semester}
                disabled={busy}
                onChange={setSemester}
              />
            </Field>
            <Field label="Academic year" error={errors.academicYear}>
              <Choices
                options={yearOptions.map(y => ({ value: y, label: y }))}
                value={academicYear}
                disabled={busy}
                onChange={setAcademicYear}
              />
            </Field>

            {ready ? (
              <View style={styles.suggestions}>
                <Text style={styles.label}>Courses for your programme</Text>
                {suggestions.isLoading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : suggested.length ? (
                  <>
                    <Text style={styles.hint}>
                      These match {levelLabel(levelNumber)}, {semester} semester. Untick any you don't take; you can
                      join others later with a course code.
                    </Text>
                    {suggested.map(course => {
                      const on = chosen.has(course.id);
                      return (
                        <Pressable
                          key={course.id}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on, disabled: busy }}
                          disabled={busy}
                          style={styles.courseRow}
                          onPress={() => {
                            const next = new Set(chosen);
                            if (on) next.delete(course.id);
                            else next.add(course.id);
                            setPicked(next);
                          }}
                        >
                          <Ionicons
                            name={on ? "checkbox" : "square-outline"}
                            size={20}
                            color={on ? colors.primary : colors.textLight}
                          />
                          <Text style={styles.courseText} numberOfLines={2}>
                            <Text style={{ fontWeight: "700" }}>{course.code}</Text> {course.title}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </>
                ) : (
                  <Text style={styles.hint}>
                    No courses are listed for this programme and year yet. You can join courses later with a course
                    code.
                  </Text>
                )}
              </View>
            ) : null}

            {listed ? (
              <Text style={styles.hint}>
                Your programme and year can only be changed by an administrator after you save, so check them
                carefully.
              </Text>
            ) : null}
            {!!error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              style={[styles.button, busy && { opacity: 0.6 }]}
              onPress={save}
            >
              <Text style={styles.buttonText}>{busy ? "Saving..." : "Save and continue"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      <FieldError message={error} />
    </View>
  );
}

function Choices<T extends string | number>({
  options,
  value,
  disabled,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.choices}>
      {options.map(option => {
        const active = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={[styles.choice, active && styles.choiceActive]}
          >
            <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    gap: 16,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 24,
    gap: 16,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  title: { fontSize: 28, fontWeight: "700", color: colors.text },
  copy: { fontSize: 16, lineHeight: 24, color: colors.textSub },
  card: {
    padding: 20,
    gap: 18,
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  field: { gap: 8 },
  label: { fontSize: 15, fontWeight: "600", color: colors.text },
  hint: { fontSize: 13, lineHeight: 19, color: colors.textSub },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.bgInput,
  },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.bgInput,
  },
  choiceActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  choiceText: { fontSize: 14, color: colors.text },
  choiceTextActive: { color: colors.white, fontWeight: "600" },
  suggestions: {
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  courseRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  courseText: { flex: 1, fontSize: 14, color: colors.text },
  button: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: "700" },
  error: { color: colors.error, fontSize: 14 },
});
