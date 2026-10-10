import { useEffect, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { trpc } from "../../src/lib/api";
import { useGoogleSignIn } from "../../src/lib/useGoogleSignIn";
import { GoogleButton } from "../../src/components/GoogleButton";
import { AuthBotHero } from "../../src/components/AuthBotHero";
import { homeForRole } from "../../src/lib/roleHome";
import { friendlyError, isNetworkError } from "../../src/lib/friendlyError";
import { ALLOWED_EMAIL_DOMAIN } from "../../src/lib/emailDomain";
import { LIMITS, useFieldErrors, validateEmail, validateLoginPassword, validateTotpCode } from "../../src/lib/validation";
import { FieldError, FIELD_ERROR_COLOR } from "../../src/components/FieldError";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const { errors, check, clear } = useFieldErrors<"email" | "password" | "totp">();
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 560, useNativeDriver: true }).start();
  }, [enter]);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      setNeedsTotp(false);
      setTotpCode("");
      await login(data.token, data.user as any);
      router.replace(homeForRole(data.user.role) as any);
    },
    onError: (err) => {
      const message = err.message ?? "";
      if (err.data?.code === "PRECONDITION_FAILED" && /two-factor/i.test(message)) {
        setNeedsTotp(true);
        return;
      }
      Alert.alert(
        isNetworkError(message) ? "Connection error" : "Sign in failed",
        friendlyError(message, "Invalid email or password.")
      );
    },
  });

  const googleMutation = trpc.auth.google.useMutation({
    onSuccess: async (data) => {
      await login(data.token, data.user as any);
      router.replace(homeForRole(data.user.role) as any);
    },
    onError: (err) => Alert.alert("Google sign-in failed", friendlyError(err.message, "Please try again.")),
  });

  const onGoogleToken = useCallback(
    (idToken: string) => {
      googleMutation.mutate({ idToken, client: "mobile" });
    },
    [googleMutation]
  );
  const google = useGoogleSignIn(onGoogleToken);

  const handleLogin = () => {
    const ok = check({
      email: validateEmail(email),
      password: validateLoginPassword(password),
      totp: needsTotp ? validateTotpCode(totpCode) : null,
    });
    if (!ok) return;
    loginMutation.mutate({
      email: email.trim(),
      password,
      ...(needsTotp ? { totpCode: totpCode.replace(/\s+/g, "") } : {}),
    });
  };

  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View pointerEvents="none" style={styles.mintGlowTop} />
          <View pointerEvents="none" style={styles.mintGlowBottom} />
          <Animated.View style={[styles.content, { opacity: enter, transform: [{ translateY }] }]}>
            <AuthBotHero />

            <View style={styles.welcomeBlock}>
              <Text style={styles.welcomeTitle}>
                Welcome <Text style={styles.welcomeAccent}>back</Text>
              </Text>
              <Text style={styles.welcomeCopy}>Sign in to continue your learning journey</Text>
            </View>

            <View style={styles.form}>
              <Field
                label="Email"
                icon="mail-outline"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setNeedsTotp(false);
                  clear("email");
                }}
                placeholder={`name@${ALLOWED_EMAIL_DOMAIN}`}
                keyboardType="email-address"
                autoComplete="email"
                maxLength={LIMITS.email}
                error={errors.email}
              />
              <Field
                label="Password"
                icon="lock-closed-outline"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  clear("password");
                }}
                placeholder="Enter your password"
                secureTextEntry={!showPassword}
                autoComplete="password"
                maxLength={LIMITS.password.max}
                error={errors.password}
                action={() => setShowPassword((current) => !current)}
                actionIcon={showPassword ? "eye-off-outline" : "eye-outline"}
              />
              <Pressable onPress={() => router.push("/(auth)/forgot-password")} hitSlop={10} style={styles.forgotButton}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
              {needsTotp && (
                <View style={styles.totpBox}>
                  <View style={styles.totpHintRow}>
                    <Ionicons name="shield-checkmark" size={16} color="#12a06e" />
                    <Text style={styles.totpHint}>Enter the code from your authenticator app.</Text>
                  </View>
                  <Field
                    icon="keypad-outline"
                    value={totpCode}
                    onChangeText={(value) => {
                      setTotpCode(value);
                      clear("totp");
                    }}
                    placeholder="6-digit code"
                    autoComplete="one-time-code"
                    maxLength={64}
                    error={errors.totp}
                  />
                </View>
              )}

              <Pressable onPress={handleLogin} disabled={loginMutation.isPending || googleMutation.isPending} style={({ pressed }) => [styles.signInButton, pressed && styles.pressed, loginMutation.isPending && styles.disabled]}>
                <LinearGradient colors={["#16b47c", "#0e9a7a", "#0f8a8f"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.signInGradient}>
                  {loginMutation.isPending ? <ActivityIndicator color="#fff" /> : <><Text style={styles.signInText}>Sign in</Text><Ionicons name="arrow-forward" color="#fff" size={20} /></>}
                </LinearGradient>
              </Pressable>

              <View style={styles.orRow}><View style={styles.orLine} /><Text style={styles.orText}>or continue with</Text><View style={styles.orLine} /></View>
              <GoogleButton
                pending={googleMutation.isPending}
                disabled={!google.ready}
                onPress={() => {
                  void google.prompt();
                }}
              />
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field(props: { label?: string; icon: React.ComponentProps<typeof Ionicons>["name"]; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: "email-address" | "number-pad"; secureTextEntry?: boolean; autoComplete?: "email" | "password" | "one-time-code"; maxLength?: number; error?: string | null; action?: () => void; actionIcon?: React.ComponentProps<typeof Ionicons>["name"] }) {
  const [focused, setFocused] = useState(false);
  const tint = props.error ? FIELD_ERROR_COLOR : focused ? "#12a06e" : "#7b93a6";
  return (
    <View style={styles.field}>
      {props.label && <Text style={styles.fieldLabel}>{props.label}</Text>}
      <View style={[styles.inputShell, focused && styles.inputShellFocused, !!props.error && styles.inputShellError]}>
        <Ionicons name={props.icon} size={20} color={tint} style={styles.fieldIcon} />
        <TextInput
          style={styles.input}
          value={props.value}
          onChangeText={props.onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={props.placeholder}
          placeholderTextColor="#9fb1c1"
          keyboardType={props.keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={props.secureTextEntry}
          autoComplete={props.autoComplete}
          maxLength={props.maxLength}
          accessibilityLabel={props.label ?? props.placeholder}
          accessibilityHint={props.error ?? undefined}
        />
        {props.action && (
          <Pressable onPress={props.action} hitSlop={12} style={styles.eyeButton}>
            <Ionicons name={props.actionIcon!} size={20} color={tint} />
          </Pressable>
        )}
      </View>
      <FieldError message={props.error} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5fbf8" },
  scroll: { flexGrow: 1, justifyContent: "center", paddingVertical: 16 },
  content: { width: "100%", maxWidth: 480, alignSelf: "center", paddingHorizontal: 22 },
  mintGlowTop: { position: "absolute", top: -170, left: -120, height: 330, width: 390, borderRadius: 220, backgroundColor: "#e3f8ef" },
  mintGlowBottom: { position: "absolute", bottom: -180, right: -140, height: 320, width: 360, borderRadius: 220, backgroundColor: "#efebff" },
  welcomeBlock: { alignItems: "center", marginTop: -4 },
  welcomeTitle: { color: "#123047", fontSize: 27, fontWeight: "800", letterSpacing: -0.5 },
  welcomeAccent: { color: "#12a06e" },
  welcomeCopy: { color: "#6f879b", fontSize: 14, marginTop: 4, textAlign: "center" },
  form: { marginTop: 22, backgroundColor: "transparent" },
  field: { marginBottom: 14 },
  fieldLabel: { color: "#28455a", fontSize: 13, fontWeight: "700", marginBottom: 7, marginLeft: 2 },
  inputShell: { alignItems: "center", backgroundColor: "#fff", borderColor: "#e0e9ee", borderRadius: 14, borderWidth: 1.5, flexDirection: "row", height: 52 },
  inputShellFocused: { backgroundColor: "#fff", borderColor: "#12a06e" },
  inputShellError: { borderColor: FIELD_ERROR_COLOR },
  fieldIcon: { marginLeft: 14 },
  input: { color: "#17354a", flex: 1, fontSize: 15, height: "100%", paddingHorizontal: 11 },
  eyeButton: { alignItems: "center", height: "100%", justifyContent: "center", paddingHorizontal: 14 },
  forgotButton: { alignSelf: "flex-end", marginTop: -4, marginBottom: 14 },
  forgotText: { color: "#6d5dfc", fontSize: 13, fontWeight: "700" },
  totpBox: { backgroundColor: "#f0fbf6", borderRadius: 16, padding: 12, paddingBottom: 0, marginBottom: 14 },
  totpHintRow: { alignItems: "center", flexDirection: "row", gap: 7, marginBottom: 10 },
  totpHint: { color: "#2f5a4b", flex: 1, fontSize: 13, fontWeight: "600" },
  signInButton: {
    borderRadius: 26,
    height: 54,
    shadowColor: "#0c8a5e",
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  signInGradient: { alignItems: "center", borderRadius: 26, flex: 1, flexDirection: "row", gap: 8, justifyContent: "center" },
  signInText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.2 },
  pressed: { transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.65 },
  orRow: { alignItems: "center", flexDirection: "row", gap: 12, marginTop: 18, marginBottom: 14 },
  orLine: { backgroundColor: "#e8eef2", flex: 1, height: 1 },
  orText: { color: "#97abbb", fontSize: 12, fontWeight: "600" },
});
