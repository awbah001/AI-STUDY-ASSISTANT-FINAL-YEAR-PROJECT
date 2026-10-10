import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { Redirect, useRouter } from "expo-router";
import {
  ACADEMIC_PROFILE_FIELDS,
  academicProfileSchema,
  type AcademicProfile,
} from "../../shared/studentLearning";
import { FIELD_ERROR_COLOR, FieldError } from "../src/components/FieldError";
import { useAuth } from "../src/contexts/AuthContext";
import { trpc } from "../src/lib/api";
import { homeForRole } from "../src/lib/roleHome";
import { colors } from "../src/theme/colors";

export default function OnboardingScreen() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const utils = trpc.useUtils();
  const status = trpc.studentLearning.onboardingStatus.useQuery(undefined, {
    enabled: user?.role === "user",
  });
  const complete = trpc.studentLearning.completeProfileSetup.useMutation();
  const [values, setValues] = useState<AcademicProfile>({
    studentNumber: "",
    faculty: "",
    department: "",
    programme: "",
    academicLevel: "",
    semester: "",
    academicYear: "",
  });
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof AcademicProfile, string>>
  >({});

  useEffect(() => {
    if (!status.data || hydrated) return;
    const profile = status.data.profile;
    setValues(
      Object.fromEntries(
        ACADEMIC_PROFILE_FIELDS.map(({ key }) => [key, profile[key] ?? ""])
      ) as AcademicProfile
    );
    setHydrated(true);
  }, [status.data, hydrated]);

  if (loading)
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== "user")
    return <Redirect href={homeForRole(user.role) as any} />;
  if (status.data?.completed) return <Redirect href="/(tabs)/dashboard" />;
  if (status.isError)
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>Unable to load your profile</Text>
        <Text style={styles.copy}>Check your connection and try again.</Text>
        <Pressable
          style={styles.button}
          onPress={() => status.refetch()}
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

  const save = async () => {
    const result = academicProfileSchema.safeParse(values);
    if (!result.success) {
      const next: Partial<Record<keyof AcademicProfile, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof AcademicProfile;
        if (key && !next[key]) next[key] = issue.message;
      }
      setFieldErrors(next);
      setError("Fix the highlighted fields to continue.");
      return;
    }
    setFieldErrors({});
    setBusy(true);
    setError("");
    try {
      await complete.mutateAsync(result.data);
      await utils.invalidate();
      router.replace("/(tabs)/dashboard");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save your profile. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Complete your student profile</Text>
          <Text style={styles.copy}>
            Enter your academic details to continue to your dashboard. All
            fields are required.
          </Text>
          <View style={styles.card}>
            {ACADEMIC_PROFILE_FIELDS.map(({ key, label, maxLength }) => (
              <View key={key} style={styles.field}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={[
                    styles.input,
                    fieldErrors[key] ? { borderColor: FIELD_ERROR_COLOR } : null,
                  ]}
                  accessibilityLabel={label}
                  value={values[key]}
                  maxLength={maxLength}
                  editable={!busy}
                  autoCorrect={false}
                  autoCapitalize={key === "studentNumber" ? "none" : "words"}
                  onChangeText={value => {
                    setValues(previous => ({ ...previous, [key]: value }));
                    setFieldErrors(previous => ({ ...previous, [key]: undefined }));
                  }}
                />
                <FieldError message={fieldErrors[key]} />
              </View>
            ))}
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
              <Text style={styles.buttonText}>
                {busy ? "Saving..." : "Save and continue"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  button: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: "700" },
  error: { color: colors.error, fontSize: 14 },
});
