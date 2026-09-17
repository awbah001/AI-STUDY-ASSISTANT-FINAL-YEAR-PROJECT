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
import { useRouter } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { trpc } from "../../src/lib/api";
import { useGoogleSignIn } from "../../src/lib/useGoogleSignIn";
import { GoogleButton } from "../../src/components/GoogleButton";
import { AuthBotHero } from "../../src/components/AuthBotHero";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 560, useNativeDriver: true }).start();
  }, [enter]);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      if (data.user.role !== "user") {
        Alert.alert("Staff Portal", "Lecturers and admins should use the Cognify web portal.");
        return;
      }
      await login(data.token, data.user as any);
      router.replace("/(tabs)/dashboard");
    },
    onError: (err) => {
      const message = err.message ?? "";
      const networkError = /network|fetch|econnrefused|timeout|resolve/i.test(message);
      Alert.alert(networkError ? "Connection error" : "Sign in failed", networkError ? "Could not reach the server. Check your connection and try again." : message || "Invalid email or password.");
    },
  });

  const googleMutation = trpc.auth.google.useMutation({
    onSuccess: async (data) => {
      await login(data.token, data.user as any);
      router.replace("/(tabs)/dashboard");
    },
    onError: (err) => Alert.alert("Google sign-in failed", err.message || "Please try again."),
  });

  const onGoogleToken = useCallback(
    (idToken: string) => {
      googleMutation.mutate({ idToken, client: "mobile" });
    },
    [googleMutation]
  );
  const google = useGoogleSignIn(onGoogleToken);

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Required", "Please enter your email and password.");
      return;
    }
    loginMutation.mutate({ email: email.trim(), password });
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
              <Text style={styles.welcomeTitle}>Welcome Back</Text>
              <Text style={styles.welcomeCopy}>Sign in to continue your learning journey</Text>
            </View>

            <View style={styles.form}>
              <Field icon="mail-outline" value={email} onChangeText={setEmail} placeholder="Email address" keyboardType="email-address" autoComplete="email" />
              <Field icon="lock-closed-outline" value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry={!showPassword} autoComplete="password" action={() => setShowPassword((current) => !current)} actionIcon={showPassword ? "eye-off-outline" : "eye-outline"} />

              <Pressable onPress={handleLogin} disabled={loginMutation.isPending || googleMutation.isPending} style={({ pressed }) => [styles.signInButton, pressed && styles.pressed, loginMutation.isPending && styles.disabled]}>
                <View style={styles.signInGradient}>
                  {loginMutation.isPending ? <ActivityIndicator color="#fff" /> : <><Text style={styles.signInText}>Sign In</Text><Ionicons name="arrow-forward" color="#fff" size={20} /></>}
                </View>
              </Pressable>

              <View style={styles.orRow}><View style={styles.orLine} /><Text style={styles.orText}>or</Text><View style={styles.orLine} /></View>
              <GoogleButton
                pending={googleMutation.isPending}
                disabled={!google.ready}
                onPress={() => {
                  if (!google.configured) {
                    Alert.alert("Google sign-in", "Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in mobile/.env and restart Expo.");
                    return;
                  }
                  google.prompt();
                }}
              />

              <View style={styles.newAccount}>
                <Text style={styles.newAccountText}>New here? </Text>
                <Pressable onPress={() => router.push("/(auth)/signup")} hitSlop={8}>
                  <Text style={styles.createAccount}>Create an account</Text>
                </Pressable>
              </View>
              <Pressable onPress={() => router.push("/(auth)/forgot-password")} hitSlop={10} style={styles.forgotButton}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field(props: { icon: React.ComponentProps<typeof Ionicons>["name"]; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: "email-address"; secureTextEntry?: boolean; autoComplete?: "email" | "password"; action?: () => void; actionIcon?: React.ComponentProps<typeof Ionicons>["name"] }) {
  return <View style={styles.inputShell}><Ionicons name={props.icon} size={21} color="#5f7890" style={styles.fieldIcon} /><TextInput style={styles.input} value={props.value} onChangeText={props.onChangeText} placeholder={props.placeholder} placeholderTextColor="#91a5b8" keyboardType={props.keyboardType} autoCapitalize="none" autoCorrect={false} secureTextEntry={props.secureTextEntry} autoComplete={props.autoComplete} />{props.action && <Pressable onPress={props.action} hitSlop={12} style={styles.eyeButton}><Ionicons name={props.actionIcon!} size={21} color="#5f7890" /></Pressable>}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f7fdfb" },
  scroll: { flexGrow: 1, justifyContent: "center", paddingVertical: 12 },
  content: { width: "100%", maxWidth: 480, alignSelf: "center", paddingHorizontal: 28 },
  mintGlowTop: { position: "absolute", top: -170, left: -120, height: 330, width: 390, borderRadius: 220, backgroundColor: "#e8faf4" },
  mintGlowBottom: { position: "absolute", bottom: -180, right: -140, height: 320, width: 360, borderRadius: 220, backgroundColor: "#e4f8f0" },
  welcomeBlock: { alignItems: "center", marginTop: -6 },
  welcomeTitle: { color: "#143044", fontSize: 28, fontWeight: "800", letterSpacing: -0.4 },
  welcomeCopy: { color: "#8aa0b4", fontSize: 14, marginTop: 6, textAlign: "center" },
  form: { marginTop: 20 },
  inputShell: { alignItems: "center", backgroundColor: "#fff", borderColor: "#e4ebf0", borderRadius: 16, borderWidth: 1, flexDirection: "row", height: 52, marginBottom: 12 },
  fieldIcon: { marginLeft: 16 },
  input: { color: "#17354a", flex: 1, fontSize: 15, height: "100%", paddingHorizontal: 12 },
  eyeButton: { alignItems: "center", height: "100%", justifyContent: "center", paddingHorizontal: 16 },
  signInButton: { borderRadius: 26, height: 52, marginTop: 6, overflow: "hidden" },
  signInGradient: { alignItems: "center", backgroundColor: "#12a06e", borderRadius: 26, flex: 1, flexDirection: "row", gap: 8, justifyContent: "center" },
  signInText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  pressed: { transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.65 },
  forgotButton: { alignSelf: "center", marginTop: 14 },
  forgotText: { color: "#8aa0b4", fontSize: 13, fontWeight: "500" },
  newAccount: { alignItems: "center", flexDirection: "row", justifyContent: "center", marginTop: 18 },
  newAccountText: { color: "#8aa0b4", fontSize: 13 },
  createAccount: { color: "#12a06e", fontSize: 13, fontWeight: "700" },
  orRow: { alignItems: "center", flexDirection: "row", gap: 12, marginTop: 16, marginBottom: 14 },
  orLine: { backgroundColor: "#e4ebf0", flex: 1, height: 1 },
  orText: { color: "#9aafc0", fontSize: 13 },
});
