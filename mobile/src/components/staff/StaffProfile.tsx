import { design } from "../../theme/design";
import { useStaffStyles } from "../../contexts/StaffAppearance";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { elevation } from "../../theme/design";
import { gradients } from "../../theme/colors";
import { useAuth } from "../../contexts/AuthContext";
import { trpc } from "../../lib/api";
import { roleLabel } from "../../lib/roleHome";
import { pickAndUploadAvatar, resolveAvatarUri } from "../../lib/uploadAvatar";
import { colors } from "../../theme/colors";
import { BackHeader } from "../BackHeader";
import { FieldError, FIELD_ERROR_COLOR } from "../FieldError";
import { LIMITS, passwordChangeErrors, useFieldErrors, validatePersonName } from "../../lib/validation";
import {
  Card,
  FormField,
  GroupRow,
  GroupSection,
  PrimaryButton,
  SignOutButton,
  StaffScreen,
} from "./StaffUi";

export function StaffProfile() {
  const s = useStaffStyles(baseStyles);

  const router = useRouter();
  const { user, logout } = useAuth();
  const utils = trpc.useUtils();
  const account = trpc.auth.me.useQuery();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const { errors: pwErrors, check: checkPw, clear: clearPw, reset: resetPw } = useFieldErrors<"current" | "next" | "confirm">();

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: updated => {
      utils.auth.me.setData(undefined, updated as any);
      setEditing(false);
    },
    onError: err => Alert.alert("Could not save", err.message),
  });

  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      closePassword();
      Alert.alert(
        "Password updated",
        "Use your new password next time you sign in."
      );
    },
    onError: err => Alert.alert("Could not change password", err.message),
  });

  const closePassword = () => {
    setPwOpen(false);
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    resetPw();
  };

  const pickAvatar = async () => {
    try {
      setAvatarUploading(true);
      const url = await pickAndUploadAvatar(user?.id);
      if (url) await updateProfile.mutateAsync({ avatarUrl: url });
    } catch (e: any) {
      Alert.alert("Upload failed", e?.message ?? "Please try again.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const submitPassword = () => {
    if (!checkPw(passwordChangeErrors(currentPw, newPw, confirmPw))) return;
    changePassword.mutate({ currentPassword: currentPw, newPassword: newPw });
  };

  const saveName = () => {
    const error = validatePersonName(name);
    setNameError(error);
    if (!error) updateProfile.mutate({ name: name.trim().replace(/\s+/g, " ") });
  };

  const signOut = () => {
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
    <StaffScreen>
      <BackHeader
        title="Profile"
        fallback={user?.role === "admin" ? "/admin/more" : "/lecturer/more"}
      />

      <Card style={s.avatarCard}>
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.cover}
        >
          <View pointerEvents="none" style={s.coverOrbit} />
        </LinearGradient>
        <TouchableOpacity
          onPress={pickAvatar}
          activeOpacity={0.8}
          style={s.avatarRing}
        >
          {avatarUploading ? (
            <View style={s.avatar}>
              <ActivityIndicator color={colors.white} />
            </View>
          ) : user?.avatarUrl ? (
            <Image
              source={{ uri: resolveAvatarUri(user.avatarUrl) }}
              style={s.avatar}
            />
          ) : (
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {user?.name?.charAt(0).toUpperCase() ?? "?"}
              </Text>
            </View>
          )}
          <View style={s.cameraBadge}>
            <Ionicons name="camera" size={12} color={colors.white} />
          </View>
        </TouchableOpacity>

        {editing ? (
          <View style={{ width: "100%", paddingHorizontal: 20 }}>
            <FormField
              value={name}
              onChangeText={value => {
                setName(value);
                setNameError(null);
              }}
              placeholder="Your name"
              maxLength={LIMITS.name.max}
              error={nameError}
            />
            <View style={s.editActions}>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label="Cancel"
                  variant="outline"
                  onPress={() => {
                    setName(user?.name ?? "");
                    setNameError(null);
                    setEditing(false);
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label="Save"
                  loading={updateProfile.isPending}
                  onPress={saveName}
                />
              </View>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={s.nameRow} onPress={() => setEditing(true)}>
            <Text style={s.displayName}>{user?.name ?? "—"}</Text>
            <Ionicons
              name="pencil-outline"
              size={15}
              color={colors.textLight}
            />
          </TouchableOpacity>
        )}
        <Text style={s.email}>{user?.email ?? "—"}</Text>
        <View style={s.roleBadge}>
          <Ionicons
            name={
              user?.role === "admin"
                ? "shield-checkmark-outline"
                : "easel-outline"
            }
            size={12}
            color={colors.primary}
          />
          <Text style={s.roleText}>{roleLabel(user?.role)}</Text>
        </View>
      </Card>

      <GroupSection title="Account">
        <GroupRow
          icon="person-outline"
          label="Edit name"
          iconColor={colors.primary}
          iconBg={colors.primaryLight}
          onPress={() => setEditing(true)}
        />
        {account.data?.loginMethod === "local" && (
          <GroupRow
            icon="lock-closed-outline"
            label="Change password"
            iconColor={colors.violet}
            iconBg={colors.violetSoft}
            onPress={() => setPwOpen(true)}
          />
        )}
        {user?.avatarUrl && (
          <GroupRow
            icon="trash-outline"
            label="Remove photo"
            iconColor={colors.error}
            iconBg={colors.errorSoft}
            onPress={() => updateProfile.mutate({ avatarUrl: "" })}
          />
        )}
        <GroupRow
          icon="mail-outline"
          label="Email"
          iconColor={colors.info}
          iconBg={colors.infoSoft}
          value={user?.email ?? "—"}
          last
        />
      </GroupSection>

      <GroupSection title="About">
        <GroupRow
          icon="settings-outline"
          label="Settings"
          iconColor={colors.warning}
          iconBg={colors.warningSoft}
          onPress={() =>
            router.push(
              user?.role === "admin" ? "/admin/settings" : "/lecturer/settings"
            )
          }
        />
        <GroupRow
          icon="information-circle-outline"
          label="App version"
          value="1.0.0"
          last
        />
      </GroupSection>

      <SignOutButton onPress={signOut} />

      <Modal
        visible={pwOpen}
        animationType="slide"
        transparent
        onRequestClose={closePassword}
      >
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <View style={s.grabber} />
            <Text style={s.sheetTitle}>Change password</Text>
            <Text style={s.sheetHint}>
              Enter your current password, then choose a new one with at least 8
              characters, including a letter and a number.
            </Text>
            <PasswordInput
              value={currentPw}
              onChangeText={v => {
                setCurrentPw(v);
                clearPw("current");
              }}
              placeholder="Current password"
              error={pwErrors.current}
            />
            <PasswordInput
              value={newPw}
              onChangeText={v => {
                setNewPw(v);
                clearPw("next");
              }}
              placeholder="New password"
              error={pwErrors.next}
            />
            <PasswordInput
              value={confirmPw}
              onChangeText={v => {
                setConfirmPw(v);
                clearPw("confirm");
              }}
              placeholder="Confirm new password"
              error={pwErrors.confirm}
            />
            <PrimaryButton
              label="Update password"
              loading={changePassword.isPending}
              onPress={submitPassword}
            />
            <TouchableOpacity style={s.cancel} onPress={closePassword}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </StaffScreen>
  );
}

function PasswordInput({
  error,
  ...props
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  error?: string | null;
}) {
  const s = useStaffStyles(baseStyles);

  return (
    <>
      <TextInput
        style={[s.pwInput, !!error && { borderColor: FIELD_ERROR_COLOR }]}
        secureTextEntry
        autoCapitalize="none"
        maxLength={LIMITS.password.max}
        placeholderTextColor={colors.textLight}
        accessibilityLabel={props.placeholder}
        {...props}
      />
      <FieldError message={error} style={{ marginTop: -4, marginBottom: 8 }} />
    </>
  );
}

const baseStyles = StyleSheet.create({
  avatarCard: {
    alignItems: "center",
    padding: 0,
    paddingBottom: 22,
    marginBottom: 20,
    ...design.card,
  },
  cover: {
    alignSelf: "stretch",
    height: 88,
    borderTopLeftRadius: 17,
    borderTopRightRadius: 17,
    overflow: "hidden",
  },
  coverOrbit: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    right: -60,
    top: -90,
  },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 4,
    borderColor: colors.surface,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -46,
    marginBottom: 12,
    ...elevation.md,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 32, fontWeight: "900", color: colors.white },
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
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  displayName: { ...design.sectionTitle },
  editActions: { flexDirection: "row", gap: 10, marginBottom: 8 },
  email: { marginBottom: 10, ...design.caption },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  roleText: { fontSize: 12, fontWeight: "700", color: colors.primary },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  sheet: {
    padding: 24,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 10,
    ...design.sheet,
  },
  grabber: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: 8,
  },
  sheetTitle: { ...design.sectionTitle, fontSize: 20, lineHeight: 26 },
  sheetHint: { marginBottom: 6, ...design.body },
  pwInput: { ...design.input },
  cancel: { alignItems: "center", paddingVertical: 10 },
  cancelText: { fontSize: 15, fontWeight: "700", color: colors.textMuted },
});
