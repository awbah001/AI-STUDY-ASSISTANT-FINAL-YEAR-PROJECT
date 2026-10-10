import { design } from "../../src/theme/design";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { trpc } from "../../src/lib/api";
import { colors, gradients } from "../../src/theme/colors";
import { friendlyError } from "../../src/lib/friendlyError";
import { LIMITS, validateEmail } from "../../src/lib/validation";
import { FieldError, FIELD_ERROR_COLOR } from "../../src/components/FieldError";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  const mutation = trpc.auth.forgotPassword.useMutation({
    onSuccess: data => {
      setSent(true);
      // In development the server returns the token directly — show it so
      // you can test the flow without an email server
      if ((data as any).token) setDevToken((data as any).token);
    },
    onError: err =>
      Alert.alert("Something went wrong", friendlyError(err.message, "Please try again.")),
  });

  const back = (
    <TouchableOpacity
      style={s.backBtn}
      onPress={() => router.back()}
      accessibilityLabel="Back to sign in"
    >
      <Ionicons name="chevron-back" size={20} color={colors.text} />
    </TouchableOpacity>
  );

  if (sent) {
    return (
      <SafeAreaView style={s.container} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={s.scroll}>
          {back}
          <Badge icon="mail-open-outline" />
          <Text style={s.title}>Check your email</Text>
          <Text style={s.sub}>
            If an account exists for{" "}
            <Text style={s.subStrong}>{email}</Text>, a password reset link
            has been sent.
          </Text>

          <View style={s.tipCard}>
            <Ionicons name="time-outline" size={16} color={colors.primary} />
            <Text style={s.tipText}>
              The link may take a minute to arrive. Check your spam folder too.
            </Text>
          </View>

          {/* Dev convenience: show the reset token directly */}
          {devToken && (
            <View style={s.devBox}>
              <View style={s.devHead}>
                <Ionicons name="construct-outline" size={14} color="#92400e" />
                <Text style={s.devLabel}>Dev mode — reset token</Text>
              </View>
              <Text style={s.devToken} selectable>
                {devToken}
              </Text>
              <TouchableOpacity
                style={s.devBtn}
                onPress={() =>
                  router.push({
                    pathname: "/(auth)/reset-password",
                    params: { token: devToken },
                  })
                }
              >
                <Text style={s.devBtnText}>Open reset screen</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.white} />
              </TouchableOpacity>
            </View>
          )}

          <PrimaryButton
            label="Back to sign in"
            onPress={() => router.replace("/(auth)/login")}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const disabled = mutation.isPending;
  const submit = () => {
    const error = validateEmail(email);
    setEmailError(error);
    if (!error) mutation.mutate({ email: email.trim() });
  };

  return (
    <SafeAreaView style={s.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {back}
          <Badge icon="lock-open-outline" />
          <Text style={s.title}>Forgot password?</Text>
          <Text style={s.sub}>
            Enter your email and we'll send you a reset link.
          </Text>

          <Text style={s.label}>Email address</Text>
          <View style={s.fieldGroup}>
            <View style={[s.inputWrap, focused && s.inputFocused, !!emailError && s.inputError]}>
              <Ionicons
                name="mail-outline"
                size={18}
                color={emailError ? FIELD_ERROR_COLOR : focused ? colors.primary : colors.textLight}
                style={s.inputIcon}
              />
              <TextInput
                style={s.input}
                value={email}
                onChangeText={value => {
                  setEmail(value);
                  setEmailError(null);
                }}
                placeholder="name@central.edu.sl"
                placeholderTextColor={colors.textLight}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                maxLength={LIMITS.email}
                returnKeyType="send"
                onSubmitEditing={submit}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
              />
            </View>
            <FieldError message={emailError} />
          </View>

          <PrimaryButton
            label="Send reset link"
            icon="paper-plane-outline"
            disabled={disabled}
            pending={mutation.isPending}
            onPress={submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Badge({ icon }: { icon: React.ComponentProps<typeof Ionicons>["name"] }) {
  return (
    <View style={s.badgeHalo}>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.badge}
      >
        <Ionicons name={icon} size={30} color={colors.white} />
      </LinearGradient>
    </View>
  );
}

function PrimaryButton({
  label,
  icon,
  onPress,
  disabled,
  pending,
}: {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  disabled?: boolean;
  pending?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[s.btn, disabled && s.btnOff]}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {pending ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <View style={s.btnRow}>
          <Text style={s.btnText}>{label}</Text>
          {icon ? <Ionicons name={icon} size={17} color={colors.white} /> : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, ...design.page },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32 },
  backBtn: { ...design.iconButton, borderRadius: 22, marginBottom: 28 },
  badgeHalo: {
    alignSelf: "center",
    padding: 8,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    marginBottom: 22,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { textAlign: "center", marginBottom: 8, ...design.screenTitle },
  sub: {
    textAlign: "center",
    marginBottom: 28,
    paddingHorizontal: 12,
    ...design.body,
    color: colors.textMuted,
  },
  subStrong: { fontWeight: "700", color: colors.text },
  label: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.textSub,
    marginBottom: 7,
    marginLeft: 2,
  },
  fieldGroup: { marginBottom: 18 },
  inputError: { borderColor: FIELD_ERROR_COLOR },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  inputFocused: { borderColor: colors.primary },
  inputIcon: { marginLeft: 15 },
  input: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 11,
    fontSize: 15,
    color: colors.text,
  },
  btn: { ...design.action, minHeight: 54, borderRadius: 16 },
  btnRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  btnOff: { opacity: 0.5 },
  btnText: { ...design.actionText },
  tipCard: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    marginBottom: 20,
  },
  tipText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.primaryDark },
  devBox: {
    backgroundColor: "#fffbeb",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#fde68a",
    gap: 10,
  },
  devHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  devLabel: { fontSize: 12, fontWeight: "700", color: "#92400e" },
  devToken: {
    fontSize: 11,
    color: "#78350f",
    fontFamily: "monospace",
    backgroundColor: "#fef3c7",
    padding: 10,
    borderRadius: 10,
  },
  devBtn: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#d97706",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  devBtnText: { fontSize: 13, fontWeight: "700", color: colors.white },
});
