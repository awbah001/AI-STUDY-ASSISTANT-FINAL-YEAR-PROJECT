import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
  Switch,
  Modal,
  Image,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../src/contexts/AuthContext";
import { trpc } from "../../src/lib/api";
import { API_URL } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [notifs, setNotifs] = useState(true);
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const utils = trpc.useUtils();
  const { data: progress, isLoading: progressLoading, refetch: refetchProgress } =
    trpc.progress.stats.useQuery();
  const { data: analytics, refetch: refetchAnalytics } =
    trpc.progress.analytics.useQuery();

  // A tab stays mounted while the learner moves around the app. Refresh these
  // summaries on focus so the Profile tab reflects their latest study activity.
  useFocusEffect(
    useCallback(() => {
      void Promise.all([refetchProgress(), refetchAnalytics()]);
    }, [refetchAnalytics, refetchProgress])
  );

  const totalMinutes =
    analytics?.totalStudyTime ??
    progress?.reduce((total, item) => total + (item.totalStudyTimeMinutes ?? 0), 0) ??
    0;
  const studyTime = totalMinutes >= 60
    ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
    : `${totalMinutes}m`;
  const quizzesTaken = progress?.reduce(
    (total, item) => total + (item.quizzesAttempted ?? 0),
    0
  ) ?? 0;
  const flashcardsReviewed = progress?.reduce(
    (total, item) => total + (item.flashcardsReviewed ?? 0),
    0
  ) ?? 0;

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: (updated) => {
      utils.auth.me.setData(undefined, updated as any);
      setEditing(false);
      Alert.alert("Saved", "Profile updated.");
    },
    onError: (err) => Alert.alert("Error", err.message),
  });

  /** Pick an image from the camera roll and upload it as the avatar */
  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to your photo library to change your profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const ext = (asset.uri.split(".").pop() ?? "jpg").toLowerCase();
    const mimeType = asset.mimeType ?? (ext === "png" ? "image/png" : "image/jpeg");
    const key = `avatars/${user?.id ?? "me"}-${Date.now()}.${ext}`;

    try {
      setAvatarUploading(true);

      const { getToken } = await import("../../src/lib/api");
      const token = await getToken();

      // expo-file-system v18+ (SDK 57) uses the File class API
      // Read the image bytes directly using the new FileSystem.File class
      const { File: FSFile } = await import("expo-file-system");
      const file = new FSFile(asset.uri);
      const bytes = await file.bytes(); // returns Uint8Array — no base64 needed

      const uploadRes = await fetch(
        `${API_URL}/api/storage/put?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": mimeType,
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: bytes,
        }
      );

      if (!uploadRes.ok) {
        const errText = await uploadRes.text().catch(() => "");
        throw new Error(`Server error ${uploadRes.status}${errText ? `: ${errText}` : ""}`);
      }

      const { url } = (await uploadRes.json()) as { url: string };
      await updateProfile.mutateAsync({ avatarUrl: url });
      Alert.alert("Done", "Profile picture updated.");
    } catch (e: any) {
      Alert.alert("Upload failed", e?.message ?? "Please try again.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setPwOpen(false);
      Alert.alert("Password updated", "You can use your new password next time you sign in.");
    },
    onError: (err) => Alert.alert("Could not change password", err.message),
  });

  const submitPassword = () => {
    if (newPw.length < 8) {
      Alert.alert("Too short", "New password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      Alert.alert("Mismatch", "New passwords do not match.");
      return;
    }
    changePassword.mutate({ currentPassword: currentPw, newPassword: newPw });
  };

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
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <Text style={s.pageTitle}>Profile</Text>

        {/* ── Avatar card ── */}
        <View style={s.avatarCard}>
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8} style={s.avatarRing}>
            {avatarUploading ? (
              <View style={s.avatar}>
                <ActivityIndicator color={colors.white} size="large" />
              </View>
            ) : user?.avatarUrl ? (
              <Image
                source={{ uri: user.avatarUrl.startsWith("/") ? `${API_URL}${user.avatarUrl}` : user.avatarUrl }}
                style={s.avatarImg}
              />
            ) : (
              <View style={s.avatar}>
                <Text style={s.avatarText}>
                  {user?.name?.charAt(0).toUpperCase() ?? "?"}
                </Text>
              </View>
            )}
            {/* Camera badge overlay */}
            <View style={s.cameraBadge}>
              <Ionicons name="camera" size={12} color={colors.white} />
            </View>
          </TouchableOpacity>

          {editing ? (
            <View style={s.editRow}>
              <TextInput
                style={s.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={colors.textLight}
                autoFocus
              />
              <TouchableOpacity
                style={[
                  s.saveBtn,
                  (!name.trim() || updateProfile.isPending) && s.saveBtnOff,
                ]}
                disabled={!name.trim() || updateProfile.isPending}
                onPress={() => updateProfile.mutate({ name: name.trim() })}
              >
                {updateProfile.isPending ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={s.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={s.nameRow} onPress={() => setEditing(true)}>
              <Text style={s.displayName}>{user?.name ?? "—"}</Text>
              <Ionicons name="pencil-outline" size={15} color={colors.textLight} />
            </TouchableOpacity>
          )}

          <Text style={s.emailText}>{user?.email ?? "—"}</Text>

          <View style={s.roleBadge}>
            <Ionicons name="school-outline" size={12} color={colors.primary} />
            <Text style={s.roleText}>Student</Text>
          </View>
        </View>

        {/* ── Account ── */}
        <Section title="Account">
          <Row icon="person-outline" label="Edit Profile" onPress={() => setEditing(true)} />
          <Row
            icon="lock-closed-outline"
            label="Change Password"
            onPress={() => setPwOpen(true)}
          />
          <Row icon="mail-outline" label="Email" value={user?.email ?? "—"} last />
        </Section>

        {/* ── Preferences ── */}
        <Section title="Preferences">
          <View style={s.switchRow}>
            <View style={s.rowLeft}>
              <View style={[s.rowIcon, { backgroundColor: "#fff7ed" }]}>
                <Ionicons name="notifications-outline" size={17} color="#f59e0b" />
              </View>
              <Text style={s.rowLabel}>Notifications</Text>
            </View>
            <Switch
              value={notifs}
              onValueChange={setNotifs}
              trackColor={{ false: "#e2e8f0", true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
          <Row icon="globe-outline" label="Language" value="English" last />
        </Section>

        {/* ── Learning ── */}
        <Section title="Learning">
          <TouchableOpacity
            style={s.progressCard}
            onPress={() => router.push("/(tabs)/progress" as any)}
            accessibilityRole="button"
            accessibilityLabel="View my learning progress"
          >
            <View style={s.progressCardHeader}>
              <View>
                <Text style={s.progressEyebrow}>YOUR LEARNING</Text>
                <Text style={s.progressHeading}>My Progress</Text>
              </View>
              <View style={s.progressArrow}>
                <Ionicons name="arrow-forward" size={17} color={colors.white} />
              </View>
            </View>
            {progressLoading ? (
              <ActivityIndicator color={colors.white} style={s.progressLoader} />
            ) : (
              <View style={s.progressStats}>
                <ProgressMetric icon="time-outline" value={studyTime} label="Study time" />
                <ProgressMetric icon="flame-outline" value={`${analytics?.currentStreak ?? 0}`} label="Day streak" />
                <ProgressMetric icon="help-circle-outline" value={`${quizzesTaken}`} label="Quizzes" />
                <ProgressMetric icon="layers-outline" value={`${flashcardsReviewed}`} label="Cards reviewed" />
              </View>
            )}
            <Text style={s.progressLink}>View detailed activity</Text>
          </TouchableOpacity>
          <Row
            icon="layers-outline"
            label="Flashcard History"
            onPress={() => router.push("/(tabs)/flashcards" as any)}
          />
          <Row
            icon="help-circle-outline"
            label="Quiz History"
            last
            onPress={() => router.push("/(tabs)/quizzes" as any)}
          />
        </Section>

        {/* ── About ── */}
        <Section title="About">
          <Row icon="information-circle-outline" label="App Version" value="1.0.0" />
          <Row icon="shield-checkmark-outline" label="Privacy Policy" />
          <Row icon="document-text-outline" label="Terms of Service" last />
        </Section>

        {/* ── Sign out ── */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={19} color={colors.error} />
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal visible={pwOpen} animationType="slide" transparent>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Change password</Text>
            <Text style={s.modalHint}>
              Enter your current password, then choose a new one (at least 8 characters).
            </Text>
            <TextInput
              style={s.pwInput}
              value={currentPw}
              onChangeText={setCurrentPw}
              placeholder="Current password"
              placeholderTextColor={colors.textLight}
              secureTextEntry
              autoCapitalize="none"
            />
            <TextInput
              style={s.pwInput}
              value={newPw}
              onChangeText={setNewPw}
              placeholder="New password"
              placeholderTextColor={colors.textLight}
              secureTextEntry
              autoCapitalize="none"
            />
            <TextInput
              style={s.pwInput}
              value={confirmPw}
              onChangeText={setConfirmPw}
              placeholder="Confirm new password"
              placeholderTextColor={colors.textLight}
              secureTextEntry
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[s.saveBtn, changePassword.isPending && s.saveBtnOff]}
              disabled={changePassword.isPending || !currentPw || !newPw}
              onPress={submitPassword}
            >
              {changePassword.isPending ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={s.saveBtnText}>Update password</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={() => {
                setPwOpen(false);
                setCurrentPw("");
                setNewPw("");
                setConfirmPw("");
              }}
            >
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ProgressMetric({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <View style={s.progressMetric}>
      <Ionicons name={icon as any} size={15} color="rgba(255,255,255,0.78)" />
      <Text style={s.progressMetricValue} numberOfLines={1}>{value}</Text>
      <Text style={s.progressMetricLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionLabel}>{title}</Text>
      <View style={s.sectionCard}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
  last,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[s.row, !last && s.rowBorder]}
      onPress={onPress}
      activeOpacity={onPress ? 0.65 : 1}
    >
      <View style={s.rowLeft}>
        <View style={s.rowIcon}>
          <Ionicons name={icon as any} size={17} color={colors.textMuted} />
        </View>
        <Text style={s.rowLabel}>{label}</Text>
      </View>
      <View style={s.rowRight}>
        {value && <Text style={s.rowValue}>{value}</Text>}
        {onPress && (
          <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5f6fa" },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },

  pageTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 20,
  },

  // Avatar card
  avatarCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white,
  },
  avatarText: { fontSize: 32, fontWeight: "900", color: colors.white },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  displayName: { fontSize: 20, fontWeight: "800", color: colors.text },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
    marginBottom: 4,
  },
  nameInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: "#f8fafc",
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnOff: { opacity: 0.45 },
  saveBtnText: { color: colors.white, fontWeight: "800", fontSize: 14 },
  emailText: { fontSize: 13, color: colors.textMuted, marginBottom: 10 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#e8fdf2",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  roleText: { fontSize: 12, fontWeight: "700", color: colors.primary },

  // Live learning summary
  progressCard: {
    backgroundColor: colors.primary,
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.15)",
  },
  progressCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  progressEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 1.1,
  },
  progressHeading: { fontSize: 19, fontWeight: "800", color: colors.white, marginTop: 3 },
  progressArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  progressStats: { flexDirection: "row", flexWrap: "wrap", rowGap: 14 },
  progressMetric: { width: "50%", flexDirection: "row", alignItems: "center", gap: 6 },
  progressMetricValue: { color: colors.white, fontSize: 14, fontWeight: "800", maxWidth: 68 },
  progressMetricLabel: { color: "rgba(255,255,255,0.72)", fontSize: 11, flexShrink: 1 },
  progressLoader: { height: 54 },
  progressLink: { color: colors.white, fontSize: 12, fontWeight: "700", marginTop: 16 },

  // Section
  section: { marginBottom: 16 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    paddingLeft: 4,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },

  // Row
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontSize: 14, color: colors.text, fontWeight: "500" },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowValue: { fontSize: 13, color: colors.textMuted },

  // Switch row (same height as Row)
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },

  // Logout
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 15,
    marginTop: 4,
    borderWidth: 1.5,
    borderColor: "#fee2e2",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  logoutText: { fontSize: 15, fontWeight: "700", color: colors.error },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    gap: 10,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  modalHint: { fontSize: 13, color: colors.textMuted, marginBottom: 6 },
  pwInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: "#f8fafc",
  },
  cancelBtn: { alignItems: "center", paddingVertical: 10 },
  cancelText: { fontSize: 15, fontWeight: "700", color: colors.textMuted },
});
