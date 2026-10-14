import { design } from "../../../theme/design";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../contexts/AuthContext";
import { trpc } from "../../../lib/api";
import { roleLabel } from "../../../lib/roleHome";
import { colors } from "../../../theme/colors";
import { Badge, ChipSelect, formatDate } from "../StaffUi";
import { ActionRow, DetailRow, ReasonForm, Sheet } from "./AdminKit";
import { StudentAcademicEditor, studentAcademicLine } from "./AcademicKit";
import { levelLabel } from "../../../../../shared/academics";

export type UserSummary = {
  id: number;
  name: string | null;
  email: string | null;
  role: string;
  isBanned: boolean;
  createdAt?: Date | string | null;
  lastSignedIn?: Date | string | null;
  quizzesAttempted?: number | null;
  averageQuizScore?: number | null;
};

type Mode = "detail" | "ban" | "delete" | "role" | "reset" | "logout" | "academic";
type EditableRole = "user" | "lecturer";

export function UserDetailSheet({
  target,
  onClose,
}: {
  target: UserSummary | null;
  onClose: () => void;
}) {
  const { user: me } = useAuth();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<Mode>("detail");
  const [nextRole, setNextRole] = useState<EditableRole>("lecturer");

  const detail = trpc.admin.getUserDetail.useQuery(
    { userId: target?.id ?? 0 },
    { enabled: !!target, retry: false }
  );

  useEffect(() => {
    setMode("detail");
    setNextRole(target?.role === "lecturer" ? "user" : "lecturer");
  }, [target?.id, target?.role]);

  const u = detail.data?.user ?? target;
  const stats = detail.data?.stats;
  const academic = detail.data?.academic ?? null;
  const isStudent = u?.role === "user";
  const isSelf = !!target && target.id === me?.id;
  const canChangeRole = !!u && (u.role === "user" || u.role === "lecturer");

  const refresh = () =>
    Promise.all([
      utils.admin.listUsers.invalidate(),
      utils.admin.getUserDetail.invalidate(),
      utils.admin.getAcademicPerformance.invalidate(),
      utils.admin.getDashboardMetrics.invalidate(),
    ]);
  const fail = (err: { message: string }) =>
    Alert.alert("Action failed", err.message);

  const toggleBan = trpc.admin.toggleUserBan.useMutation({
    onSuccess: updated => {
      void refresh();
      onClose();
      Alert.alert(
        updated.isBanned ? "Account suspended" : "Account restored",
        `${updated.name ?? "The user"} has been ${updated.isBanned ? "suspended" : "restored"}.`
      );
    },
    onError: fail,
  });
  const deleteUser = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      void refresh();
      onClose();
      Alert.alert(
        "User deleted",
        `${target?.name ?? "The account"} was permanently deleted.`
      );
    },
    onError: fail,
  });
  const updateRole = trpc.admin.updateUserRole.useMutation({
    onSuccess: updated => {
      void refresh();
      setMode("detail");
      Alert.alert(
        "Role updated",
        `${updated.name ?? "The user"} is now a ${roleLabel(updated.role).toLowerCase()}.`
      );
    },
    onError: fail,
  });
  const resetPassword = trpc.admin.requestPasswordReset.useMutation({
    onSuccess: () => {
      setMode("detail");
      Alert.alert(
        "Reset link sent",
        `A password reset link was sent to ${u?.email ?? "the user"}. It expires in 1 hour.`
      );
    },
    onError: fail,
  });
  const forceLogout = trpc.admin.settings.forceLogoutUser.useMutation({
    onSuccess: () => {
      setMode("detail");
      Alert.alert(
        "Signed out everywhere",
        `${u?.name ?? "The user"} must sign in again on every device.`
      );
    },
    onError: fail,
  });

  const name = u?.name ?? "Unnamed user";
  const titles: Record<Mode, string> = {
    detail: "User details",
    ban: u?.isBanned ? "Restore account" : "Suspend account",
    delete: "Delete account",
    role: "Change role",
    reset: "Send password reset",
    logout: "Sign out everywhere",
    academic: "Programme and year",
  };
  const hints: Record<Mode, string | null> = {
    detail: null,
    ban: u?.isBanned
      ? `${name} will be able to sign in again.`
      : `${name} will be signed out and blocked from signing in.`,
    delete: `This permanently removes ${name} and their data. This cannot be undone.`,
    role: `Choose the new role for ${name}. They will see the matching portal next time they sign in.`,
    reset: `${name} will receive an email with a one-hour reset link. Only available for email/password accounts.`,
    logout: `Every active session for ${name} is invalidated on web and mobile. They can sign in again straight away.`,
    academic: `Students can't change their programme or level themselves. Set ${name}'s here; the change is audited.`,
  };

  const back = (
    <TouchableOpacity style={st.back} onPress={() => setMode("detail")}>
      <Ionicons name="arrow-back" size={16} color={colors.primary} />
      <Text style={st.backText}>Back to details</Text>
    </TouchableOpacity>
  );

  return (
    <Sheet
      visible={!!target}
      title={titles[mode]}
      hint={hints[mode]}
      onClose={onClose}
    >
      {mode === "detail" && u ? (
        <>
          <View style={st.identity}>
            <View
              style={[
                st.avatar,
                u.isBanned && { backgroundColor: colors.error },
              ]}
            >
              <Text style={st.avatarText}>{name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.name} numberOfLines={1}>
                {name}
              </Text>
              <Text style={st.email} numberOfLines={1} selectable>
                {u.email ?? "No email"}
              </Text>
              <View style={st.badges}>
                <Badge
                  label={roleLabel(u.role)}
                  tone={
                    u.role === "admin"
                      ? "grey"
                      : u.role === "lecturer"
                        ? "blue"
                        : "green"
                  }
                />
                <Badge
                  label={u.isBanned ? "Suspended" : "Active"}
                  tone={u.isBanned ? "red" : "green"}
                />
              </View>
            </View>
          </View>

          <DetailRow label="Joined" value={formatDate(u.createdAt) || "—"} />
          <DetailRow
            label="Last signed in"
            value={formatDate(u.lastSignedIn) || "Never"}
          />
          {target?.averageQuizScore != null ? (
            <DetailRow
              label="Engagement score"
              value={`${Math.round(target.averageQuizScore)}%`}
            />
          ) : null}
          {target?.quizzesAttempted != null ? (
            <DetailRow
              label="Quizzes attempted"
              value={String(target.quizzesAttempted)}
            />
          ) : null}
          {detail.isLoading ? (
            <ActivityIndicator
              color={colors.primary}
              style={{ marginVertical: 12 }}
            />
          ) : stats ? (
            <>
              <DetailRow
                label="Courses enrolled"
                value={String(stats.courses ?? 0)}
              />
              <DetailRow
                label="Quiz average"
                value={`${Math.round(stats.quizAverage ?? 0)}%`}
              />
              <DetailRow
                label="Study time"
                value={`${Math.round(stats.studyMinutes ?? 0)} min`}
              />
            </>
          ) : detail.error ? (
            <Text style={st.note}>
              Extended stats unavailable: {detail.error.message}
            </Text>
          ) : null}
          {isStudent && detail.data ? (
            <>
              <DetailRow
                label="Student ID"
                value={academic?.studentNumber || "—"}
              />
              <DetailRow
                label="Programme"
                value={academic?.programme || "Not set"}
              />
              <DetailRow label="Year" value={levelLabel(academic?.level)} />
              <DetailRow
                label="Term"
                value={
                  academic?.semester
                    ? `${academic.semester} semester ${academic.academicYear ?? ""}`.trim()
                    : "—"
                }
              />
              <DetailRow
                label="Study status"
                value={academic?.status === "completed" ? "Completed" : "Studying"}
              />
            </>
          ) : null}

          {isSelf ? (
            <Text style={st.note}>
              You can't moderate your own account. Use Profile to update your
              details.
            </Text>
          ) : (
            <View style={{ marginTop: 10 }}>
              {isStudent && detail.data ? (
                <ActionRow
                  icon="school-outline"
                  label="Set programme and year"
                  hint={studentAcademicLine(academic)}
                  onPress={() => setMode("academic")}
                />
              ) : null}
              <ActionRow
                icon="key-outline"
                label="Send password reset"
                hint="Email a one-hour reset link"
                onPress={() => setMode("reset")}
              />
              <ActionRow
                icon="log-out-outline"
                label="Sign out everywhere"
                hint="End all of this user's sessions"
                onPress={() => setMode("logout")}
              />
              {canChangeRole ? (
                <ActionRow
                  icon="swap-horizontal-outline"
                  label="Change role"
                  hint={`Currently ${roleLabel(u.role).toLowerCase()}`}
                  onPress={() => setMode("role")}
                />
              ) : null}
              <ActionRow
                icon={u.isBanned ? "shield-checkmark-outline" : "ban-outline"}
                label={u.isBanned ? "Restore account" : "Suspend account"}
                hint={
                  u.isBanned
                    ? "Allow this user to sign in again"
                    : "Block sign-in until restored"
                }
                onPress={() => setMode("ban")}
              />
              <ActionRow
                icon="trash-outline"
                label="Delete account"
                hint="Permanent — requires a reason"
                danger
                onPress={() => setMode("delete")}
              />
            </View>
          )}
        </>
      ) : null}

      {mode === "ban" && target ? (
        <>
          {back}
          <ReasonForm
            confirmLabel={u?.isBanned ? "Restore account" : "Suspend account"}
            variant={u?.isBanned ? "solid" : "danger"}
            loading={toggleBan.isPending}
            resetKey={mode}
            onSubmit={reason => toggleBan.mutate({ userId: target.id, reason })}
          />
        </>
      ) : null}

      {mode === "role" && target ? (
        <>
          {back}
          <ChipSelect<EditableRole>
            value={nextRole}
            onChange={setNextRole}
            options={[
              { value: "user", label: "Student" },
              { value: "lecturer", label: "Lecturer" },
            ]}
          />
          <ReasonForm
            confirmLabel={`Make ${roleLabel(nextRole).toLowerCase()}`}
            loading={updateRole.isPending}
            disabled={nextRole === u?.role}
            resetKey={mode}
            onSubmit={reason =>
              updateRole.mutate({ userId: target.id, role: nextRole, reason })
            }
          />
        </>
      ) : null}

      {mode === "academic" && target ? (
        <>
          {back}
          <StudentAcademicEditor
            key={target.id}
            userId={target.id}
            academic={academic}
            onSaved={() => setMode("detail")}
          />
        </>
      ) : null}

      {mode === "reset" && target ? (
        <>
          {back}
          <ReasonForm
            confirmLabel="Send reset link"
            loading={resetPassword.isPending}
            initialReason="User requested password assistance"
            resetKey={mode}
            onSubmit={reason =>
              resetPassword.mutate({ userId: target.id, reason })
            }
          />
        </>
      ) : null}

      {mode === "logout" && target ? (
        <>
          {back}
          <ReasonForm
            confirmLabel="Sign out everywhere"
            variant="danger"
            loading={forceLogout.isPending}
            resetKey={mode}
            onSubmit={reason =>
              forceLogout.mutate({ userId: target.id, reason })
            }
          />
        </>
      ) : null}

      {mode === "delete" && target ? (
        <>
          {back}
          <ReasonForm
            confirmLabel="Delete permanently"
            variant="danger"
            loading={deleteUser.isPending}
            resetKey={mode}
            onSubmit={reason =>
              Alert.alert(
                "Delete account?",
                `Delete ${name}? This is permanent.`,
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () =>
                      deleteUser.mutate({ userId: target.id, reason }),
                  },
                ]
              )
            }
          />
        </>
      ) : null}
    </Sheet>
  );
}

const st = StyleSheet.create({
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 8,
    ...design.card,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.white, fontWeight: "800", fontSize: 20 },
  name: { ...design.sectionTitle },
  email: { marginTop: 2, ...design.caption },
  badges: { flexDirection: "row", gap: 6, marginTop: 8 },
  note: { marginTop: 12, ...design.body },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  backText: { fontSize: 13, fontWeight: "700", color: colors.primary },
});
