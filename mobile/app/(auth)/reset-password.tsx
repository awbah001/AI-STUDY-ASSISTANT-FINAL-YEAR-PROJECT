import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone] = useState(false);

  const mutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => setDone(true),
    onError: (err) => Alert.alert("Reset failed", err.message),
  });

  const handleReset = () => {
    if (!password || !confirm) { Alert.alert("Required", "Fill in both fields."); return; }
    if (password !== confirm) { Alert.alert("Mismatch", "Passwords don't match."); return; }
    if (password.length < 8) { Alert.alert("Too short", "Password must be at least 8 characters."); return; }
    if (!token) { Alert.alert("Invalid link", "No reset token found."); return; }
    mutation.mutate({ token, newPassword: password });
  };

  if (done) {
    return (
      <View style={[s.container, { justifyContent: "center", alignItems: "center", gap: 20, paddingHorizontal: 32 }]}>
        <View style={s.iconWrap}>
          <Ionicons name="checkmark-circle" size={56} color={colors.primary} />
        </View>
        <Text style={s.title}>Password updated!</Text>
        <Text style={s.sub}>You can now sign in with your new password.</Text>
        <TouchableOpacity style={s.btn} onPress={() => router.replace("/(auth)/login")}>
          <Text style={s.btnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.iconWrap}>
          <Ionicons name="key-outline" size={40} color={colors.primary} />
        </View>
        <Text style={s.title}>Set new password</Text>
        <Text style={s.sub}>Choose a strong password of at least 8 characters.</Text>

        <View style={s.card}>
          {/* New password */}
          <Text style={s.label}>New password</Text>
          <View style={s.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textLight} style={s.inputIcon} />
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Min 8 characters"
              placeholderTextColor={colors.textLight}
              secureTextEntry={!showPw}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPw(v => !v)} style={s.eyeBtn}>
              <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textLight} />
            </TouchableOpacity>
          </View>

          {/* Confirm */}
          <Text style={s.label}>Confirm password</Text>
          <View style={s.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textLight} style={s.inputIcon} />
            <TextInput
              style={s.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Repeat password"
              placeholderTextColor={colors.textLight}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={s.eyeBtn}>
              <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textLight} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[s.btn, mutation.isPending && s.btnOff]}
            disabled={mutation.isPending}
            onPress={handleReset}
          >
            {mutation.isPending
              ? <ActivityIndicator color={colors.white} />
              : <Text style={s.btnText}>Update password</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6fa" },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 48 },
  iconWrap: { width: 80, height: 80, borderRadius: 28, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 20 },
  title: { fontSize: 24, fontWeight: "900", color: colors.text, textAlign: "center", marginBottom: 8 },
  sub: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 22, marginBottom: 28 },
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 3 },
  label: { fontSize: 13, fontWeight: "600", color: colors.textSub, marginBottom: 8 },
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, marginBottom: 14 },
  inputIcon: { marginLeft: 13 },
  input: { flex: 1, paddingHorizontal: 10, paddingVertical: 13, fontSize: 15, color: colors.text },
  eyeBtn: { padding: 13 },
  btn: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 15, alignItems: "center", marginTop: 4, shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  btnOff: { opacity: 0.5 },
  btnText: { fontSize: 16, fontWeight: "800", color: colors.white },
});
