import { design, elevation } from "../../src/theme/design";
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
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useState } from "react";
import { useAuth } from "../../src/contexts/AuthContext";
import { trpc } from "../../src/lib/api";
import {
  pickAndUploadAvatar,
  resolveAvatarUri,
} from "../../src/lib/uploadAvatar";
import { colors, gradients } from "../../src/theme/colors";
import { LIMITS, passwordChangeErrors, useFieldErrors, validatePersonName } from "../../src/lib/validation";
import { FieldError, FIELD_ERROR_COLOR } from "../../src/components/FieldError";
import { SEMESTERS, isSemester, levelLabel } from "../../../shared/academics";

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
  const [nameError, setNameError] = useState<string | null>(null);
  const { errors: pwErrors, check: checkPw, clear: clearPw, reset: resetPw } = useFieldErrors<"current" | "next" | "confirm">();
  const [avatarUploading, setAvatarUploading] = useState(false);
  const utils = trpc.useUtils();
  const prefs = trpc.admin.settings.preferences.useQuery();
  const savePrefs = trpc.admin.settings.savePreferences.useMutation({
    onSuccess: () => utils.admin.settings.preferences.invalidate(),
    onError: err => Alert.alert("Could not save", err.message),
  });
  const aiCoachOn = prefs.data?.notifications?.["student.aiCoach"] !== false;
  const {
    data: progress,
    isLoading: progressLoading,
    refetch: refetchProgress,
  } = trpc.progress.stats.useQuery();
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
    progress?.reduce(
      (total, item) => total + (item.totalStudyTimeMinutes ?? 0),
      0
    ) ??
    0;
  const studyTime =
    totalMinutes >= 60
      ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
      : `${totalMinutes}m`;
  const quizzesTaken =
    progress?.reduce(
      (total, item) => total + (item.quizzesAttempted ?? 0),
      0
    ) ?? 0;
  const flashcardsReviewed =
    progress?.reduce(
      (total, item) => total + (item.flashcardsReviewed ?? 0),
      0
    ) ?? 0;

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: updated => {
      utils.auth.me.setData(undefined, updated as any);
      setEditing(false);
      Alert.alert("Saved", "Profile updated.");
    },
    onError: err => Alert.alert("Error", err.message),
  });

  /** Pick an image from the camera roll and upload it as the avatar */
  const pickAvatar = async () => {
    try {
      setAvatarUploading(true);
      const url = await pickAndUploadAvatar(user?.id);
      if (!url) return;
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
      Alert.alert(
        "Password updated",
        "You can use your new password next time you sign in."
      );
    },
    onError: err => Alert.alert("Could not change password", err.message),
  });

  const submitPassword = () => {
    if (!checkPw(passwordChangeErrors(currentPw, newPw, confirmPw))) return;
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

  const closePassword = () => {
    setPwOpen(false);
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    resetPw();
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.eyebrow}>Your account</Text>
        <Text style={s.pageTitle}>Profile</Text>

        <View style={s.idCard}>
          <LinearGradient
            colors={gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.cover}
          >
            <View style={s.coverRingLg} />
            <View style={s.coverRingSm} />
          </LinearGradient>

          <TouchableOpacity
            onPress={pickAvatar}
            activeOpacity={0.85}
            style={s.avatarRing}
            accessibilityLabel="Change profile picture"
          >
            {avatarUploading ? (
              <View style={s.avatar}>
                <ActivityIndicator color={colors.white} size="large" />
              </View>
            ) : user?.avatarUrl ? (
              <Image
                source={{ uri: resolveAvatarUri(user.avatarUrl) }}
                style={s.avatarImg}
              />
            ) : (
              <LinearGradient colors={gradients.hero} style={s.avatar}>
                <Text style={s.avatarText}>
                  {user?.name?.charAt(0).toUpperCase() ?? "?"}
                </Text>
              </LinearGradient>
            )}
            <View style={s.cameraBadge}>
              <Ionicons name="camera" size={12} color={colors.white} />
            </View>
          </TouchableOpacity>

          <View style={s.idBody}>
            {editing ? (
              <View style={s.editRow}>
                <TextInput
                  style={[s.nameInput, !!nameError && s.inputError]}
                  value={name}
                  onChangeText={v => {
                    setName(v);
                    setNameError(null);
                  }}
                  placeholder="Your name"
                  placeholderTextColor={colors.textLight}
                  maxLength={LIMITS.name.max}
                  autoComplete="name"
                  autoFocus
                />
                <TouchableOpacity
                  style={[s.saveBtn, updateProfile.isPending && s.saveBtnOff]}
                  disabled={updateProfile.isPending}
                  onPress={() => {
                    const error = validatePersonName(name);
                    setNameError(error);
                    if (!error) updateProfile.mutate({ name: name.trim().replace(/\s+/g, " ") });
                  }}
                >
                  {updateProfile.isPending ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={s.saveBtnText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}
            {editing ? <FieldError message={nameError} style={{ alignSelf: "stretch", marginBottom: 6 }} /> : (
              <TouchableOpacity
                style={s.nameRow}
                onPress={() => setEditing(true)}
              >
                <Text style={s.displayName}>{user?.name ?? "—"}</Text>
                <View style={s.pencil}>
                  <Ionicons name="pencil" size={11} color={colors.primary} />
                </View>
              </TouchableOpacity>
            )}

            <Text style={s.emailText}>{user?.email ?? "—"}</Text>

            <View style={s.roleBadge}>
              <Ionicons name="school" size={12} color={colors.primary} />
              <Text style={s.roleText}>Student</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={s.progressWrap}
          onPress={() => router.push("/(tabs)/progress" as any)}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="View my learning progress"
        >
          <LinearGradient
            colors={gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.progressCard}
          >
            <View style={s.progressRing} />
            <View style={s.progressCardHeader}>
              <View>
                <Text style={s.progressEyebrow}>YOUR LEARNING</Text>
                <Text style={s.progressHeading}>My progress</Text>
              </View>
              <View style={s.progressArrow}>
                <Ionicons name="arrow-forward" size={16} color={colors.primary} />
              </View>
            </View>
            {progressLoading ? (
              <ActivityIndicator
                color={colors.white}
                style={s.progressLoader}
              />
            ) : (
              <View style={s.progressStats}>
                <ProgressMetric
                  icon="time-outline"
                  value={studyTime}
                  label="Study time"
                />
                <ProgressMetric
                  icon="flame-outline"
                  value={`${analytics?.currentStreak ?? 0}`}
                  label="Day streak"
                />
                <ProgressMetric
                  icon="help-circle-outline"
                  value={`${quizzesTaken}`}
                  label="Quizzes"
                />
                <ProgressMetric
                  icon="layers-outline"
                  value={`${flashcardsReviewed}`}
                  label="Cards reviewed"
                />
              </View>
            )}
            <Text style={s.progressLink}>View detailed activity</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Section title="Account">
          <Row
            icon="person-outline"
            tone={TONES.green}
            label="Edit profile"
            onPress={() => setEditing(true)}
          />
          <Row
            icon="lock-closed-outline"
            tone={TONES.violet}
            label="Change password"
            onPress={() => setPwOpen(true)}
          />
          <Row
            icon="mail-outline"
            tone={TONES.blue}
            label="Email"
            value={user?.email ?? "—"}
            last
          />
        </Section>

        <AcademicDetails />

        <Section title="Preferences">
          <View style={[s.row, s.rowBorder, s.switchRow]}>
            <View style={s.rowLeft}>
              <View style={[s.rowIcon, { backgroundColor: TONES.amber.bg }]}>
                <Ionicons
                  name="notifications-outline"
                  size={17}
                  color={TONES.amber.fg}
                />
              </View>
              <Text style={s.rowLabel}>Notifications</Text>
            </View>
            <Switch
              value={notifs}
              onValueChange={setNotifs}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
          <View style={[s.row, s.rowBorder, s.switchRow]}>
            <View style={[s.rowLeft, { flex: 1, paddingRight: 12 }]}>
              <View style={[s.rowIcon, { backgroundColor: TONES.violet.bg }]}>
                <Ionicons name="sparkles" size={17} color={TONES.violet.fg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>AI study coach</Text>
                <Text style={s.switchHint}>
                  Checks in every few hours and may prepare flashcards or quizzes for you.
                </Text>
              </View>
            </View>
            <Switch
              value={aiCoachOn}
              disabled={prefs.isLoading || savePrefs.isPending}
              onValueChange={value =>
                savePrefs.mutate({
                  notifications: {
                    ...(prefs.data?.notifications ?? {}),
                    "student.aiCoach": value,
                  },
                })
              }
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
          <Row
            icon="globe-outline"
            tone={TONES.blue}
            label="Language"
            value="English"
            last
          />
        </Section>

        <Section title="Learning">
          <Row
            icon="layers-outline"
            tone={TONES.green}
            label="Flashcard history"
            onPress={() => router.push("/(tabs)/flashcards" as any)}
          />
          <Row
            icon="help-circle-outline"
            tone={TONES.amber}
            label="Quiz history"
            last
            onPress={() => router.push("/(tabs)/quizzes" as any)}
          />
        </Section>

        <Section title="About">
          <Row
            icon="information-circle-outline"
            tone={TONES.slate}
            label="App version"
            value="1.0.0"
          />
          <Row
            icon="shield-checkmark-outline"
            tone={TONES.slate}
            label="Privacy policy"
          />
          <Row
            icon="document-text-outline"
            tone={TONES.slate}
            label="Terms of service"
            last
          />
        </Section>

        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={19} color={colors.error} />
          <Text style={s.logoutText}>Sign out</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal visible={pwOpen} animationType="slide" transparent>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <View style={s.grabber} />
            <View style={s.modalHead}>
              <View style={s.modalIcon}>
                <Ionicons name="lock-closed" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle}>Change password</Text>
                <Text style={s.modalHint}>
                  Enter your current password, then choose a new one with at
                  least 8 characters, including a letter and a number.
                </Text>
              </View>
            </View>
            <TextInput
              style={[s.pwInput, !!pwErrors.current && s.inputError]}
              value={currentPw}
              onChangeText={v => {
                setCurrentPw(v);
                clearPw("current");
              }}
              placeholder="Current password"
              placeholderTextColor={colors.textLight}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              maxLength={LIMITS.password.max}
            />
            <FieldError message={pwErrors.current} style={s.pwError} />
            <TextInput
              style={[s.pwInput, !!pwErrors.next && s.inputError]}
              value={newPw}
              onChangeText={v => {
                setNewPw(v);
                clearPw("next");
              }}
              placeholder="New password"
              placeholderTextColor={colors.textLight}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              maxLength={LIMITS.password.max}
            />
            <FieldError message={pwErrors.next} style={s.pwError} />
            <TextInput
              style={[s.pwInput, !!pwErrors.confirm && s.inputError]}
              value={confirmPw}
              onChangeText={v => {
                setConfirmPw(v);
                clearPw("confirm");
              }}
              placeholder="Confirm new password"
              placeholderTextColor={colors.textLight}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              maxLength={LIMITS.password.max}
            />
            <FieldError message={pwErrors.confirm} style={s.pwError} />
            <TouchableOpacity
              style={[
                s.saveBtn,
                s.modalSave,
                changePassword.isPending && s.saveBtnOff,
              ]}
              disabled={changePassword.isPending}
              onPress={submitPassword}
            >
              {changePassword.isPending ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={s.saveBtnText}>Update password</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={closePassword}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

type Tone = { fg: string; bg: string };

const TONES = {
  green: { fg: colors.primary, bg: colors.primaryLight },
  violet: { fg: colors.violet, bg: colors.violetSoft },
  blue: { fg: colors.info, bg: colors.infoSoft },
  amber: { fg: "#d97706", bg: colors.warningSoft },
  slate: { fg: colors.textMuted, bg: colors.surfaceAlt },
} satisfies Record<string, Tone>;

function ProgressMetric({
  icon,
  value,
  label,
}: {
  icon: string;
  value: string;
  label: string;
}) {
  return (
    <View style={s.progressMetric}>
      <View style={s.metricIcon}>
        <Ionicons name={icon as any} size={15} color={colors.white} />
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text style={s.progressMetricValue} numberOfLines={1}>
          {value}
        </Text>
        <Text style={s.progressMetricLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function AcademicDetails() {
  const utils = trpc.useUtils();
  const status = trpc.studentLearning.onboardingStatus.useQuery();
  const catalogue = trpc.academics.catalogue.useQuery();
  const profile = status.data?.profile;
  const [term, setTerm] = useState<{ semester: string; academicYear: string } | null>(null);
  const save = trpc.academics.updateMyTerm.useMutation({
    onSuccess: async () => {
      await utils.studentLearning.onboardingStatus.invalidate();
      setTerm(null);
      Alert.alert("Saved", "Semester updated.");
    },
    onError: err => Alert.alert("Could not save", err.message),
  });
  if (!profile) return null;

  const current = {
    semester: isSemester(profile.semester) ? profile.semester : "",
    academicYear: profile.academicYear ?? "",
  };
  const draft = term ?? current;
  const years = [
    ...new Set([...(catalogue.data?.yearOptions ?? []), current.academicYear].filter(Boolean)),
  ].sort();
  const changed =
    draft.semester !== current.semester || draft.academicYear !== current.academicYear;
  const canSave = changed && !!draft.semester && !!draft.academicYear && !save.isPending;
  const details: Array<[string, string, string | null | undefined]> = [
    ["id-card-outline", "Student ID", profile.studentNumber],
    ["business-outline", "Faculty", profile.faculty],
    ["git-branch-outline", "Department", profile.department],
    ["school-outline", "Programme", profile.programme],
    ["stats-chart-outline", "Year", levelLabel(profile.academicLevel)],
    ["flag-outline", "Status", profile.academicStatus === "completed" ? "Completed" : "Studying"],
  ];

  return (
    <Section title="Academic details">
      {details.map(([icon, label, value]) => (
        <Row key={label} icon={icon} tone={TONES.blue} label={label} value={value || "—"} />
      ))}
      <View style={s.termBlock}>
        <Text style={s.termLabel}>Semester</Text>
        <View style={s.chips}>
          {SEMESTERS.map(value => (
            <Chip
              key={value}
              label={`${value} semester`}
              active={draft.semester === value}
              onPress={() => setTerm({ ...draft, semester: value })}
            />
          ))}
        </View>
        <Text style={s.termLabel}>Academic year</Text>
        <View style={s.chips}>
          {years.map(value => (
            <Chip
              key={value}
              label={value}
              active={draft.academicYear === value}
              onPress={() => setTerm({ ...draft, academicYear: value })}
            />
          ))}
        </View>
        <TouchableOpacity
          style={[s.saveBtn, s.termSave, !canSave && s.saveBtnOff]}
          disabled={!canSave}
          onPress={() => save.mutate(draft)}
          accessibilityRole="button"
        >
          {save.isPending ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={s.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
        <Text style={s.switchHint}>
          To change your programme or level, contact your administrator.
        </Text>
      </View>
    </Section>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.chip, active && s.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
  tone = TONES.slate,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
  tone?: Tone;
}) {
  return (
    <TouchableOpacity
      style={[s.row, !last && s.rowBorder]}
      onPress={onPress}
      activeOpacity={onPress ? 0.65 : 1}
    >
      <View style={s.rowLeft}>
        <View style={[s.rowIcon, { backgroundColor: tone.bg }]}>
          <Ionicons name={icon as any} size={17} color={tone.fg} />
        </View>
        <Text style={s.rowLabel}>{label}</Text>
      </View>
      <View style={s.rowRight}>
        {value && (
          <Text style={s.rowValue} numberOfLines={1}>
            {value}
          </Text>
        )}
        {onPress && (
          <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const AVATAR = 92;

const s = StyleSheet.create({
  safe: { flex: 1, ...design.page },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },

  eyebrow: { ...design.eyebrow, color: colors.primary, marginBottom: 6 },
  pageTitle: { marginBottom: 18, ...design.screenTitle },

  idCard: {
    alignItems: "center",
    marginBottom: 16,
    overflow: "hidden",
    ...design.card,
  },
  cover: { width: "100%", height: 92, overflow: "hidden" },
  coverRingLg: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    right: -70,
    top: -110,
  },
  coverRingSm: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(52,211,153,0.14)",
    left: -40,
    bottom: -70,
  },
  avatarRing: {
    width: AVATAR + 8,
    height: AVATAR + 8,
    borderRadius: (AVATAR + 8) / 2,
    marginTop: -(AVATAR + 8) / 2,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...elevation.md,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 },
  cameraBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: colors.white,
  },
  avatarText: { fontSize: 34, fontWeight: "900", color: colors.white },
  idBody: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    width: "100%",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 3,
  },
  displayName: { ...design.sectionTitle, fontSize: 20 },
  pencil: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
    marginBottom: 6,
  },
  nameInput: { flex: 1, ...design.input },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnOff: { opacity: 0.45 },
  saveBtnText: { color: colors.white, fontWeight: "800", fontSize: 14 },
  emailText: { fontSize: 13, color: colors.textMuted, marginBottom: 12 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primaryLight,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  roleText: { fontSize: 12, fontWeight: "800", color: colors.primary },

  progressWrap: { borderRadius: 24, marginBottom: 22, ...elevation.brand },
  progressCard: { padding: 20, borderRadius: 24, overflow: "hidden" },
  progressRing: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    right: -70,
    top: -90,
  },
  progressCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  progressEyebrow: { ...design.eyebrow, color: "rgba(255,255,255,0.7)" },
  progressHeading: {
    fontSize: 21,
    fontWeight: "800",
    color: colors.white,
    marginTop: 4,
    letterSpacing: -0.3,
  },
  progressArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  progressStats: { flexDirection: "row", flexWrap: "wrap", rowGap: 16 },
  progressMetric: {
    width: "50%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  progressMetricValue: { color: colors.white, fontSize: 16, fontWeight: "800" },
  progressMetricLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "600",
  },
  progressLoader: { height: 84 },
  progressLink: {
    color: colors.accent,
    fontSize: 12.5,
    fontWeight: "800",
    marginTop: 18,
  },

  section: { marginBottom: 18 },
  sectionLabel: { marginBottom: 8, paddingLeft: 4, ...design.eyebrow },
  sectionCard: { overflow: "hidden", ...design.card },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  switchRow: { paddingVertical: 9 },
  switchHint: { fontSize: 11.5, color: colors.textMuted, marginTop: 2, lineHeight: 15 },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontSize: 14.5, color: colors.text, fontWeight: "600" },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  rowValue: { fontSize: 13, color: colors.textMuted, flexShrink: 1 },

  termBlock: { padding: 16, gap: 10 },
  termLabel: { fontSize: 12, fontWeight: "700", color: colors.textSub },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.textSub },
  chipTextActive: { color: colors.white },
  termSave: { marginTop: 4 },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.errorSoft,
    borderRadius: 18,
    paddingVertical: 15,
    marginTop: 4,
  },
  logoutText: { fontSize: 15, fontWeight: "700", color: colors.error },

  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  modalCard: {
    padding: 22,
    paddingTop: 12,
    paddingBottom: 34,
    gap: 12,
    ...design.sheet,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: 6,
  },
  modalHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 4,
  },
  modalIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: { ...design.sectionTitle },
  modalHint: { ...design.caption, marginTop: 3, lineHeight: 18 },
  pwInput: { ...design.input },
  pwError: { marginTop: -4, marginBottom: 4 },
  inputError: { borderColor: FIELD_ERROR_COLOR },
  modalSave: { marginTop: 6, paddingVertical: 15 },
  cancelBtn: { alignItems: "center", paddingVertical: 10 },
  cancelText: { fontSize: 15, fontWeight: "700", color: colors.textMuted },
});
