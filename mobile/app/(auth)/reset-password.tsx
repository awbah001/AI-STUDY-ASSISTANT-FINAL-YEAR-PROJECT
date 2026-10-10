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
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { trpc } from "../../src/lib/api";
import { colors, gradients } from "../../src/theme/colors";
import { friendlyError } from "../../src/lib/friendlyError";
import { LIMITS, useFieldErrors, validateNewPassword, validatePasswordConfirm } from "../../src/lib/validation";
import { FieldError, FIELD_ERROR_COLOR } from "../../src/components/FieldError";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const { errors, check, clear } = useFieldErrors<"password" | "confirm">();

  const mutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => setDone(true),
    onError: err =>
      Alert.alert("Reset failed", friendlyError(err.message, "Please try again.")),
  });

  const handleReset = () => {
    if (!token) {
      Alert.alert("Invalid link", "This reset link is incomplete. Request a new one from the sign-in screen.");
      return;
    }
    const ok = check({
      password: validateNewPassword(password),
      confirm: validatePasswordConfirm(password, confirm),
    });
    if (ok) mutation.mutate({ token, newPassword: password });
  };

  if (done) {
    return (
      <SafeAreaView style={[s.container, s.doneWrap]} edges={["top", "bottom"]}>
        <Badge icon="checkmark" />
        <Text style={s.title}>Password updated</Text>
        <Text style={s.sub}>You can now sign in with your new password.</Text>
        <TouchableOpacity
          style={[s.btn, { alignSelf: "stretch" }]}
          onPress={() => router.replace("/(auth)/login")}
          activeOpacity={0.85}
        >
          <Text style={s.btnText}>Sign in</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const longEnough = password.length >= LIMITS.password.min;
  const hasLetterAndNumber = /[A-Za-z]/.test(password) && /\d/.test(password);
  const matches = confirm.length > 0 && password === confirm;

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
          <Badge icon="key-outline" />
          <Text style={s.title}>Set new password</Text>
          <Text style={s.sub}>
            Use at least 8 characters with a mix of letters and numbers.
          </Text>

          <Text style={s.label}>New password</Text>
          <PasswordField
            value={password}
            onChangeText={v => {
              setPassword(v);
              clear("password");
            }}
            placeholder="Min 8 characters"
            visible={showPw}
            onToggle={() => setShowPw(v => !v)}
            error={errors.password}
          />

          <Text style={s.label}>Confirm password</Text>
          <PasswordField
            value={confirm}
            onChangeText={v => {
              setConfirm(v);
              clear("confirm");
            }}
            placeholder="Repeat password"
            visible={showConfirm}
            onToggle={() => setShowConfirm(v => !v)}
            error={errors.confirm}
          />

          <View style={s.checks}>
            <Check ok={longEnough} label="At least 8 characters" />
            <Check ok={hasLetterAndNumber} label="A letter and a number" />
            <Check ok={matches} label="Passwords match" />
          </View>

          <TouchableOpacity
            style={[s.btn, mutation.isPending && s.btnOff]}
            disabled={mutation.isPending}
            onPress={handleReset}
            activeOpacity={0.85}
          >
            {mutation.isPending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={s.btnText}>Update password</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Badge({ icon }: { icon: IconName }) {
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

function PasswordField({
  value,
  onChangeText,
  placeholder,
  visible,
  onToggle,
  error,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  visible: boolean;
  onToggle: () => void;
  error?: string | null;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.fieldGroup}>
      <View style={[s.inputWrap, focused && s.inputFocused, !!error && s.inputError]}>
        <Ionicons
          name="lock-closed-outline"
          size={18}
          color={error ? FIELD_ERROR_COLOR : focused ? colors.primary : colors.textLight}
          style={s.inputIcon}
        />
        <TextInput
          style={s.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textLight}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoComplete="new-password"
          maxLength={LIMITS.password.max}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <TouchableOpacity onPress={onToggle} style={s.eyeBtn}>
          <Ionicons
            name={visible ? "eye-off-outline" : "eye-outline"}
            size={18}
            color={colors.textMuted}
          />
        </TouchableOpacity>
      </View>
      <FieldError message={error} />
    </View>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={s.checkRow}>
      <Ionicons
        name={ok ? "checkmark-circle" : "ellipse-outline"}
        size={16}
        color={ok ? colors.primary : colors.textLight}
      />
      <Text style={[s.checkText, ok && { color: colors.primaryDark }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, ...design.page },
  doneWrap: { justifyContent: "center", alignItems: "center", paddingHorizontal: 28 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 36, paddingBottom: 32 },
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
    ...design.body,
    color: colors.textMuted,
  },
  label: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.textSub,
    marginBottom: 7,
    marginLeft: 2,
  },
  fieldGroup: { marginBottom: 14 },
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
  eyeBtn: { padding: 14 },
  checks: { gap: 8, marginBottom: 20, marginTop: 2, paddingHorizontal: 2 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkText: { fontSize: 13, color: colors.textMuted, fontWeight: "500" },
  btn: { ...design.action, minHeight: 54, borderRadius: 16 },
  btnOff: { opacity: 0.5 },
  btnText: { ...design.actionText },
});
