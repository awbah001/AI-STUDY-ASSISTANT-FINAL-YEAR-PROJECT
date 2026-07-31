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
  Modal,
} from "react-native";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/contexts/AuthContext";
import { trpc, getServerUrl, saveServerUrl, getDefaultUrl } from "../../src/lib/api";
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

  // Server URL config
  const [serverModalVisible, setServerModalVisible] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState("");
  const [currentServerUrl, setCurrentServerUrl] = useState(getDefaultUrl());

  useEffect(() => {
    // Load saved server URL
    getServerUrl().then((url) => {
      setCurrentServerUrl(url);
      setServerUrlInput(url);
    });

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleSaveServerUrl = async () => {
    if (!serverUrlInput.trim()) {
      Alert.alert("Invalid URL", "Please enter a server URL.");
      return;
    }
    await saveServerUrl(serverUrlInput.trim());
    setCurrentServerUrl(serverUrlInput.trim());
    setServerModalVisible(false);
    Alert.alert("Saved", "Server URL updated. Try signing in again.");
  };

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      if (data.user.role !== "user") {
        Alert.alert(
          "Staff Portal",
          "Lecturers and admins should use the Cognify web portal at your school's website.",
          [{ text: "OK" }]
        );
        return;
      }
      await login(data.token, data.user as any);
      router.replace("/(tabs)/dashboard");
    },
    onError: (err) => {
      const msg = err.message || "";
      const isNetworkError =
        msg.includes("Network request failed") ||
        msg.includes("fetch") ||
        msg.includes("ECONNREFUSED") ||
        msg.includes("timeout") ||
        msg.includes("connect") ||
        msg.includes("Unable to resolve");

      if (isNetworkError) {
        Alert.alert(
          "Cannot reach server",
          `The app cannot connect to:\n${currentServerUrl}\n\nTap "Server Settings" below the Sign in button to enter your PC's IP address.`,
          [
            { text: "OK" },
            {
              text: "Server Settings",
              onPress: () => setServerModalVisible(true),
            },
          ]
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
        <Animated.View
          style={[
            styles.logoSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.logoCircle}>
            <Image source={brandLogo} style={styles.logoImage} resizeMode="cover" />
          </View>
          <Text style={styles.appName}>Cognify</Text>
          <Text style={styles.tagline}>Your AI study companion</Text>
        </Animated.View>

        {/* Form */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your student account</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={colors.textLight}
                style={styles.inputIcon}
              />
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

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={colors.textLight}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textLight}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                style={styles.showBtn}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.loginBtn,
              loginMutation.isPending && styles.loginBtnDisabled,
            ]}
            onPress={handleLogin}
            disabled={loginMutation.isPending}
            activeOpacity={0.85}
          >
            {loginMutation.isPending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.loginBtnText}>Sign in</Text>
            )}
          </TouchableOpacity>

          <View style={styles.signupRow}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/signup")} activeOpacity={0.7}>
              <Text style={styles.signupLink}>Sign up</Text>
            </TouchableOpacity>
          </View>

          {/* Server config link */}
          <TouchableOpacity
            style={styles.serverConfigBtn}
            onPress={() => setServerModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="server-outline" size={13} color={colors.textLight} />
            <Text style={styles.serverConfigText}>
              Server: {currentServerUrl.replace("http://", "").replace("https://", "")}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* ── Server URL modal ── */}
      <Modal
        visible={serverModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setServerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Server Settings</Text>
              <TouchableOpacity onPress={() => setServerModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Enter your PC's IP address and port. Run{" "}
              <Text style={{ fontWeight: "700" }}>ipconfig</Text> on your PC to find it.
            </Text>

            <View style={styles.urlExamples}>
              <Text style={styles.urlExampleLabel}>Examples:</Text>
              <Text style={styles.urlExample}>http://192.168.1.45:3000</Text>
              <Text style={styles.urlExample}>http://10.0.2.2:3000 (Android emulator)</Text>
            </View>

            <TextInput
              style={styles.urlInput}
              value={serverUrlInput}
              onChangeText={setServerUrlInput}
              placeholder="http://192.168.x.x:3000"
              placeholderTextColor={colors.textLight}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            {/* Test connection button */}
            <TouchableOpacity
              style={styles.testBtn}
              onPress={async () => {
                try {
                  const url = serverUrlInput.trim().replace(/\/$/, "");
                  const res = await fetch(`${url}/health`, {
                    signal: AbortSignal.timeout(4000),
                  });
                  if (res.ok) {
                    Alert.alert("✅ Connected", `Server at ${url} is reachable!`);
                  } else {
                    Alert.alert("⚠️ Unreachable", `Server responded with status ${res.status}`);
                  }
                } catch {
                  Alert.alert(
                    "❌ Cannot connect",
                    `Could not reach ${serverUrlInput.trim()}\n\nMake sure:\n• Your PC and phone are on the same Wi-Fi\n• The server is running (pnpm dev)\n• The IP address is correct (run ipconfig)`
                  );
                }
              }}
            >
              <Text style={styles.testBtnText}>Test connection</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={() => setServerUrlInput(getDefaultUrl())}
              >
                <Text style={styles.resetBtnText}>Reset to default</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveServerUrl}>
                <Text style={styles.saveBtnText}>Save & close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 36,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    shadowColor: "rgba(16, 185, 129, 0.3)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6,
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  appName: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.75,
  },
  tagline: {
    fontSize: 15,
    color: colors.textMuted,
    marginTop: 6,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: 28,
  },
  field: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
  },
  inputIcon: {
    paddingLeft: 16,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
  },
  passwordInput: {
    paddingRight: 4,
  },
  showBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  loginBtn: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(16, 185, 129, 0.5)",
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  loginBtnDisabled: {
    opacity: 0.5,
  },
  loginBtnText: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: "700",
  },
  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  signupText: {
    fontSize: 15,
    color: colors.textMuted,
  },
  signupLink: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
  },
  // Server config
  serverConfigBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 20,
    paddingVertical: 6,
  },
  serverConfigText: {
    fontSize: 11,
    color: colors.textLight,
    fontFamily: "monospace",
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 16,
  },
  urlExamples: {
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 4,
  },
  urlExampleLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  urlExample: {
    fontSize: 12,
    fontFamily: "monospace",
    color: "#0369a1",
  },
  urlInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: colors.text,
    backgroundColor: "#f8fafc",
    fontFamily: "monospace",
    marginBottom: 16,
  },
  testBtn: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: "center",
    marginBottom: 16,
    backgroundColor: colors.primary + "10",
  },
  testBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  resetBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  resetBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted,
  },
  saveBtn: {
    flex: 2,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(16, 185, 129, 0.5)",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
});
