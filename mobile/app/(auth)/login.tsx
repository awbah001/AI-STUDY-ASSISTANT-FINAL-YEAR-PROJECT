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
  Animated,
  Image,
} from "react-native";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/contexts/AuthContext";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";

const brandLogo = require("../../assets/logo.png");

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(40));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]).start();
  }, []);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      if (data.user.role !== "user") {
        Alert.alert(
          "Staff Portal",
          "Lecturers and admins should use the Cognify web portal.",
          [{ text: "OK" }]
        );
        return;
      }
      await login(data.token, data.user as any);
      router.replace("/(tabs)/dashboard");
    },
    onError: (err) => {
      const msg = err.message || "";
      const isNetwork =
        msg.includes("Network request failed") ||
        msg.includes("fetch") ||
        msg.includes("ECONNREFUSED") ||
        msg.includes("timeout") ||
        msg.includes("Unable to resolve");

      if (isNetwork) {
        Alert.alert(
          "Connection error",
          "Could not connect to the server. Make sure you are connected to the same Wi-Fi network and try again.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert("Sign in failed", msg || "Invalid email or password.");
      }
    },
  });

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Required", "Please enter your email and password.");
      return;
    }
    loginMutation.mutate({ email: email.trim(), password });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <Animated.View style={[styles.logoSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.logoCircle}>
            <Image source={brandLogo} style={styles.logoImage} resizeMode="cover" />
          </View>
          <Text style={styles.appName}>Cognify</Text>
          <Text style={styles.tagline}>Your AI study companion</Text>
        </Animated.View>

        {/* Form */}
        <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your student account</Text>

          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={colors.textLight} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={colors.textLight}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textLight} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textLight}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.showBtn} activeOpacity={0.7}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign in button */}
          <TouchableOpacity
            style={[styles.loginBtn, loginMutation.isPending && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loginMutation.isPending}
            activeOpacity={0.85}
          >
            {loginMutation.isPending
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.loginBtnText}>Sign in</Text>
            }
          </TouchableOpacity>

          {/* Sign up link */}
          <View style={styles.signupRow}>
            <Text style={styles.signupText}>Don&apos;t have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/signup")} activeOpacity={0.7}>
              <Text style={styles.signupLink}>Sign up</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 40 },
  logoSection: { alignItems: "center", marginBottom: 36 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 24, overflow: "hidden",
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
    marginBottom: 14,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 14, elevation: 6,
  },
  logoImage: { width: "100%", height: "100%" },
  appName: { fontSize: 30, fontWeight: "800", color: colors.text, letterSpacing: -0.75 },
  tagline: { fontSize: 15, color: colors.textMuted, marginTop: 6 },
  card: {
    backgroundColor: colors.surface, borderRadius: 28, padding: 28,
    shadowColor: "#000", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08, shadowRadius: 20, elevation: 6,
  },
  title: { fontSize: 24, fontWeight: "700", color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 15, color: colors.textMuted, marginBottom: 28 },
  field: { marginBottom: 18 },
  label: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 8 },
  inputContainer: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: 16, backgroundColor: "#f8fafc",
  },
  inputIcon: { paddingLeft: 16 },
  input: { flex: 1, paddingHorizontal: 12, paddingVertical: 14, fontSize: 15, color: colors.text },
  passwordInput: { paddingRight: 4 },
  showBtn: { paddingHorizontal: 14, paddingVertical: 14 },
  loginBtn: {
    backgroundColor: colors.primary, borderRadius: 18,
    paddingVertical: 16, alignItems: "center", marginTop: 10,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: colors.white, fontSize: 17, fontWeight: "700" },
  signupRow: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  signupText: { fontSize: 15, color: colors.textMuted },
  signupLink: { fontSize: 15, fontWeight: "700", color: colors.primary },
});
