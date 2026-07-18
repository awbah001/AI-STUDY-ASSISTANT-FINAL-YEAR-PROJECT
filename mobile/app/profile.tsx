import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useAuth } from "../src/contexts/AuthContext";
import { trpc } from "../src/lib/api";
import { colors } from "../src/theme/colors";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const utils = trpc.useUtils();

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: (updated) => {
      utils.auth.me.setData(undefined, updated as any);
      setEditing(false);
      Alert.alert("Saved", "Profile updated.");
    },
    onError: (err) => Alert.alert("Error", err.message),
  });

  const handleLogout = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Back */}
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0).toUpperCase() ?? "?"}
            </Text>
          </View>
          <Text style={styles.displayName}>{user?.name ?? "—"}</Text>
          <Text style={styles.email}>{user?.email ?? "—"}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>Student</Text>
          </View>
        </View>

        {/* Edit name */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Profile</Text>
            <TouchableOpacity onPress={() => setEditing((v) => !v)}>
              <Text style={styles.editLink}>{editing ? "Cancel" : "Edit"}</Text>
            </TouchableOpacity>
          </View>

          {editing ? (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={colors.textLight}
              />
              <TouchableOpacity
                style={[styles.saveBtn, updateProfile.isPending && styles.saveBtnDisabled]}
                disabled={updateProfile.isPending || !name.trim()}
                onPress={() => updateProfile.mutate({ name: name.trim() })}
              >
                {updateProfile.isPending ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save changes</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={18} color={colors.textMuted} />
              <Text style={styles.infoText}>{user?.name ?? "—"}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
            <Text style={styles.infoText}>{user?.email ?? "—"}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity style={styles.dangerBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text style={styles.dangerBtnText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 16 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 24,
  },
  backText: { fontSize: 15, color: colors.primary, fontWeight: "600" },
  avatarSection: { alignItems: "center", marginBottom: 32 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarText: { fontSize: 36, fontWeight: "800", color: colors.white },
  displayName: { fontSize: 22, fontWeight: "800", color: colors.text },
  email: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  roleBadge: {
    marginTop: 10,
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  roleText: { fontSize: 13, fontWeight: "700", color: colors.primary },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  editLink: { fontSize: 14, fontWeight: "700", color: colors.primary },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoText: { fontSize: 14, color: colors.text },
  field: { marginBottom: 4 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: "#f8fafc",
    marginBottom: 12,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: colors.white, fontWeight: "700", fontSize: 15 },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  dangerBtnText: { fontSize: 15, fontWeight: "600", color: "#ef4444" },
});
