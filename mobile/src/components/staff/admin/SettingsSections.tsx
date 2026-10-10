import { useState } from "react";
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "../../../lib/api";
import { useAuth } from "../../../contexts/AuthContext";
import { colors } from "../../../theme/colors";
import {
  ChipSelect,
  EmptyState,
  FormField,
  Loading,
  PrimaryButton,
} from "../StaffUi";
import {
  DetailRow,
  formatBytes,
  formatDateTime,
  InlineButton,
  timeAgo,
} from "./AdminKit";
import { shareText, toCsv } from "../lecturer-workspace/helpers";
import {
  LIMITS,
  MESSAGES,
  useFieldErrors,
  validateEmail,
  validatePersonName,
  validatePhone,
  validateText,
  validateTotpCode,
} from "../../../lib/validation";
import {
  ConfirmSheet,
  monoFont,
  NumberSetting,
  SaveBar,
  SettingsCard,
  StatusRow,
  TextSetting,
  ToggleSetting,
  useDraft,
  type SaveSettings,
  type SettingsMe,
  type SystemSettings,
} from "./SettingsKit";

type SaveProps = {
  settings: SystemSettings;
  save: SaveSettings;
  saving: boolean;
};

const fail = (title: string) => (err: { message: string }) =>
  Alert.alert(title, err.message);

const NOTIFICATION_LABELS: Record<string, string> = {
  email: "Email notifications",
  inApp: "In-app notifications",
  security: "Security alerts",
  system: "System alerts",
  users: "User activity",
  ai: "AI service alerts",
};

const FEATURE_LABELS: Record<string, string> = {
  aiChat: "AI chat",
  documentQa: "Document Q&A",
  flashcards: "Flashcards",
  quizGeneration: "Quiz generation",
  assignmentAssistance: "Assignment assistance",
  studyPlanner: "Study planner",
  voiceInput: "Voice input",
  voiceOutput: "Voice output",
  summarization: "Summarization",
  mobile: "Mobile app access",
  beta: "Beta features",
  debugMode: "Debug mode",
};

const ROLE_TITLES: Record<"admin" | "lecturer" | "user", string> = {
  admin: "Admin",
  lecturer: "Lecturer",
  user: "Student",
};

/* ─── Account ─────────────────────────────────────────────────────────── */

export function AccountSection({
  me,
  onChanged,
}: {
  me: SettingsMe;
  onChanged: () => void;
}) {
  const utils = trpc.useUtils();
  const profile = useDraft({
    name: me.name ?? "",
    email: me.email ?? "",
    phone: me.phone ?? "",
    jobTitle: me.jobTitle ?? "",
  });
  const update = trpc.admin.settings.updateAccount.useMutation({
    onSuccess: () => {
      void utils.auth.me.invalidate();
      onChanged();
      Alert.alert("Profile updated", "Your account details were saved.");
    },
    onError: fail("Could not update profile"),
  });

  const prefs = trpc.admin.settings.preferences.useQuery();
  const current = prefs.data?.notifications ?? {};
  const notifications = useDraft(
    Object.fromEntries(
      Object.keys(NOTIFICATION_LABELS).map(key => [key, current[key] ?? true])
    ) as Record<string, boolean>
  );
  const savePrefs = trpc.admin.settings.savePreferences.useMutation({
    onSuccess: () => {
      void prefs.refetch();
      Alert.alert(
        "Preferences saved",
        "Your notification preferences were updated."
      );
    },
    onError: fail("Could not save preferences"),
  });

  const { errors, check, clear, reset } = useFieldErrors<
    "name" | "email" | "phone" | "jobTitle"
  >();
  const setProfile = (key: "name" | "email" | "phone" | "jobTitle", value: string) => {
    profile.set(key, value);
    clear(key);
  };
  const saveProfile = () => {
    const d = profile.draft;
    const ok = check({
      name: validatePersonName(d.name, "Full name"),
      email: validateEmail(d.email),
      phone: validatePhone(d.phone),
      jobTitle: validateText(d.jobTitle, { label: "Job title", required: false, max: LIMITS.shortText }),
    });
    if (!ok) return;
    update.mutate({
      name: d.name.trim(),
      phone: d.phone.trim(),
      jobTitle: d.jobTitle.trim(),
      ...(d.email.trim().toLowerCase() !== (me.email ?? "").toLowerCase()
        ? { email: d.email.trim() }
        : {}),
    });
  };

  return (
    <>
      <SettingsCard
        title="Profile details"
        description="Shown to other administrators and in audit records. Photo and password are under Profile."
      >
        <TextSetting
          label="Full name"
          value={profile.draft.name}
          onChange={v => setProfile("name", v)}
          maxLength={LIMITS.name.max}
          error={errors.name}
        />
        <TextSetting
          label="Email"
          value={profile.draft.email}
          onChange={v => setProfile("email", v)}
          hint="Changing your email is recorded in the audit log."
          maxLength={LIMITS.email}
          error={errors.email}
        />
        <TextSetting
          label="Phone"
          value={profile.draft.phone}
          onChange={v => setProfile("phone", v)}
          placeholder="Optional"
          maxLength={20}
          error={errors.phone}
        />
        <TextSetting
          label="Job title"
          value={profile.draft.jobTitle}
          onChange={v => setProfile("jobTitle", v)}
          placeholder="e.g. Systems Administrator"
          maxLength={LIMITS.shortText}
          error={errors.jobTitle}
        />
        <DetailRow
          label="Role"
          value={me.isSuperAdmin ? "Super Admin" : "Admin"}
        />
        <DetailRow label="Member since" value={formatDateTime(me.createdAt)} />
        <SaveBar
          dirty={profile.dirty}
          saving={update.isPending}
          onSave={saveProfile}
          onReset={() => {
            profile.reset();
            reset();
          }}
        />
      </SettingsCard>

      <SettingsCard
        title="My notifications"
        description="Choose which alerts you receive as an administrator."
      >
        {prefs.isLoading ? (
          <Loading />
        ) : (
          Object.keys(NOTIFICATION_LABELS).map(key => (
            <ToggleSetting
              key={key}
              label={NOTIFICATION_LABELS[key]}
              value={notifications.draft[key] ?? true}
              onChange={v => notifications.set(key, v)}
            />
          ))
        )}
        <SaveBar
          dirty={notifications.dirty}
          saving={savePrefs.isPending}
          onSave={() =>
            savePrefs.mutate({ notifications: notifications.draft })
          }
          onReset={notifications.reset}
        />
      </SettingsCard>
    </>
  );
}

/* ─── Security ────────────────────────────────────────────────────────── */

export function SecuritySection({
  me,
  onChanged,
  ...saveProps
}: SaveProps & { me: SettingsMe; onChanged: () => void }) {
  return (
    <>
      <TwoFactorCard enabled={me.totpEnabled} onChanged={onChanged} />
      <PasswordPolicyCard {...saveProps} />
      <SessionsCard />
      <SecurityLogsCard />
    </>
  );
}

function TwoFactorCard({
  enabled,
  onChanged,
}: {
  enabled: boolean;
  onChanged: () => void;
}) {
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(
    null
  );
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<string[] | null>(null);

  const changeCode = (value: string) => {
    setCode(value);
    setCodeError(null);
  };
  const withCode = (run: (code: string) => void, authenticatorOnly = false) => {
    const cleaned = code.replace(/\s+/g, "");
    const error = authenticatorOnly
      ? /^\d{6}$/.test(cleaned)
        ? null
        : MESSAGES.codeInvalid
      : validateTotpCode(cleaned);
    setCodeError(error);
    if (!error) run(cleaned);
  };

  const start = trpc.admin.settings.totpStart.useMutation({
    onSuccess: setSetup,
    onError: fail("Could not start setup"),
  });
  const confirm = trpc.admin.settings.totpConfirm.useMutation({
    onSuccess: res => {
      setSetup(null);
      setCode("");
      setRecovery(res.recoveryCodes);
      onChanged();
    },
    onError: fail("Could not enable two-factor"),
  });
  const disable = trpc.admin.settings.totpDisable.useMutation({
    onSuccess: () => {
      setCode("");
      setRecovery(null);
      onChanged();
      Alert.alert(
        "Two-factor turned off",
        "You will only need your password to sign in."
      );
    },
    onError: fail("Could not turn off two-factor"),
  });
  const regenerate = trpc.admin.settings.totpRegenerate.useMutation({
    onSuccess: res => {
      setCode("");
      setRecovery(res.recoveryCodes);
    },
    onError: fail("Could not create new codes"),
  });

  const openAuthenticator = () => {
    if (!setup) return;
    void Linking.openURL(setup.uri).catch(() =>
      Alert.alert(
        "No authenticator app",
        "Install an authenticator app, or add the setup key manually."
      )
    );
  };

  return (
    <SettingsCard
      title="Two-factor authentication"
      description={
        enabled
          ? "On. You'll be asked for an authenticator code whenever you sign in."
          : "Off. Add a second step to protect your admin account."
      }
    >
      {recovery ? (
        <View style={st.recovery}>
          <Text style={st.recoveryTitle}>Recovery codes</Text>
          <Text style={st.recoveryHint}>
            Store these somewhere safe. Each code works once if you lose your
            authenticator.
          </Text>
          {recovery.map(c => (
            <Text key={c} style={st.mono} selectable>
              {c}
            </Text>
          ))}
          <View style={st.row}>
            <InlineButton
              label="Share codes"
              icon="share-outline"
              onPress={() =>
                void shareText("AI Learning Assistant recovery codes", recovery.join("\n"))
              }
            />
            <InlineButton
              label="Done"
              icon="checkmark"
              tone="muted"
              onPress={() => setRecovery(null)}
            />
          </View>
        </View>
      ) : null}

      {!enabled && !setup ? (
        <PrimaryButton
          label="Set up two-factor"
          icon="shield-checkmark-outline"
          loading={start.isPending}
          onPress={() => start.mutate()}
        />
      ) : null}

      {!enabled && setup ? (
        <>
          <Text style={st.body}>
            Add this setup key to your authenticator app, then enter the 6-digit
            code it shows.
          </Text>
          <Text style={[st.mono, st.secret]} selectable>
            {setup.secret}
          </Text>
          <View style={[st.row, { marginBottom: 12 }]}>
            <InlineButton
              label="Open authenticator"
              icon="open-outline"
              onPress={openAuthenticator}
            />
            <InlineButton
              label="Share key"
              icon="share-outline"
              tone="muted"
              onPress={() =>
                void shareText("AI Learning Assistant 2FA setup key", setup.secret)
              }
            />
          </View>
          <FormField
            label="Authenticator code"
            value={code}
            onChangeText={changeCode}
            placeholder="123456"
            keyboardType="numeric"
            maxLength={6}
            error={codeError}
          />
          <PrimaryButton
            label="Turn on two-factor"
            loading={confirm.isPending}
            onPress={() => withCode(c => confirm.mutate({ code: c }), true)}
          />
          <InlineButton
            label="Cancel setup"
            tone="muted"
            onPress={() => {
              setSetup(null);
              changeCode("");
            }}
          />
        </>
      ) : null}

      {enabled ? (
        <>
          <FormField
            label="Authenticator or recovery code"
            value={code}
            onChangeText={changeCode}
            placeholder="Required for the actions below"
            autoCapitalize="none"
            maxLength={64}
            error={codeError}
          />
          <View style={st.row}>
            <InlineButton
              label="New recovery codes"
              icon="refresh"
              disabled={regenerate.isPending}
              onPress={() => withCode(c => regenerate.mutate({ code: c }), true)}
            />
            <InlineButton
              label="Turn off"
              icon="close-circle-outline"
              tone="danger"
              disabled={disable.isPending}
              onPress={() =>
                withCode(c =>
                  Alert.alert(
                    "Turn off two-factor?",
                    "Your account will be protected by your password only.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Turn off",
                        style: "destructive",
                        onPress: () => disable.mutate({ code: c }),
                      },
                    ]
                  )
                )
              }
            />
          </View>
        </>
      ) : null}
    </SettingsCard>
  );
}

function PasswordPolicyCard({ settings, save, saving }: SaveProps) {
  const { draft, set, dirty, reset } = useDraft(settings.passwordPolicy);
  return (
    <SettingsCard
      title="Password policy"
      description="Applies to new accounts and password changes."
    >
      <NumberSetting
        label="Minimum password length"
        value={draft.minLength}
        onChange={v => set("minLength", v)}
        hint="At least 8 characters is recommended."
      />
      <SaveBar
        dirty={dirty}
        saving={saving}
        onReset={reset}
        onSave={() =>
          draft.minLength < 8
            ? Alert.alert("Too short", "The minimum length must be 8 or more.")
            : save({ passwordPolicy: draft })
        }
      />
    </SettingsCard>
  );
}

function SessionsCard() {
  const { user, login } = useAuth();
  const session = trpc.admin.settings.session.useQuery();
  const revoke = trpc.admin.settings.revokeOtherSessions.useMutation({
    onSuccess: async res => {
      if (res.token && user) await login(res.token, user);
      Alert.alert(
        "Signed out",
        "Every other device has been signed out. This phone stays signed in."
      );
    },
    onError: fail("Could not sign out other devices"),
  });
  return (
    <SettingsCard title="Sessions" description={session.data?.note}>
      {session.isLoading ? (
        <Loading />
      ) : session.data ? (
        <>
          <DetailRow label="This device" value="AI Learning Assistant mobile app" />
          <DetailRow
            label="Sign-in method"
            value={session.data.current.loginMethod ?? "—"}
          />
          <DetailRow
            label="Last active"
            value={formatDateTime(session.data.current.lastActive)}
          />
        </>
      ) : null}
      <View style={{ marginTop: 10 }}>
        <PrimaryButton
          label="Sign out all other devices"
          icon="log-out-outline"
          variant="outline"
          loading={revoke.isPending}
          onPress={() =>
            Alert.alert(
              "Sign out other devices?",
              "Every other browser and phone signed in to your account will be signed out.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Sign out",
                  style: "destructive",
                  onPress: () => revoke.mutate(),
                },
              ]
            )
          }
        />
      </View>
    </SettingsCard>
  );
}

function SecurityLogsCard() {
  const logs = trpc.admin.settings.securityLogs.useQuery();
  const [showAll, setShowAll] = useState(false);
  const rows = logs.data ?? [];
  const visible = showAll ? rows : rows.slice(0, 8);
  return (
    <SettingsCard
      title="Security logs"
      description="Recent sign-in, password, session and two-factor events."
    >
      {logs.isLoading ? (
        <Loading />
      ) : logs.error ? (
        <EmptyState icon="alert-circle-outline" text={logs.error.message} />
      ) : !rows.length ? (
        <EmptyState icon="shield-outline" text="No security events yet." />
      ) : (
        <>
          {visible.map(row => (
            <LogRow
              key={row.id}
              action={row.action}
              target={`${row.targetType} #${row.targetId}`}
              when={row.createdAt}
            />
          ))}
          {rows.length > 8 ? (
            <InlineButton
              label={showAll ? "Show fewer" : `Show all ${rows.length}`}
              tone="muted"
              onPress={() => setShowAll(v => !v)}
            />
          ) : null}
        </>
      )}
    </SettingsCard>
  );
}

function LogRow({
  action,
  target,
  when,
}: {
  action: string;
  target: string;
  when: Date;
}) {
  return (
    <View style={st.logRow}>
      <View style={{ flex: 1 }}>
        <Text style={st.logAction} numberOfLines={1}>
          {action}
        </Text>
        <Text style={st.logMeta} numberOfLines={1}>
          {target}
        </Text>
      </View>
      <Text style={st.logMeta}>{timeAgo(when)}</Text>
    </View>
  );
}

/* ─── Access ──────────────────────────────────────────────────────────── */

export function AccessSection({ settings, save, saving }: SaveProps) {
  const router = useRouter();
  const catalog = trpc.admin.settings.permissionsCatalog.useQuery();
  const { draft, dirty, reset, setAll } = useRoleDraft(
    settings.rolePermissions
  );
  const permissions = catalog.data?.permissions ?? [];

  return (
    <>
      <SettingsCard
        title="Users"
        description="Create, suspend, change roles and sign users out from User management."
      >
        <PrimaryButton
          label="Open user management"
          icon="people-outline"
          variant="outline"
          onPress={() => router.push("/admin/users" as any)}
        />
      </SettingsCard>
      {(["admin", "lecturer", "user"] as const).map(role => (
        <SettingsCard
          key={role}
          title={`${ROLE_TITLES[role]} permissions`}
          description="Tap a permission to turn it on or off. Checks run on the server."
        >
          {catalog.isLoading ? (
            <Loading />
          ) : (
            <View style={st.permWrap}>
              {permissions.map(perm => {
                const on = (draft[role] ?? []).includes(perm);
                return (
                  <TouchableOpacity
                    key={perm}
                    style={[st.perm, on && st.permOn]}
                    onPress={() => {
                      const next = new Set(draft[role] ?? []);
                      if (on) next.delete(perm);
                      else next.add(perm);
                      setAll({ ...draft, [role]: [...next] });
                    }}
                  >
                    <Text style={[st.permText, on && st.permTextOn]}>
                      {perm}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </SettingsCard>
      ))}
      <SaveBar
        dirty={dirty}
        saving={saving}
        onReset={reset}
        onSave={() => save({ rolePermissions: draft })}
      />
    </>
  );
}

function useRoleDraft(source: Record<string, string[]>) {
  const d = useDraft<{ value: Record<string, string[]> }>({ value: source });
  return {
    draft: d.draft.value,
    dirty: d.dirty,
    reset: d.reset,
    setAll: (value: Record<string, string[]>) => d.set("value", value),
  };
}

/* ─── Platform ────────────────────────────────────────────────────────── */

export function PlatformSection({ settings, save, saving }: SaveProps) {
  const general = useDraft({
    systemName: settings.general.systemName,
    description: settings.general.description,
    logoUrl: settings.general.logoUrl,
    faviconUrl: settings.general.faviconUrl,
    defaultLanguage: settings.general.defaultLanguage,
    defaultTimezone: settings.general.defaultTimezone,
    dateFormat: settings.general.dateFormat,
  });
  const appearance = useDraft(settings.appearance);
  const notifications = useDraft(
    settings.notifications as Record<string, boolean>
  );
  const maintenance = settings.general.maintenanceMode;

  return (
    <>
      <SettingsCard
        title="Maintenance mode"
        description="Blocks student and lecturer APIs while administrators stay signed in."
      >
        <ToggleSetting
          label={maintenance ? "Maintenance is ON" : "Maintenance is off"}
          hint={
            maintenance
              ? "Students and lecturers currently can't use the platform."
              : "Everyone can use the platform normally."
          }
          value={maintenance}
          disabled={saving}
          onChange={on =>
            Alert.alert(
              on ? "Turn on maintenance?" : "Turn off maintenance?",
              on
                ? "Students and lecturers will be blocked until you turn it off."
                : "Students and lecturers will regain access immediately.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: on ? "Turn on" : "Turn off",
                  style: on ? "destructive" : "default",
                  onPress: () => save({ general: { maintenanceMode: on } }),
                },
              ]
            )
          }
        />
      </SettingsCard>

      <SettingsCard
        title="General"
        description="Global identity and regional defaults."
      >
        <TextSetting
          label="System name"
          value={general.draft.systemName}
          onChange={v => general.set("systemName", v)}
        />
        <TextSetting
          label="Description"
          value={general.draft.description}
          onChange={v => general.set("description", v)}
          multiline
        />
        <TextSetting
          label="Logo URL"
          value={general.draft.logoUrl}
          onChange={v => general.set("logoUrl", v)}
          placeholder="https://…"
        />
        <TextSetting
          label="Favicon URL"
          value={general.draft.faviconUrl}
          onChange={v => general.set("faviconUrl", v)}
          placeholder="https://…"
        />
        <TextSetting
          label="Default language"
          value={general.draft.defaultLanguage}
          onChange={v => general.set("defaultLanguage", v)}
          placeholder="en"
        />
        <TextSetting
          label="Default timezone"
          value={general.draft.defaultTimezone}
          onChange={v => general.set("defaultTimezone", v)}
          placeholder="UTC"
        />
        <TextSetting
          label="Date format"
          value={general.draft.dateFormat}
          onChange={v => general.set("dateFormat", v)}
          placeholder="dd MMM yyyy"
        />
        <SaveBar
          dirty={general.dirty}
          saving={saving}
          onReset={general.reset}
          onSave={() => save({ general: general.draft })}
        />
      </SettingsCard>

      <SettingsCard
        title="Appearance"
        description="Brand colours and sign-in copy. Default deep green is #033c35."
      >
        <TextSetting
          label="Primary colour"
          value={appearance.draft.primaryColor}
          onChange={v => appearance.set("primaryColor", v)}
          placeholder="#033c35"
        />
        <TextSetting
          label="Secondary colour"
          value={appearance.draft.secondaryColor}
          onChange={v => appearance.set("secondaryColor", v)}
          placeholder="#10b981"
        />
        <TextSetting
          label="Login tagline"
          value={appearance.draft.loginTagline}
          onChange={v => appearance.set("loginTagline", v)}
        />
        <Text style={st.label}>Default theme</Text>
        <ChipSelect<"light" | "dark">
          value={appearance.draft.theme}
          onChange={v => appearance.set("theme", v)}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
        <Text style={st.label}>Sidebar style</Text>
        <ChipSelect<"solid" | "soft">
          value={appearance.draft.sidebarStyle}
          onChange={v => appearance.set("sidebarStyle", v)}
          options={[
            { value: "solid", label: "Solid" },
            { value: "soft", label: "Soft" },
          ]}
        />
        <SaveBar
          dirty={appearance.dirty}
          saving={saving}
          onReset={appearance.reset}
          onSave={() => save({ appearance: appearance.draft })}
        />
      </SettingsCard>

      <SettingsCard
        title="System notifications"
        description="Defaults copied into new administrator preference records."
      >
        {Object.keys(notifications.draft).map(key => (
          <ToggleSetting
            key={key}
            label={NOTIFICATION_LABELS[key] ?? key}
            value={notifications.draft[key]}
            onChange={v => notifications.set(key, v)}
          />
        ))}
        <SaveBar
          dirty={notifications.dirty}
          saving={saving}
          onReset={notifications.reset}
          onSave={() => save({ notifications: notifications.draft })}
        />
      </SettingsCard>

      <ApiCard settings={settings} save={save} saving={saving} />
    </>
  );
}

function ApiCard({ settings, save, saving }: SaveProps) {
  const { draft, set, dirty, reset } = useDraft(settings.api);
  return (
    <SettingsCard
      title="API"
      description="tRPC HTTP API. The rate limit is stored for when a global limiter is enabled."
    >
      <DetailRow label="Version" value={draft.version} />
      <NumberSetting
        label="Rate limit per minute (0 = off)"
        value={draft.rateLimitPerMinute}
        onChange={v => set("rateLimitPerMinute", v)}
      />
      <SaveBar
        dirty={dirty}
        saving={saving}
        onReset={reset}
        onSave={() => save({ api: draft })}
      />
    </SettingsCard>
  );
}

/* ─── Academic ────────────────────────────────────────────────────────── */

export function AcademicSettingsSection({ settings, save, saving }: SaveProps) {
  const router = useRouter();
  const { draft, set, dirty, reset } = useDraft(settings.academic);
  return (
    <SettingsCard
      title="Academic defaults"
      description="Institution configuration. Courses and lecturer allocation live under Academic."
    >
      <TextSetting
        label="Academic year"
        value={draft.academicYear}
        onChange={v => set("academicYear", v)}
        placeholder="2025/2026"
      />
      <TextSetting
        label="Semester"
        value={draft.semester}
        onChange={v => set("semester", v)}
        placeholder="First"
      />
      <TextSetting
        label="Faculties"
        value={draft.faculties}
        onChange={v => set("faculties", v)}
        hint="Separate with commas."
      />
      <TextSetting
        label="Departments"
        value={draft.departments}
        onChange={v => set("departments", v)}
        hint="Separate with commas."
      />
      <TextSetting
        label="Levels"
        value={draft.levels}
        onChange={v => set("levels", v)}
        placeholder="100, 200, 300, 400"
      />
      <NumberSetting
        label="Default credit hours"
        value={draft.creditHoursDefault}
        onChange={v => set("creditHoursDefault", v)}
      />
      <NumberSetting
        label="Pass mark (%)"
        value={draft.passMark}
        onChange={v => set("passMark", v)}
      />
      <TextSetting
        label="Grading system"
        value={draft.gradingSystem}
        onChange={v => set("gradingSystem", v)}
        placeholder="percentage"
      />
      <TextSetting
        label="Assessment types"
        value={draft.assessmentTypes}
        onChange={v => set("assessmentTypes", v)}
        placeholder="Quiz, Assignment, Exam"
      />
      <SaveBar
        dirty={dirty}
        saving={saving}
        onReset={reset}
        onSave={() => save({ academic: draft })}
      />
      <View style={{ marginTop: 10 }}>
        <PrimaryButton
          label="Open course allocation"
          icon="school-outline"
          variant="outline"
          onPress={() => router.push("/admin/academic" as any)}
        />
      </View>
    </SettingsCard>
  );
}

/* ─── AI ──────────────────────────────────────────────────────────────── */

export function AiSection({ settings, save, saving }: SaveProps) {
  const health = trpc.admin.settings.aiHealth.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const metrics = trpc.admin.settings.aiMetrics.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const test = trpc.admin.settings.testGroq.useMutation({
    onSuccess: res => Alert.alert("Groq is working", res.message),
    onError: fail("Groq test failed"),
  });
  const model = useDraft({
    model: settings.ai.model,
    temperature: settings.ai.temperature,
    maxTokens: settings.ai.maxTokens,
  });
  const rag = useDraft(settings.ai.rag);

  return (
    <>
      <SettingsCard
        title="AI provider"
        description="The assistant uses Groq. API keys never leave the server."
      >
        {health.isLoading ? (
          <Loading />
        ) : health.error ? (
          <EmptyState icon="alert-circle-outline" text={health.error.message} />
        ) : (
          (health.data ?? []).map(row => (
            <StatusRow
              key={row.provider}
              label="Groq"
              status={
                row.status === "connected"
                  ? "connected"
                  : row.status === "misconfigured"
                    ? "error"
                    : "not_connected"
              }
              detail={`${row.detail}${row.model ? ` · ${row.model}` : ""}${row.latencyMs != null ? ` · ${row.latencyMs} ms` : ""}`}
            />
          ))
        )}
        {(metrics.data ?? []).map(m => (
          <Text key={m.provider} style={st.body}>
            {m.requests} requests · {m.successRate ?? 0}% success · avg{" "}
            {m.averageLatencyMs ?? "—"} ms
          </Text>
        ))}
        <View style={{ marginTop: 10 }}>
          <PrimaryButton
            label="Test Groq connection"
            icon="pulse-outline"
            variant="outline"
            loading={test.isPending}
            onPress={() => test.mutate()}
          />
        </View>
      </SettingsCard>

      <SettingsCard
        title="Model"
        description="Leave the model empty to use GROQ_MODEL from the server environment."
      >
        <TextSetting
          label="Model"
          value={model.draft.model}
          onChange={v => model.set("model", v)}
          placeholder="Server default"
        />
        <NumberSetting
          label="Temperature"
          value={model.draft.temperature}
          onChange={v => model.set("temperature", v)}
          decimal
          hint="0 is precise, 1 is creative."
        />
        <NumberSetting
          label="Max output tokens"
          value={model.draft.maxTokens}
          onChange={v => model.set("maxTokens", v)}
        />
        <SaveBar
          dirty={model.dirty}
          saving={saving}
          onReset={model.reset}
          onSave={() => save({ ai: { provider: "groq", ...model.draft } })}
        />
      </SettingsCard>

      <SettingsCard
        title="RAG configuration"
        description="Applied on the next index or retrieval. Re-index from Advanced after changing chunk size."
      >
        <NumberSetting
          label="Chunk size"
          value={rag.draft.chunkSize}
          onChange={v => rag.set("chunkSize", v)}
        />
        <NumberSetting
          label="Chunk overlap"
          value={rag.draft.chunkOverlap}
          onChange={v => rag.set("chunkOverlap", v)}
        />
        <NumberSetting
          label="Top-K results"
          value={rag.draft.topK}
          onChange={v => rag.set("topK", v)}
        />
        <NumberSetting
          label="Similarity threshold"
          value={rag.draft.similarityThreshold}
          onChange={v => rag.set("similarityThreshold", v)}
          decimal
        />
        <NumberSetting
          label="Max retrieved context"
          value={rag.draft.maxContext}
          onChange={v => rag.set("maxContext", v)}
        />
        <SaveBar
          dirty={rag.dirty}
          saving={saving}
          onReset={rag.reset}
          onSave={() => save({ ai: { rag: rag.draft } })}
        />
      </SettingsCard>

      <AutonomousAgentCard settings={settings} save={save} saving={saving} />
    </>
  );
}

function AutonomousAgentCard({ settings, save, saving }: SaveProps) {
  const agent = useDraft(settings.autonomousAgent);
  const utils = trpc.useUtils();
  const overview = trpc.admin.autonomousAgent.overview.useQuery(undefined, {
    refetchInterval: query => (query.state.data?.status.running ? 4000 : 30_000),
  });
  const runNow = trpc.admin.autonomousAgent.runNow.useMutation({
    onSuccess: () => {
      Alert.alert("Sweep started", "Results will appear below in a moment.");
      void utils.admin.autonomousAgent.overview.invalidate();
    },
    onError: fail("Could not start the agent"),
  });
  const stats = overview.data?.stats;
  const running = overview.data?.status.running;

  return (
    <SettingsCard
      title="Autonomous agent"
      description="Checks each student every few hours (deadlines, weak topics, new lectures, due flashcards, inactivity) and acts on its own: notifications, and optionally flashcards or practice quizzes. It never edits calendars; students can switch it off."
    >
      <ToggleSetting
        label="Enabled"
        value={agent.draft.enabled}
        onChange={v => agent.set("enabled", v)}
      />
      <NumberSetting
        label="Hours between checks per student"
        value={agent.draft.intervalHours}
        onChange={v => agent.set("intervalHours", v)}
        hint="Between 1 and 24."
      />
      <NumberSetting
        label="Students per sweep"
        value={agent.draft.maxStudentsPerSweep}
        onChange={v => agent.set("maxStudentsPerSweep", v)}
        hint="Caps AI usage; the rest are picked up 15 minutes later."
      />
      <ToggleSetting
        label="Create study material"
        hint="Allow flashcards and practice quizzes, not just notifications."
        value={agent.draft.allowContentCreation}
        onChange={v => agent.set("allowContentCreation", v)}
      />
      <SaveBar
        dirty={agent.dirty}
        saving={saving}
        onReset={agent.reset}
        onSave={() => save({ autonomousAgent: agent.draft })}
      />

      {stats ? (
        <Text style={[st.body, { marginTop: 12 }]}>
          Last 7 days: {stats.runsThisWeek} runs · {stats.studentsReached} students helped ·{" "}
          {stats.notifications} notifications · {stats.materials} materials created ·{" "}
          {stats.optedOut} opted out
        </Text>
      ) : null}
      <View style={{ marginTop: 10 }}>
        <PrimaryButton
          label={running ? "Sweep running…" : "Run now for all students"}
          icon="sparkles-outline"
          variant="outline"
          loading={runNow.isPending || Boolean(running)}
          onPress={() => runNow.mutate()}
        />
      </View>

      {(overview.data?.runs ?? []).slice(0, 8).map(run => (
        <View key={run.id} style={{ marginTop: 12 }}>
          <DetailRow
            label={`${run.userName || "Student"} · ${timeAgo(run.createdAt)}`}
            value={run.status}
            tone={run.status === "failed" ? "danger" : undefined}
          />
          <Text style={st.body}>{run.error || run.summary}</Text>
        </View>
      ))}
    </SettingsCard>
  );
}

/* ─── Content ─────────────────────────────────────────────────────────── */

export function ContentSection({ settings, save, saving }: SaveProps) {
  const content = useDraft(settings.content);
  const quizzes = useDraft(settings.quizzes);
  const assignments = useDraft(settings.assignments);
  return (
    <>
      <SettingsCard
        title="Documents & courses"
        description="Upload limits and course defaults."
      >
        <NumberSetting
          label="Max upload size (MB)"
          value={content.draft.maxUploadMb}
          onChange={v => content.set("maxUploadMb", v)}
        />
        <TextSetting
          label="Allowed file types"
          value={content.draft.allowedTypes}
          onChange={v => content.set("allowedTypes", v)}
          placeholder="pdf,docx,pptx"
        />
        <ToggleSetting
          label="Auto-index uploads"
          hint="Make new documents searchable by the AI straight away."
          value={content.draft.autoIndex}
          onChange={v => content.set("autoIndex", v)}
        />
        <View style={{ height: 12 }} />
        <TextSetting
          label="Course visibility"
          value={content.draft.courseVisibility}
          onChange={v => content.set("courseVisibility", v)}
          placeholder="assigned"
        />
        <TextSetting
          label="Enrollment"
          value={content.draft.enrollment}
          onChange={v => content.set("enrollment", v)}
          placeholder="code"
        />
        <SaveBar
          dirty={content.dirty}
          saving={saving}
          onReset={content.reset}
          onSave={() => save({ content: content.draft })}
        />
      </SettingsCard>

      <SettingsCard
        title="Quizzes"
        description="Defaults for generated quizzes."
      >
        <NumberSetting
          label="Default duration (minutes)"
          value={quizzes.draft.defaultDurationMinutes}
          onChange={v => quizzes.set("defaultDurationMinutes", v)}
        />
        <NumberSetting
          label="Attempt limit"
          value={quizzes.draft.attemptLimit}
          onChange={v => quizzes.set("attemptLimit", v)}
        />
        <NumberSetting
          label="Passing score (%)"
          value={quizzes.draft.passingScore}
          onChange={v => quizzes.set("passingScore", v)}
        />
        <ToggleSetting
          label="Randomize questions"
          value={quizzes.draft.randomize}
          onChange={v => quizzes.set("randomize", v)}
        />
        <ToggleSetting
          label="Show results to students"
          value={quizzes.draft.showResults}
          onChange={v => quizzes.set("showResults", v)}
        />
        <SaveBar
          dirty={quizzes.dirty}
          saving={saving}
          onReset={quizzes.reset}
          onSave={() => save({ quizzes: quizzes.draft })}
        />
      </SettingsCard>

      <SettingsCard title="Assignments" description="Default submission rules.">
        <NumberSetting
          label="Max file size (MB)"
          value={assignments.draft.maxFileMb}
          onChange={v => assignments.set("maxFileMb", v)}
        />
        <TextSetting
          label="Allowed file types"
          value={assignments.draft.allowedTypes}
          onChange={v => assignments.set("allowedTypes", v)}
          placeholder="pdf,docx"
        />
        <ToggleSetting
          label="Accept late submissions"
          value={assignments.draft.lateSubmissions}
          onChange={v => assignments.set("lateSubmissions", v)}
        />
        <SaveBar
          dirty={assignments.dirty}
          saving={saving}
          onReset={assignments.reset}
          onSave={() => save({ assignments: assignments.draft })}
        />
      </SettingsCard>
    </>
  );
}

/* ─── Features ────────────────────────────────────────────────────────── */

export function FeaturesSection({ settings, save, saving }: SaveProps) {
  const { draft, set, dirty, reset } = useDraft(
    settings.features as Record<string, boolean>
  );
  return (
    <SettingsCard
      title="Feature flags"
      description="Turning a feature off makes its APIs return an error for everyone."
    >
      {Object.keys(draft).map(key => (
        <ToggleSetting
          key={key}
          label={FEATURE_LABELS[key] ?? key}
          value={draft[key]}
          onChange={v => set(key, v)}
        />
      ))}
      <SaveBar
        dirty={dirty}
        saving={saving}
        onReset={reset}
        onSave={() => save({ features: draft })}
      />
    </SettingsCard>
  );
}

/* ─── Data ────────────────────────────────────────────────────────────── */

export function DataSection({
  settings,
  save,
  saving,
  superAdmin,
}: SaveProps & { superAdmin: boolean }) {
  const health = trpc.admin.settings.health.useQuery();
  const retention = useDraft(settings.data);
  const [confirmRetention, setConfirmRetention] = useState(false);
  const apply = trpc.admin.settings.applyRetention.useMutation({
    onSuccess: res => {
      setConfirmRetention(false);
      Alert.alert(
        "Retention applied",
        `Removed ${res.auditDeleted} old audit record${res.auditDeleted === 1 ? "" : "s"}.`
      );
    },
    onError: fail("Could not apply retention"),
  });

  const exportUsers = trpc.admin.settings.exportUsers.useMutation({
    onSuccess: rows =>
      void shareText(
        "AI Learning Assistant users",
        toCsv([
          [
            "ID",
            "Name",
            "Email",
            "Role",
            "Suspended",
            "Created",
            "Last signed in",
          ],
          ...rows.map(r => [
            r.id,
            r.name,
            r.email,
            r.role,
            r.isBanned ? "yes" : "no",
            formatDateTime(r.createdAt),
            formatDateTime(r.lastSignedIn),
          ]),
        ])
      ),
    onError: fail("Export failed"),
  });
  const exportCourses = trpc.admin.settings.exportCourses.useMutation({
    onSuccess: rows =>
      void shareText("AI Learning Assistant courses", JSON.stringify(rows, null, 2)),
    onError: fail("Export failed"),
  });

  return (
    <>
      <SettingsCard
        title="Storage"
        description="Local document storage on this server."
      >
        {health.isLoading ? (
          <Loading />
        ) : (
          <>
            <DetailRow
              label="Used"
              value={formatBytes(Number(health.data?.storage?.bytes ?? 0))}
            />
            <DetailRow
              label="Documents"
              value={String(health.data?.storage?.count ?? 0)}
            />
            <DetailRow
              label="Max upload"
              value={`${settings.content.maxUploadMb} MB`}
            />
          </>
        )}
      </SettingsCard>

      <BackupsCard superAdmin={superAdmin} />

      <SettingsCard
        title="Export"
        description="Exports never include password hashes or secrets. They open your share sheet so you can save or send them."
      >
        <View style={st.row}>
          <InlineButton
            label="Export users (CSV)"
            icon="people-outline"
            disabled={exportUsers.isPending}
            onPress={() => exportUsers.mutate()}
          />
          <InlineButton
            label="Export courses (JSON)"
            icon="book-outline"
            disabled={exportCourses.isPending}
            onPress={() => exportCourses.mutate()}
          />
        </View>
      </SettingsCard>

      <SettingsCard
        title="Data retention"
        description="Number of days to keep each kind of record. 0 keeps records forever."
      >
        <NumberSetting
          label="Inactive user accounts"
          value={retention.draft.userRetentionDays}
          onChange={v => retention.set("userRetentionDays", v)}
        />
        <NumberSetting
          label="AI chat history"
          value={retention.draft.chatRetentionDays}
          onChange={v => retention.set("chatRetentionDays", v)}
        />
        <NumberSetting
          label="Audit log"
          value={retention.draft.auditRetentionDays}
          onChange={v => retention.set("auditRetentionDays", v)}
        />
        <NumberSetting
          label="Documents"
          value={retention.draft.documentRetentionDays}
          onChange={v => retention.set("documentRetentionDays", v)}
        />
        <SaveBar
          dirty={retention.dirty}
          saving={saving}
          onReset={retention.reset}
          onSave={() => save({ data: retention.draft })}
        />
        {superAdmin ? (
          <View style={{ marginTop: 10 }}>
            <PrimaryButton
              label="Apply retention now"
              icon="trash-outline"
              variant="danger"
              onPress={() => setConfirmRetention(true)}
            />
          </View>
        ) : (
          <Text style={st.note}>Only a Super Admin can apply retention.</Text>
        )}
      </SettingsCard>

      <ConfirmSheet
        visible={confirmRetention}
        title="Apply retention"
        hint={`Permanently deletes audit records older than ${settings.data.auditRetentionDays} days. This cannot be undone.`}
        word="APPLY RETENTION"
        confirmLabel="Apply retention"
        loading={apply.isPending}
        onConfirm={() => apply.mutate({ confirm: "APPLY RETENTION" })}
        onClose={() => setConfirmRetention(false)}
      />
    </>
  );
}

function BackupsCard({ superAdmin }: { superAdmin: boolean }) {
  const backups = trpc.admin.settings.backups.useQuery();
  const [pending, setPending] = useState<{
    id: number;
    kind: "delete" | "restore";
    name: string;
  } | null>(null);
  const create = trpc.admin.settings.createBackup.useMutation({
    onSuccess: () => {
      void backups.refetch();
      Alert.alert(
        "Backup created",
        "A copy of the database was saved on the server."
      );
    },
    onError: fail("Backup failed"),
  });
  const remove = trpc.admin.settings.deleteBackup.useMutation({
    onSuccess: () => {
      setPending(null);
      void backups.refetch();
      Alert.alert("Backup deleted", "The backup file was removed.");
    },
    onError: fail("Could not delete backup"),
  });
  const restore = trpc.admin.settings.restoreBackup.useMutation({
    onSuccess: res => {
      setPending(null);
      Alert.alert("Restore staged", res.message);
    },
    onError: fail("Could not restore backup"),
  });

  return (
    <SettingsCard
      title="Backups"
      description="Copies of the database. Restoring stages a file; the server must then be restarted."
    >
      <PrimaryButton
        label="Create backup now"
        icon="cloud-upload-outline"
        loading={create.isPending}
        onPress={() => create.mutate()}
      />
      <View style={{ height: 10 }} />
      {backups.isLoading ? (
        <Loading />
      ) : backups.error ? (
        <EmptyState icon="alert-circle-outline" text={backups.error.message} />
      ) : !backups.data?.length ? (
        <EmptyState
          icon="archive-outline"
          text="No backups yet. Create one to get started."
        />
      ) : (
        backups.data.map(b => (
          <View key={b.id} style={st.backup}>
            <Text style={st.logAction} numberOfLines={1}>
              {b.fileName}
            </Text>
            <Text style={st.logMeta}>
              {formatBytes(b.sizeBytes)} · {formatDateTime(b.createdAt)}
            </Text>
            <View style={[st.row, { marginTop: 8 }]}>
              {superAdmin ? (
                <InlineButton
                  label="Restore"
                  icon="refresh"
                  onPress={() =>
                    setPending({ id: b.id, kind: "restore", name: b.fileName })
                  }
                />
              ) : null}
              <InlineButton
                label="Delete"
                icon="trash-outline"
                tone="danger"
                onPress={() =>
                  setPending({ id: b.id, kind: "delete", name: b.fileName })
                }
              />
            </View>
          </View>
        ))
      )}

      <ConfirmSheet
        visible={!!pending}
        title={pending?.kind === "restore" ? "Restore backup" : "Delete backup"}
        hint={
          pending?.kind === "restore"
            ? `Stages ${pending?.name} to replace the live database. You must restart the server to finish.`
            : `Permanently deletes ${pending?.name ?? "this backup"}.`
        }
        word={pending?.kind === "restore" ? "RESTORE" : "DELETE"}
        confirmLabel={
          pending?.kind === "restore" ? "Stage restore" : "Delete backup"
        }
        loading={remove.isPending || restore.isPending}
        onConfirm={() => {
          if (!pending) return;
          if (pending.kind === "restore")
            restore.mutate({ id: pending.id, confirm: "RESTORE" });
          else remove.mutate({ id: pending.id, confirm: "DELETE" });
        }}
        onClose={() => setPending(null)}
      />
    </SettingsCard>
  );
}

/* ─── Monitoring ──────────────────────────────────────────────────────── */

export function MonitoringSection() {
  const router = useRouter();
  const health = trpc.admin.settings.health.useQuery(undefined, {
    refetchInterval: 15_000,
  });
  const integrations = trpc.admin.settings.integrations.useQuery();
  const activity = trpc.admin.settings.activity.useQuery();
  const [to, setTo] = useState("");
  const [toError, setToError] = useState<string | null>(null);
  const testEmail = trpc.admin.settings.sendTestEmail.useMutation({
    onSuccess: () =>
      Alert.alert("Test email sent", `Check the inbox for ${to}.`),
    onError: fail("Test email failed"),
  });
  const d = health.data;
  const i = integrations.data;

  return (
    <>
      <SettingsCard
        title="System health"
        description="Live checks, refreshed every 15 seconds."
      >
        {health.isLoading || !d ? (
          <Loading />
        ) : (
          <>
            <StatusRow label="Backend" status={d.backend} />
            <StatusRow label="Database" status={d.database} />
            <StatusRow label="Authentication" status={d.authentication} />
            <StatusRow label="AI / Groq" status={d.ai} />
            <StatusRow
              label="Email"
              status={d.email ? "connected" : "not_connected"}
            />
            <StatusRow
              label="Google sign-in"
              status={d.googleAuth ? "connected" : "not_connected"}
            />
          </>
        )}
      </SettingsCard>

      <SettingsCard
        title="Integrations"
        description="Status only. Secrets stay on the server."
      >
        {integrations.isLoading || !i ? (
          <Loading />
        ) : (
          <>
            <StatusRow
              label="Sessions (JWT)"
              status={i.jwt.status}
              detail={i.jwt.detail}
            />
            <StatusRow
              label="Google"
              status={i.google.status}
              detail={i.google.detail}
            />
            <StatusRow
              label="Email (Resend)"
              status={i.email.status}
              detail={i.email.detail}
            />
            <StatusRow
              label="Groq AI"
              status={i.groq.status}
              detail={i.groq.detail}
            />
            <StatusRow
              label="File storage"
              status={i.storage.status}
              detail={i.storage.detail}
            />
          </>
        )}
        <View style={{ marginTop: 12 }}>
          <FormField
            label="Send a test email to"
            value={to}
            onChangeText={v => {
              setTo(v);
              setToError(null);
            }}
            placeholder="you@central.edu.sl"
            keyboardType="email-address"
            autoCapitalize="none"
            maxLength={LIMITS.email}
            error={toError}
          />
          <PrimaryButton
            label="Send test email"
            icon="mail-outline"
            variant="outline"
            loading={testEmail.isPending}
            onPress={() => {
              const error = validateEmail(to, { requireSchoolDomain: false });
              setToError(error);
              if (!error) testEmail.mutate({ to: to.trim() });
            }}
          />
        </View>
      </SettingsCard>

      <SettingsCard
        title="Recent activity"
        description="The latest privileged actions."
      >
        {activity.isLoading ? (
          <Loading />
        ) : !activity.data?.length ? (
          <EmptyState
            icon="pulse-outline"
            text="No administrator activity yet."
          />
        ) : (
          activity.data
            .slice(0, 10)
            .map(row => (
              <LogRow
                key={row.id}
                action={row.action}
                target={`${row.targetType} #${row.targetId}`}
                when={row.createdAt}
              />
            ))
        )}
        <View style={{ marginTop: 10 }}>
          <PrimaryButton
            label="Open full audit log"
            icon="list-outline"
            variant="outline"
            onPress={() => router.push("/admin/audit" as any)}
          />
        </View>
      </SettingsCard>
    </>
  );
}

/* ─── Advanced ────────────────────────────────────────────────────────── */

export function AdvancedSection({
  superAdmin,
  onReset,
}: {
  superAdmin: boolean;
  onReset: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const reindex = trpc.admin.settings.reindexDocuments.useMutation({
    onSuccess: res =>
      Alert.alert(
        "Re-index complete",
        `Re-indexed ${res.indexed} document${res.indexed === 1 ? "" : "s"}.`
      ),
    onError: fail("Re-index failed"),
  });
  const reset = trpc.admin.settings.resetSettings.useMutation({
    onSuccess: () => {
      setConfirmReset(false);
      onReset();
      Alert.alert(
        "Settings reset",
        "Every system setting is back to its default value."
      );
    },
    onError: fail("Reset failed"),
  });

  if (!superAdmin) {
    return (
      <EmptyState
        icon="lock-closed-outline"
        text="Advanced tools are restricted to Super Admins. Ask a Super Admin for access."
      />
    );
  }

  return (
    <>
      <SettingsCard
        title="Search index"
        description="Rebuilds the AI search index from stored document text. Run this after changing RAG chunk settings."
      >
        <PrimaryButton
          label="Re-index all documents"
          icon="sync-outline"
          variant="outline"
          loading={reindex.isPending}
          onPress={() =>
            Alert.alert(
              "Re-index documents?",
              "This can take a while for large libraries.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Re-index", onPress: () => reindex.mutate() },
              ]
            )
          }
        />
      </SettingsCard>

      <SettingsCard
        title="Danger zone"
        description="Resets every system setting to its default. Users, courses and documents are not affected."
      >
        <PrimaryButton
          label="Reset configuration"
          icon="warning-outline"
          variant="danger"
          onPress={() => setConfirmReset(true)}
        />
      </SettingsCard>

      <ConfirmSheet
        visible={confirmReset}
        title="Reset configuration"
        hint="All system settings, feature flags and role permissions return to their defaults."
        word="RESET SETTINGS"
        confirmLabel="Reset configuration"
        loading={reset.isPending}
        onConfirm={() => reset.mutate({ confirm: "RESET SETTINGS" })}
        onClose={() => setConfirmReset(false)}
      />
    </>
  );
}

const st = StyleSheet.create({
  body: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
    marginBottom: 10,
  },
  note: { fontSize: 12, color: colors.textMuted, marginTop: 10 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 6,
    marginTop: 4,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mono: {
    fontFamily: monoFont,
    fontSize: 13,
    color: colors.text,
    marginVertical: 2,
  },
  secret: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    letterSpacing: 1,
  },
  recovery: {
    backgroundColor: "#fffbeb",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  recoveryTitle: { fontSize: 14, fontWeight: "800", color: "#92400e" },
  recoveryHint: {
    fontSize: 12,
    color: "#92400e",
    marginTop: 2,
    marginBottom: 8,
  },
  logRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  logAction: { fontSize: 13, fontWeight: "700", color: colors.text },
  logMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  permWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  perm: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  permOn: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  permText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    fontFamily: monoFont,
  },
  permTextOn: { color: colors.primary },
  backup: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
