import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  const mutation = trpc.auth.forgotPassword.useMutation({
    onSuccess: (data) => {
      setSent(true);
      // In development the server returns the token directly — show it so
      // you can test the flow without an email server
      if ((data as any).token) setDevToken((data as any).token);
    },
    onError: (err) => Alert.alert("Error", err.message),
  });

  if (sent) {
    return (
      <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={s.scroll}>
          <TouchableOpacity style={s.backRow} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
            <Text style={s.backText}>Back to sign in</Text>
          </TouchableOpacity>

          <View style={s.iconWrap}>
            <Ionicons name="mail-open-outline" size={48} color={colors.primary} />
          </View>
          <Text style={s.title}>Check your email</Text>
          <Text style={s.sub}>
            If an account exists for <Text style={{ fontWeight: "700" }}>{email}</Text>, a
            password reset link has been sent.
          </Text>

          {/* Dev convenience: show the reset token directly */}
          {devToken && (
            <View style={s.devBox}>
              <Text style={s.devLabel}>Dev mode — reset token:</Text>
              <Text style={s.devToken} selectable>{devToken}</Text>
              <TouchableOpacity
                style={s.devBtn}
                onPress={() =>
                  router.push({ pathname: "/(auth)/reset-password", params: { token: devToken } })
                }
              >
                <Text style={s.devBtnText}>Open reset screen →</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={s.btn} onPress={() => router.replace("/(auth)/login")}>
            <Text style={s.btnText}>Back to Sign In</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={s.backRow} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
          <Text style={s.backText}>Back to sign in</Text>
        </TouchableOpacity>

        <View style={s.iconWrap}>
          <Ionicons name="lock-open-outline" size={48} color={colors.primary} />
        </View>
        <Text style={s.title}>Forgot password?</Text>
        <Text style={s.sub}>Enter your email and we'll send you a reset link.</Text>

        <View style={s.card}>
          <Text style={s.label}>Email address</Text>
          <View style={s.inputWrap}>
            <Ionicons name="mail-outline" size={18} color={colors.textLight} style={s.inputIcon} />
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              placeholderTextColor={colors.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={[s.btn, (!email.trim() || mutation.isPending) && s.btnOff]}
            disabled={!email.trim() || mutation.isPending}
            onPress={() => mutation.mutate({ email: email.trim() })}
          >
            {mutation.isPending
              ? <ActivityIndicator color={colors.white} />
              : <Text style={s.btnText}>Send reset link</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6fa" },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 32 },
  backText: { fontSize: 14, color: colors.primary, fontWeight: "600" },
  iconWrap: { width: 80, height: 80, borderRadius: 28, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 20 },
  title: { fontSize: 24, fontWeight: "900", color: colors.text, textAlign: "center", marginBottom: 8 },
  sub: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 22, marginBottom: 28 },
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 3 },
  label: { fontSize: 13, fontWeight: "600", color: colors.textSub, marginBottom: 8 },
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, marginBottom: 16 },
  inputIcon: { marginLeft: 13 },
  input: { flex: 1, paddingHorizontal: 10, paddingVertical: 13, fontSize: 15, color: colors.text },
  btn: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 15, alignItems: "center", shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  btnOff: { opacity: 0.5 },
  btnText: { fontSize: 16, fontWeight: "800", color: colors.white },
  devBox: { backgroundColor: "#fffbeb", borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#fde68a", gap: 8 },
  devLabel: { fontSize: 12, fontWeight: "700", color: "#92400e" },
  devToken: { fontSize: 11, color: "#78350f", fontFamily: "monospace", backgroundColor: "#fef3c7", padding: 8, borderRadius: 8 },
  devBtn: { backgroundColor: "#f59e0b", borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  devBtnText: { fontSize: 13, fontWeight: "700", color: colors.white },
});
