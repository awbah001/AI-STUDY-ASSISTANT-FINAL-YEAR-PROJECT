import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { trpc } from "../../src/lib/api";
import { roleLabel } from "../../src/lib/roleHome";
import { ALLOWED_EMAIL_DOMAIN } from "../../src/lib/emailDomain";
import {
  LIMITS,
  useFieldErrors,
  validateEmail,
  validateNewPassword,
  validatePersonName,
} from "../../src/lib/validation";import { colors } from "../../src/theme/colors";
import {
  Badge,
  ChipSelect,
  EmptyState,
  formatDate,
  FormField,
  ListItem,
  Loading,
  PrimaryButton,
  StaffHeader,
  StaffScreen,
} from "../../src/components/staff/StaffUi";
import {
  FilterLabel,
  MetricGrid,
  MetricTile,
  Pager,
  PasswordField,
  SearchBox,
  Sheet,
} from "../../src/components/staff/admin/AdminKit";
import {
  UserDetailSheet,
  type UserSummary,
} from "../../src/components/staff/admin/UserDetailSheet";

type RoleFilter = "all" | "user" | "lecturer" | "admin";
type StatusFilter = "all" | "active" | "banned";

type NewRole = "user" | "lecturer";

const PAGE_SIZE = 20;
const EMPTY_FORM = { name: "", email: "", password: "" };

function isRoleFilter(value: unknown): value is RoleFilter {
  return (
    value === "all" ||
    value === "user" ||
    value === "lecturer" ||
    value === "admin"
  );
}

export default function AdminUsers() {
  const { user: me } = useAuth();
  const utils = trpc.useUtils();
  const params = useLocalSearchParams<{ role?: string }>();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<UserSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [newRole, setNewRole] = useState<NewRole>("user");
  const [form, setForm] = useState(EMPTY_FORM);
  const { errors, check, clear, reset } = useFieldErrors<"name" | "email" | "password">();

  useEffect(() => {
    if (isRoleFilter(params.role)) {
      setRole(params.role);
      setPage(1);
    }
  }, [params.role]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const users = trpc.admin.listUsers.useQuery({
    page,
    pageSize: PAGE_SIZE,
    search: debounced,
    role: role === "all" ? undefined : role,
    status: status === "all" ? undefined : status,
  });
  const allSummary = trpc.admin.listUsers.useQuery({
    page: 1,
    pageSize: 1,
    search: "",
  });
  const studentSummary = trpc.admin.listUsers.useQuery({
    page: 1,
    pageSize: 1,
    search: "",
    role: "user",
  });
  const lecturerSummary = trpc.admin.listUsers.useQuery({
    page: 1,
    pageSize: 1,
    search: "",
    role: "lecturer",
  });
  const activeSummary = trpc.admin.listUsers.useQuery({
    page: 1,
    pageSize: 1,
    search: "",
    status: "active",
  });

  const totalUsers = allSummary.data?.total ?? 0;
  const activeUsers = activeSummary.data?.total ?? 0;
  const activePct = totalUsers
    ? Math.round((activeUsers / totalUsers) * 100)
    : 0;

  const createUser = trpc.admin.createUser.useMutation({
    onSuccess: created => {
      setCreating(false);
      setForm(EMPTY_FORM);
      void utils.admin.listUsers.invalidate();
      Alert.alert(
        `${roleLabel(created.role)} created`,
        `An account was created for ${created.name ?? created.email}. Share the email and password with them securely; they can change the password after signing in.`
      );
    },
    onError: err => Alert.alert("Could not create account", err.message),
  });

  const setField = (key: keyof typeof EMPTY_FORM) => (value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    clear(key);
  };

  const openCreate = () => {
    setNewRole(role === "lecturer" ? "lecturer" : "user");
    setForm(EMPTY_FORM);
    reset();
    setCreating(true);
  };

  const emptyText = debounced
    ? "No users match your search."
    : role === "lecturer"
      ? "No lecturer accounts yet. Tap Add user to create one."
      : role === "user"
        ? "No student accounts yet. Tap Add user to create one."
        : "No users match these filters.";

  return (
    <StaffScreen
      onRefresh={() =>
        Promise.all([
          users.refetch(),
          allSummary.refetch(),
          studentSummary.refetch(),
          lecturerSummary.refetch(),
          activeSummary.refetch(),
        ])
      }
    >
      <StaffHeader
        title="Users"
        subtitle={`${totalUsers} accounts on the platform.`}
      />

      <MetricGrid>
        <MetricTile
          icon="people-outline"
          label="Total users"
          value={totalUsers}
          hint="All registered"
          accent={colors.primary}
          accentBg={colors.primaryLight}
          onPress={() => {
            setRole("all");
            setStatus("all");
            setPage(1);
          }}
        />
        <MetricTile
          icon="school-outline"
          label="Students"
          value={studentSummary.data?.total ?? 0}
          hint="Created by admins"
          accent="#0284c7"
          accentBg={colors.infoSoft}
          onPress={() => {
            setRole("user");
            setPage(1);
          }}
        />
        <MetricTile
          icon="easel-outline"
          label="Lecturers"
          value={lecturerSummary.data?.total ?? 0}
          hint="Created by admins"
          accent="#800020"
          accentBg={colors.violetSoft}
          onPress={() => {
            setRole("lecturer");
            setPage(1);
          }}
        />
        <MetricTile
          icon="pulse-outline"
          label="Active users"
          value={activeUsers}
          hint={`${activePct}% active`}
          accent="#ea580c"
          accentBg={colors.warningSoft}
          onPress={() => {
            setStatus("active");
            setPage(1);
          }}
        />
      </MetricGrid>

      <View style={st.addRow}>
        <PrimaryButton
          label="Add user"
          icon="person-add-outline"
          onPress={openCreate}
        />
      </View>

      <SearchBox
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name or email"
      />
      <FilterLabel>Role</FilterLabel>
      <ChipSelect<RoleFilter>
        value={role}
        onChange={value => {
          setRole(value);
          setPage(1);
        }}
        options={[
          { value: "all", label: "All roles" },
          {
            value: "user",
            label: `Students (${studentSummary.data?.total ?? 0})`,
          },
          {
            value: "lecturer",
            label: `Lecturers (${lecturerSummary.data?.total ?? 0})`,
          },
          { value: "admin", label: "Admins" },
        ]}
      />
      <FilterLabel>Status</FilterLabel>
      <ChipSelect<StatusFilter>
        value={status}
        onChange={value => {
          setStatus(value);
          setPage(1);
        }}
        options={[
          { value: "all", label: "All status" },
          { value: "active", label: "Active" },
          { value: "banned", label: "Suspended" },
        ]}
      />

      {users.isLoading ? (
        <Loading />
      ) : users.error ? (
        <EmptyState icon="alert-circle-outline" text={users.error.message} />
      ) : !users.data?.items.length ? (
        <EmptyState icon="people-outline" text={emptyText} />
      ) : (
        users.data.items.map(item => (
          <ListItem
            key={item.id}
            icon={
              item.role === "admin"
                ? "shield-checkmark"
                : item.role === "lecturer"
                  ? "easel"
                  : "school"
            }
            iconBg={item.isBanned ? "#fef2f2" : colors.primaryLight}
            iconColor={item.isBanned ? colors.error : colors.primary}
            title={`${item.name ?? "Unnamed user"}${item.id === me?.id ? " (you)" : ""}`}
            subtitle={item.email}
            meta={`${roleLabel(item.role)} · ${Math.round(item.averageQuizScore ?? 0)}% engagement · ${item.quizzesAttempted ?? 0} quizzes · Joined ${formatDate(item.createdAt)}${item.lastSignedIn ? ` · Last seen ${formatDate(item.lastSignedIn)}` : ""}`}
            right={
              <Badge
                label={item.isBanned ? "Suspended" : "Active"}
                tone={item.isBanned ? "red" : "green"}
              />
            }
            onPress={() =>
              setTarget({
                id: item.id,
                name: item.name,
                email: item.email,
                role: item.role,
                isBanned: Boolean(item.isBanned),
                createdAt: item.createdAt,
                lastSignedIn: item.lastSignedIn,
                quizzesAttempted: item.quizzesAttempted,
                averageQuizScore: item.averageQuizScore,
              })
            }
          />
        ))
      )}

      {!!users.data && (
        <Pager
          page={page}
          pageSize={PAGE_SIZE}
          total={users.data.total}
          onChange={setPage}
        />
      )}

      <UserDetailSheet target={target} onClose={() => setTarget(null)} />

      <Sheet
        visible={creating}
        title={`Create ${newRole === "lecturer" ? "lecturer" : "student"} account`}
        hint={
          newRole === "lecturer"
            ? "Lecturers can then be assigned courses from Academic."
            : "Students complete their academic profile the first time they sign in."
        }
        onClose={() => setCreating(false)}
        cancelLabel="Cancel"
      >
        <FilterLabel>Account type</FilterLabel>
        <ChipSelect<NewRole>
          value={newRole}
          onChange={setNewRole}
          options={[
            { value: "user", label: "Student" },
            { value: "lecturer", label: "Lecturer" },
          ]}
        />
        <FormField
          label="Full name"
          value={form.name}
          onChangeText={setField("name")}
          placeholder={newRole === "lecturer" ? "Dr. John Smith" : "Jane Doe"}
          maxLength={LIMITS.name.max}
          error={errors.name}
        />
        <FormField
          label="Email"
          value={form.email}
          onChangeText={setField("email")}
          placeholder={`${newRole === "lecturer" ? "lecturer" : "student"}@${ALLOWED_EMAIL_DOMAIN}`}
          keyboardType="email-address"
          autoCapitalize="none"
          maxLength={LIMITS.email}
          error={errors.email}
        />
        <PasswordField
          label="Temporary password"
          value={form.password}
          onChangeText={setField("password")}
          placeholder="Min. 8 characters, with a letter and a number"
          error={errors.password}
        />
        <PrimaryButton
          label={`Create ${newRole === "lecturer" ? "lecturer" : "student"} account`}
          loading={createUser.isPending}
          onPress={() => {
            const ok = check({
              name: validatePersonName(form.name, "Full name"),
              email: validateEmail(form.email),
              password: validateNewPassword(form.password),
            });
            if (!ok) return;
            createUser.mutate({
              name: form.name.trim().replace(/\s+/g, " "),
              email: form.email.trim(),
              password: form.password,
              role: newRole,
            });
          }}
        />
      </Sheet>
    </StaffScreen>
  );
}

const st = StyleSheet.create({
  addRow: { marginBottom: 16 },
});
