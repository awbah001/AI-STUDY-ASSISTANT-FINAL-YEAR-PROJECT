import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import {
  DangerZone,
  EmptyState,
  LoadingState,
  SaveBar,
  SettingRow,
  SettingsCard,
  SettingsSection,
  StatusBadge,
} from "@/components/settings/SettingsUi";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { setAuthToken } from "@/lib/authToken";
import { SETTINGS_NAV, type SystemSettings } from "@shared/adminSettings";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Menu, Search, User, Shield, Users, SlidersHorizontal, Sparkles,
  FileStack, HardDrive, Plug, Activity, Code2, X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

const GROUP_ICONS: Record<string, typeof User> = {
  account: User,
  security: Shield,
  access: Users,
  system: SlidersHorizontal,
  ai: Sparkles,
  content: FileStack,
  data: HardDrive,
  integrations: Plug,
  monitoring: Activity,
  advanced: Code2,
};

const DESCRIPTIONS: Record<string, { title: string; body: string }> = {
  profile: { title: "Profile", body: "Your administrator identity on Cognify." },
  preferences: { title: "Preferences", body: "Personal display and navigation preferences for this account." },
  notifications: { title: "Notifications", body: "Choose which alerts you receive as an administrator." },
  password: { title: "Password & Authentication", body: "Change your password. Policy minimum length is enforced server-side." },
  twofactor: { title: "Two-Factor Authentication", body: "Protect this administrator account with TOTP and recovery codes." },
  sessions: { title: "Sessions", body: "Cognify uses JWT sessions. Signing out others invalidates existing tokens." },
  "security-logs": { title: "Security Logs", body: "Recent authentication and access events." },
  users: { title: "Users", body: "User administration lives in User Management. Force-logout is available here." },
  roles: { title: "Roles", body: "Permission sets for the built-in Cognify roles. Custom extra roles are not supported." },
  permissions: { title: "Permissions", body: "Granular capabilities checked on the server, not only in the UI." },
  general: { title: "General", body: "Configure the global behavior and identity of Cognify." },
  appearance: { title: "Appearance", body: "Brand colors default to Cognify deep green. Changing them does not restyle the whole app immediately." },
  academic: { title: "Academic", body: "Institution defaults. Course catalog management remains on the Academic page." },
  "sys-notifications": { title: "System notifications", body: "Default notification channels for new administrator preference records." },
  maintenance: { title: "Maintenance", body: "When enabled, students and lecturers cannot use product APIs." },
  "ai-providers": { title: "AI Providers", body: "Connection status is derived from server environment. API keys are never shown." },
  models: { title: "Models", body: "Generation parameters used by LM Studio / OpenAI-compatible chat." },
  rag: { title: "RAG Configuration", body: "Chunking and retrieval used when indexing and answering from documents." },
  "ai-features": { title: "AI Features", body: "Toggles that the backend actually enforces." },
  documents: { title: "Documents", body: "Upload and indexing defaults for study materials." },
  courses: { title: "Courses", body: "Visibility and enrollment behavior." },
  quizzes: { title: "Quizzes", body: "Default quiz rules for generated assessments." },
  assignments: { title: "Assignments", body: "Default assignment file rules." },
  storage: { title: "Storage", body: "Local upload usage on this server." },
  backups: { title: "Backups", body: "SQLite file copies under data/backups. Restore is Super Admin only." },
  "import-export": { title: "Import / Export", body: "Export user and course datasets as JSON. CSV import is not implemented." },
  retention: { title: "Data Retention", body: "Apply audit-log retention. Other retention values are stored for policy, not auto-purged." },
  "auth-int": { title: "Authentication", body: "JWT and Google OAuth configuration status." },
  email: { title: "Email", body: "Transactional email via Resend when server environment variables are set." },
  "storage-int": { title: "Cloud Storage", body: "Cognify stores files locally in data/uploads. Object storage is not configured." },
  apis: { title: "External APIs", body: "Connected AI and email endpoints. Webhooks are not implemented." },
  audit: { title: "Audit Logs", body: "Privileged actions are append-only. Open the full Audit page for search." },
  health: { title: "System Health", body: "Live checks for database, authentication, AI, and storage." },
  activity: { title: "Activity", body: "Recent privileged actions." },
  flags: { title: "Feature Flags", body: "The same flags as AI Features, plus mobile and beta." },
  api: { title: "API", body: "tRPC over HTTP. Rate limiting is stored for policy; a global limiter is not active unless greater than zero is used later." },
  developer: { title: "Developer Settings", body: "Super Admin tools for index rebuild, cache, and configuration reset." },
};

function passwordScore(pw: string, min: number) {
  let score = 0;
  if (pw.length >= min) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  return score;
}

export default function AdminSettings() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/admin/settings/:section");
  const section = params?.section || "profile";
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (user && user.role !== "admin") setLocation("/login");
  }, [user, setLocation]);

  const bundle = trpc.admin.settings.get.useQuery(undefined, { enabled: user?.role === "admin" });
  const prefsQ = trpc.admin.settings.preferences.useQuery(undefined, { enabled: user?.role === "admin" });
  const [query, setQuery] = useState("");
  const filteredNav = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SETTINGS_NAV;
    return SETTINGS_NAV
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.label.toLowerCase().includes(q) || group.label.toLowerCase().includes(q)),
      }))
      .filter((group) => group.items.length > 0);
  }, [query]);

  if (!user || user.role !== "admin") return null;
  if (bundle.isLoading) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-6xl p-4">
          <LoadingState />
        </div>
      </DashboardLayout>
    );
  }
  if (bundle.error || !bundle.data) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-6xl p-4 text-sm text-red-600">{bundle.error?.message || "Could not load settings."}</div>
      </DashboardLayout>
    );
  }

  const meta = DESCRIPTIONS[section] ?? { title: "Settings", body: "Configure Cognify." };

  return (
    <DashboardLayout>
      <div className="-mx-1 flex max-w-6xl flex-col gap-6 lg:flex-row lg:items-start">
        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => setNavOpen((v) => !v)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm"
          >
            {navOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            Settings menu
          </button>
        </div>
        <aside className={`w-full shrink-0 lg:sticky lg:top-0 lg:w-[240px] ${navOpen ? "block" : "hidden lg:block"}`}>
          <nav className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-100 p-3">
              <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800/70">Settings</p>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search settings"
                  className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                />
              </label>
            </div>
            <div className="max-h-[min(70vh,640px)] overflow-y-auto p-2">
              {filteredNav.map((group) => {
                const Icon = GROUP_ICONS[group.id] ?? SlidersHorizontal;
                return (
                  <div key={group.id} className="mb-3 last:mb-0">
                    <p className="flex items-center gap-1.5 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      <Icon className="h-3 w-3" />
                      {group.label}
                    </p>
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setNavOpen(false);
                          setLocation(`/admin/settings/${item.id}`);
                        }}
                        className={`mb-0.5 flex w-full items-center rounded-xl px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors ${
                          section === item.id
                            ? "bg-[#033c35] text-white shadow-sm"
                            : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-900"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                );
              })}
              {filteredNav.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-slate-400">No matching settings</p>
              ) : null}
            </div>
          </nav>
        </aside>
        <div className="min-w-0 flex-1 space-y-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Settings / {meta.title}</p>
          <SectionBody
            section={section}
            settings={bundle.data.settings}
            me={bundle.data.me}
            prefs={prefsQ.data}
            refetch={() => {
              bundle.refetch();
              prefsQ.refetch();
            }}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}

function SectionBody({
  section,
  settings,
  me,
  prefs,
  refetch,
}: {
  section: string;
  settings: SystemSettings;
  me: {
    id: number;
    name: string | null;
    email: string | null;
    phone: string | null;
    jobTitle: string | null;
    role: string;
    isSuperAdmin: boolean;
    avatarUrl: string | null;
    loginMethod: string | null;
    totpEnabled: boolean;
    createdAt: Date;
    lastSignedIn: Date;
  };
  prefs: {
    theme?: string | null;
    language?: string | null;
    timezone?: string | null;
    dateFormat?: string | null;
    timeFormat?: string | null;
    landingPage?: string | null;
    sidebarCollapsed?: boolean | null;
    notifications?: Record<string, boolean> | null;
  } | null | undefined;
  refetch: () => void;
}) {
  const utils = trpc.useUtils();
  const { theme, toggleTheme } = useTheme();
  const [, setLocation] = useLocation();
  const save = trpc.admin.settings.save.useMutation({
    onSuccess: async () => {
      toast.success("Settings saved successfully.");
      await utils.admin.settings.get.invalidate();
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const savePrefs = trpc.admin.settings.savePreferences.useMutation({
    onSuccess: () => {
      toast.success("Preferences saved.");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateAccount = trpc.admin.settings.updateAccount.useMutation({
    onSuccess: async () => {
      toast.success("Profile updated.");
      await utils.auth.me.invalidate();
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  if (section === "profile") return <ProfileSection me={me} updateAccount={updateAccount} />;
  if (section === "preferences") return <PreferencesSection prefs={prefs} theme={theme} toggleTheme={toggleTheme} savePrefs={savePrefs} />;
  if (section === "notifications") return <NotificationsSection prefs={prefs} savePrefs={savePrefs} />;
  if (section === "password") return <PasswordSection minLength={settings.passwordPolicy.minLength} />;
  if (section === "twofactor") return <TwoFactorSection enabled={me.totpEnabled} />;
  if (section === "sessions") return <SessionsSection />;
  if (section === "security-logs") return <SecurityLogsSection />;
  if (section === "users") return <UsersSettingsSection onOpenUsers={() => setLocation("/admin/users")} />;
  if (section === "roles" || section === "permissions") {
    return <RolesSection settings={settings} save={save} />;
  }
  if (section === "general") return <GeneralSection settings={settings} save={save} />;
  if (section === "appearance") return <AppearanceSection settings={settings} save={save} />;
  if (section === "academic") return <AcademicSection settings={settings} save={save} onOpen={() => setLocation("/admin/academic")} />;
  if (section === "sys-notifications") return <SystemNotificationsSection settings={settings} save={save} />;
  if (section === "maintenance") return <MaintenanceSection settings={settings} save={save} />;
  if (section === "ai-providers") return <AiProvidersSection />;
  if (section === "models") return <ModelsSection settings={settings} save={save} />;
  if (section === "rag") return <RagSection settings={settings} save={save} />;
  if (section === "ai-features" || section === "flags") return <FlagsSection settings={settings} save={save} />;
  if (section === "documents" || section === "courses") return <ContentSection settings={settings} save={save} />;
  if (section === "quizzes") return <QuizSection settings={settings} save={save} />;
  if (section === "assignments") return <AssignmentSection settings={settings} save={save} />;
  if (section === "storage") return <StorageSection settings={settings} />;
  if (section === "backups") return <BackupsSection superAdmin={me.isSuperAdmin} />;
  if (section === "import-export") return <ExportSection />;
  if (section === "retention") return <RetentionSection settings={settings} save={save} superAdmin={me.isSuperAdmin} />;
  if (section === "auth-int" || section === "email" || section === "storage-int" || section === "apis") {
    return <IntegrationsSection focus={section} />;
  }
  if (section === "audit") {
    return (
      <SettingsSection title="Audit Logs" description="Immutable privileged-action history.">
        <SettingsCard>
          <p className="text-sm text-slate-600">Use the dedicated Audit page for search and full history. Records cannot be edited here.</p>
          <button type="button" className="rounded-xl bg-[#033c35] px-4 py-2 text-sm text-white" onClick={() => setLocation("/admin/audit")}>
            Open audit log
          </button>
        </SettingsCard>
      </SettingsSection>
    );
  }
  if (section === "health") return <HealthSection />;
  if (section === "activity") return <ActivitySection />;
  if (section === "api") return <ApiSection settings={settings} save={save} />;
  if (section === "developer") return <DeveloperSection superAdmin={me.isSuperAdmin} />;
  return <EmptyState title="Unknown section" body="Choose an item from the settings navigation." />;
}

function ProfileSection({
  me,
  updateAccount,
}: {
  me: { name: string | null; email: string | null; phone: string | null; jobTitle: string | null; role: string; createdAt: Date; lastSignedIn: Date };
  updateAccount: { mutate: (v: { name?: string; phone?: string; jobTitle?: string; email?: string }) => void; isPending: boolean };
}) {
  const [name, setName] = useState(me.name ?? "");
  const [phone, setPhone] = useState(me.phone ?? "");
  const [jobTitle, setJobTitle] = useState(me.jobTitle ?? "");
  const [email, setEmail] = useState(me.email ?? "");
  const dirty = name !== (me.name ?? "") || phone !== (me.phone ?? "") || jobTitle !== (me.jobTitle ?? "") || email !== (me.email ?? "");
  return (
    <SettingsSection title="Profile" description="Your administrator identity on Cognify.">
      <SettingsCard>
        <SettingRow label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} /></SettingRow>
        <SettingRow label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></SettingRow>
        <SettingRow label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></SettingRow>
        <SettingRow label="Job title"><Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></SettingRow>
        <SettingRow label="Role"><Input value={me.role} disabled /></SettingRow>
        <SettingRow label="Created"><Input value={new Date(me.createdAt).toLocaleString()} disabled /></SettingRow>
        <SettingRow label="Last login"><Input value={new Date(me.lastSignedIn).toLocaleString()} disabled /></SettingRow>
        <p className="text-xs text-slate-500">Change your photo on the Profile page. Role cannot be changed here.</p>
      </SettingsCard>
      <SaveBar dirty={dirty} saving={updateAccount.isPending} onCancel={() => { setName(me.name ?? ""); setPhone(me.phone ?? ""); setJobTitle(me.jobTitle ?? ""); setEmail(me.email ?? ""); }} onSave={() => updateAccount.mutate({ name, phone, jobTitle, email })} />
    </SettingsSection>
  );
}

function PreferencesSection({
  prefs,
  theme,
  toggleTheme,
  savePrefs,
}: {
  prefs: { language?: string | null; timezone?: string | null; dateFormat?: string | null; timeFormat?: string | null; landingPage?: string | null; sidebarCollapsed?: boolean | null } | null | undefined;
  theme: string;
  toggleTheme?: () => void;
  savePrefs: { mutate: (v: Record<string, unknown>) => void; isPending: boolean };
}) {
  const [draft, setDraft] = useState({
    language: prefs?.language ?? "en",
    timezone: prefs?.timezone ?? "UTC",
    dateFormat: prefs?.dateFormat ?? "dd MMM yyyy",
    timeFormat: (prefs?.timeFormat as "12h" | "24h") ?? "24h",
    landingPage: prefs?.landingPage ?? "/admin",
    sidebarCollapsed: Boolean(prefs?.sidebarCollapsed),
  });
  return (
    <SettingsSection title="Preferences" description="Personal display and navigation preferences for this account.">
      <SettingsCard>
        <SettingRow label="Theme">
          <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => toggleTheme?.()}>
            {theme === "dark" ? "Dark" : "Light"}
          </button>
        </SettingRow>
        <SettingRow label="Language"><Input value={draft.language} onChange={(e) => setDraft({ ...draft, language: e.target.value })} /></SettingRow>
        <SettingRow label="Time zone"><Input value={draft.timezone} onChange={(e) => setDraft({ ...draft, timezone: e.target.value })} /></SettingRow>
        <SettingRow label="Date format"><Input value={draft.dateFormat} onChange={(e) => setDraft({ ...draft, dateFormat: e.target.value })} /></SettingRow>
        <SettingRow label="Time format">
          <select className="h-10 w-full rounded-md border px-3 text-sm" value={draft.timeFormat} onChange={(e) => setDraft({ ...draft, timeFormat: e.target.value as "12h" | "24h" })}>
            <option value="24h">24-hour</option>
            <option value="12h">12-hour</option>
          </select>
        </SettingRow>
        <SettingRow label="Default landing page"><Input value={draft.landingPage} onChange={(e) => setDraft({ ...draft, landingPage: e.target.value })} /></SettingRow>
        <SettingRow label="Collapse sidebar">
          <Switch checked={draft.sidebarCollapsed} onCheckedChange={(v) => setDraft({ ...draft, sidebarCollapsed: v })} />
        </SettingRow>
      </SettingsCard>
      <SaveBar dirty saving={savePrefs.isPending} onCancel={() => undefined} onSave={() => savePrefs.mutate({ ...draft, theme: theme === "dark" ? "dark" : "light" })} />
    </SettingsSection>
  );
}

function NotificationsSection({
  prefs,
  savePrefs,
}: {
  prefs: { notifications?: Record<string, boolean> | null } | null | undefined;
  savePrefs: { mutate: (v: { notifications: Record<string, boolean> }) => void; isPending: boolean };
}) {
  const [n, setN] = useState({
    email: prefs?.notifications?.email ?? true,
    inApp: prefs?.notifications?.inApp ?? true,
    security: prefs?.notifications?.security ?? true,
    system: prefs?.notifications?.system ?? true,
    users: prefs?.notifications?.users ?? true,
    ai: prefs?.notifications?.ai ?? true,
  });
  return (
    <SettingsSection title="Notifications" description="Choose which alerts you receive as an administrator.">
      <SettingsCard>
        {(Object.keys(n) as (keyof typeof n)[]).map((key) => (
          <SettingRow key={key} label={`${key} notifications`}>
            <Switch checked={n[key]} onCheckedChange={(v) => setN({ ...n, [key]: v })} />
          </SettingRow>
        ))}
      </SettingsCard>
      <SaveBar dirty saving={savePrefs.isPending} onCancel={() => undefined} onSave={() => savePrefs.mutate({ notifications: n })} />
    </SettingsSection>
  );
}

function PasswordSection({ minLength }: { minLength: number }) {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const change = trpc.auth.changePassword.useMutation({
    onSuccess: (res) => {
      if ("token" in res && res.token) setAuthToken(res.token);
      toast.success("Password changed.");
      setCurrent(""); setNew(""); setConfirm("");
    },
    onError: (e) => toast.error(e.message),
  });
  const score = passwordScore(newPassword, minLength);
  return (
    <SettingsSection title="Password & Authentication" description={`Minimum length is ${minLength} characters (configurable in System settings).`}>
      <SettingsCard>
        <SettingRow label="Current password"><Input type="password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} /></SettingRow>
        <SettingRow label="New password"><Input type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} /></SettingRow>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full ${score >= 3 ? "bg-emerald-500" : score >= 2 ? "bg-amber-500" : "bg-red-400"}`} style={{ width: `${score * 25}%` }} />
        </div>
        <SettingRow label="Confirm password"><Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></SettingRow>
        <button
          type="button"
          className="rounded-xl bg-[#033c35] px-4 py-2 text-sm text-white disabled:opacity-40"
          disabled={change.isPending || newPassword !== confirm || newPassword.length < minLength}
          onClick={() => change.mutate({ currentPassword, newPassword })}
        >
          Change password
        </button>
      </SettingsCard>
    </SettingsSection>
  );
}

function TwoFactorSection({ enabled }: { enabled: boolean }) {
  const start = trpc.admin.settings.totpStart.useMutation({ onError: (e) => toast.error(e.message) });
  const confirm = trpc.admin.settings.totpConfirm.useMutation({
    onSuccess: (res) => {
      toast.success("Two-factor authentication enabled. Save your recovery codes.");
      setCodes(res.recoveryCodes);
    },
    onError: (e) => toast.error(e.message),
  });
  const disable = trpc.admin.settings.totpDisable.useMutation({
    onSuccess: () => toast.success("Two-factor authentication disabled."),
    onError: (e) => toast.error(e.message),
  });
  const regen = trpc.admin.settings.totpRegenerate.useMutation({
    onSuccess: (res) => { toast.success("New recovery codes generated."); setCodes(res.recoveryCodes); },
    onError: (e) => toast.error(e.message),
  });
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  return (
    <SettingsSection title="Two-Factor Authentication" description="Authenticator-app TOTP. Recovery codes are shown once.">
      <SettingsCard title={enabled ? "Enabled" : "Not enabled"}>
        {!enabled && !start.data ? (
          <button type="button" className="rounded-xl bg-[#033c35] px-4 py-2 text-sm text-white" onClick={() => start.mutate()}>Begin setup</button>
        ) : null}
        {start.data ? (
          <div className="space-y-2 text-sm">
            <p>Add this secret in your authenticator app (shown once):</p>
            <code className="block break-all rounded-lg bg-slate-50 p-2">{start.data.secret}</code>
            <Input placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} />
            <button type="button" className="rounded-xl bg-[#033c35] px-4 py-2 text-white" onClick={() => confirm.mutate({ code })}>Verify and enable</button>
          </div>
        ) : null}
        {enabled ? (
          <div className="space-y-3">
            <Input placeholder="Authenticator or recovery code" value={code} onChange={(e) => setCode(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={() => regen.mutate({ code })}>Regenerate recovery codes</button>
              <button type="button" className="rounded-xl border border-red-200 px-4 py-2 text-sm text-red-700" onClick={() => disable.mutate({ code })}>Disable 2FA</button>
            </div>
          </div>
        ) : null}
        {codes ? (
          <div className="rounded-xl bg-amber-50 p-3 text-sm">
            <p className="font-medium">Recovery codes (store offline):</p>
            <ul className="mt-2 font-mono text-xs">{codes.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
        ) : null}
      </SettingsCard>
    </SettingsSection>
  );
}

function SessionsSection() {
  const q = trpc.admin.settings.session.useQuery();
  const revoke = trpc.admin.settings.revokeOtherSessions.useMutation({
    onSuccess: (res) => {
      if (res.token) setAuthToken(res.token);
      toast.success("Other sessions signed out.");
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <SettingsSection title="Sessions" description={q.data?.note}>
      <SettingsCard>
        <p className="text-sm text-slate-600">Device: {q.data?.current.device}</p>
        <p className="text-sm text-slate-600">Method: {q.data?.current.loginMethod}</p>
        <p className="text-sm text-slate-600">Last active: {q.data?.current.lastActive ? new Date(q.data.current.lastActive).toLocaleString() : "—"}</p>
        <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={() => revoke.mutate()}>Sign out all other sessions</button>
      </SettingsCard>
    </SettingsSection>
  );
}

function SecurityLogsSection() {
  const q = trpc.admin.settings.securityLogs.useQuery();
  return (
    <SettingsSection title="Security Logs" description="Recent authentication and access events.">
      {q.data?.length ? (
        <div className="overflow-hidden rounded-2xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="px-4 py-2">When</th><th className="px-4 py-2">Action</th><th className="px-4 py-2">Target</th></tr></thead>
            <tbody>
              {q.data.map((row) => (
                <tr key={row.id} className="border-t"><td className="px-4 py-2 text-slate-500">{new Date(row.createdAt).toLocaleString()}</td><td className="px-4 py-2">{row.action}</td><td className="px-4 py-2">{row.targetType} #{row.targetId}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState title="No security events yet" body="Login, password, and session events will appear here." />}
    </SettingsSection>
  );
}

function UsersSettingsSection({ onOpenUsers }: { onOpenUsers: () => void }) {
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");
  const force = trpc.admin.settings.forceLogoutUser.useMutation({
    onSuccess: () => toast.success("User sessions invalidated."),
    onError: (e) => toast.error(e.message),
  });
  return (
    <SettingsSection title="Users" description="Create, suspend, and search users in User Management. Force logout is available here.">
      <SettingsCard>
        <button type="button" className="rounded-xl bg-[#033c35] px-4 py-2 text-sm text-white" onClick={onOpenUsers}>Open user management</button>
      </SettingsCard>
      <DangerZone>
        <SettingRow label="User ID"><Input value={userId} onChange={(e) => setUserId(e.target.value)} /></SettingRow>
        <SettingRow label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></SettingRow>
        <button type="button" className="rounded-xl border border-red-200 px-4 py-2 text-sm text-red-700" onClick={() => force.mutate({ userId: Number(userId), reason })}>Force logout</button>
      </DangerZone>
    </SettingsSection>
  );
}

function RolesSection({ settings, save }: { settings: SystemSettings; save: { mutate: (v: { patch: Record<string, unknown> }) => void; isPending: boolean } }) {
  const catalog = trpc.admin.settings.permissionsCatalog.useQuery();
  const [roles, setRoles] = useState(settings.rolePermissions);
  const dirty = JSON.stringify(roles) !== JSON.stringify(settings.rolePermissions);
  return (
    <SettingsSection title="Roles & permissions" description="Built-in roles only: admin, lecturer, student (user). Checks run on the server.">
      {(["admin", "lecturer", "user"] as const).map((role) => (
        <SettingsCard key={role} title={role === "user" ? "Student" : role}>
          {(catalog.data?.permissions ?? []).map((perm) => (
            <label key={perm} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-mono text-xs">{perm}</span>
              <Switch
                checked={(roles[role] ?? []).includes(perm)}
                onCheckedChange={(on) => {
                  const next = new Set(roles[role] ?? []);
                  if (on) next.add(perm); else next.delete(perm);
                  setRoles({ ...roles, [role]: [...next] });
                }}
              />
            </label>
          ))}
        </SettingsCard>
      ))}
      <SaveBar dirty={dirty} saving={save.isPending} onCancel={() => setRoles(settings.rolePermissions)} onSave={() => save.mutate({ patch: { rolePermissions: roles } })} />
    </SettingsSection>
  );
}

function useDraft<T>(initial: T) {
  const [draft, setDraft] = useState(initial);
  useEffect(() => { setDraft(initial); }, [JSON.stringify(initial)]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  return { draft, setDraft, dirty };
}

function GeneralSection({ settings, save }: { settings: SystemSettings; save: { mutate: (v: { patch: Record<string, unknown> }) => void; isPending: boolean } }) {
  const { draft, setDraft, dirty } = useDraft(settings.general);
  const g = draft;
  return (
    <SettingsSection title="General" description="Configure the global behavior and identity of Cognify.">
      <SettingsCard>
        <SettingRow label="System name"><Input value={g.systemName} onChange={(e) => setDraft({ ...g, systemName: e.target.value })} /></SettingRow>
        <SettingRow label="Description"><Input value={g.description} onChange={(e) => setDraft({ ...g, description: e.target.value })} /></SettingRow>
        <SettingRow label="Logo URL"><Input value={g.logoUrl} onChange={(e) => setDraft({ ...g, logoUrl: e.target.value })} /></SettingRow>
        <SettingRow label="Favicon URL"><Input value={g.faviconUrl} onChange={(e) => setDraft({ ...g, faviconUrl: e.target.value })} /></SettingRow>
        <SettingRow label="Default language"><Input value={g.defaultLanguage} onChange={(e) => setDraft({ ...g, defaultLanguage: e.target.value })} /></SettingRow>
        <SettingRow label="Default timezone"><Input value={g.defaultTimezone} onChange={(e) => setDraft({ ...g, defaultTimezone: e.target.value })} /></SettingRow>
        <SettingRow label="Date format"><Input value={g.dateFormat} onChange={(e) => setDraft({ ...g, dateFormat: e.target.value })} /></SettingRow>
        <SettingRow label="Maintenance mode"><Switch checked={g.maintenanceMode} onCheckedChange={(v) => setDraft({ ...g, maintenanceMode: v })} /></SettingRow>
      </SettingsCard>
      <PasswordPolicy settings={settings} save={save} />
      <SaveBar dirty={dirty} saving={save.isPending} onCancel={() => setDraft(settings.general)} onSave={() => save.mutate({ patch: { general: g } })} />
    </SettingsSection>
  );
}

function PasswordPolicy({ settings, save }: { settings: SystemSettings; save: { mutate: (v: { patch: Record<string, unknown> }) => void; isPending: boolean } }) {
  const { draft, setDraft, dirty } = useDraft(settings.passwordPolicy);
  return (
    <>
      <SettingsCard title="Password policy">
        <SettingRow label="Minimum length"><Input type="number" min={8} value={draft.minLength} onChange={(e) => setDraft({ ...draft, minLength: Number(e.target.value) })} /></SettingRow>
      </SettingsCard>
      <SaveBar dirty={dirty} saving={save.isPending} onCancel={() => setDraft(settings.passwordPolicy)} onSave={() => save.mutate({ patch: { passwordPolicy: draft } })} />
    </>
  );
}

function AppearanceSection({ settings, save }: { settings: SystemSettings; save: { mutate: (v: { patch: Record<string, unknown> }) => void; isPending: boolean } }) {
  const { draft, setDraft, dirty } = useDraft(settings.appearance);
  return (
    <SettingsSection title="Appearance" description="Defaults preserve Cognify deep green (#033c35).">
      <SettingsCard>
        <SettingRow label="Primary color"><Input value={draft.primaryColor} onChange={(e) => setDraft({ ...draft, primaryColor: e.target.value })} /></SettingRow>
        <SettingRow label="Secondary color"><Input value={draft.secondaryColor} onChange={(e) => setDraft({ ...draft, secondaryColor: e.target.value })} /></SettingRow>
        <SettingRow label="Login tagline"><Input value={draft.loginTagline} onChange={(e) => setDraft({ ...draft, loginTagline: e.target.value })} /></SettingRow>
      </SettingsCard>
      <SaveBar dirty={dirty} saving={save.isPending} onCancel={() => setDraft(settings.appearance)} onSave={() => save.mutate({ patch: { appearance: draft } })} />
    </SettingsSection>
  );
}

function AcademicSection({ settings, save, onOpen }: { settings: SystemSettings; save: { mutate: (v: { patch: Record<string, unknown> }) => void; isPending: boolean }; onOpen: () => void }) {
  const { draft, setDraft, dirty } = useDraft(settings.academic);
  return (
    <SettingsSection title="Academic" description="Institution defaults used as configuration, not a second course catalog.">
      <SettingsCard>
        <SettingRow label="Academic year"><Input value={draft.academicYear} onChange={(e) => setDraft({ ...draft, academicYear: e.target.value })} /></SettingRow>
        <SettingRow label="Semester"><Input value={draft.semester} onChange={(e) => setDraft({ ...draft, semester: e.target.value })} /></SettingRow>
        <SettingRow label="Faculties"><Input value={draft.faculties} onChange={(e) => setDraft({ ...draft, faculties: e.target.value })} /></SettingRow>
        <SettingRow label="Departments"><Input value={draft.departments} onChange={(e) => setDraft({ ...draft, departments: e.target.value })} /></SettingRow>
        <SettingRow label="Levels"><Input value={draft.levels} onChange={(e) => setDraft({ ...draft, levels: e.target.value })} /></SettingRow>
        <SettingRow label="Default credit hours"><Input type="number" value={draft.creditHoursDefault} onChange={(e) => setDraft({ ...draft, creditHoursDefault: Number(e.target.value) })} /></SettingRow>
        <SettingRow label="Pass mark"><Input type="number" value={draft.passMark} onChange={(e) => setDraft({ ...draft, passMark: Number(e.target.value) })} /></SettingRow>
        <SettingRow label="Grading system"><Input value={draft.gradingSystem} onChange={(e) => setDraft({ ...draft, gradingSystem: e.target.value })} /></SettingRow>
        <SettingRow label="Assessment types"><Input value={draft.assessmentTypes} onChange={(e) => setDraft({ ...draft, assessmentTypes: e.target.value })} /></SettingRow>
        <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={onOpen}>Open course allocation</button>
      </SettingsCard>
      <SaveBar dirty={dirty} saving={save.isPending} onCancel={() => setDraft(settings.academic)} onSave={() => save.mutate({ patch: { academic: draft } })} />
    </SettingsSection>
  );
}

function SystemNotificationsSection({ settings, save }: { settings: SystemSettings; save: { mutate: (v: { patch: Record<string, unknown> }) => void; isPending: boolean } }) {
  const { draft, setDraft, dirty } = useDraft(settings.notifications);
  return (
    <SettingsSection title="System notifications" description="Defaults copied into new administrator preference records.">
      <SettingsCard>
        {(Object.keys(draft) as (keyof typeof draft)[]).map((key) => (
          <SettingRow key={key} label={String(key)}>
            <Switch checked={draft[key]} onCheckedChange={(v) => setDraft({ ...draft, [key]: v })} />
          </SettingRow>
        ))}
      </SettingsCard>
      <SaveBar dirty={dirty} saving={save.isPending} onCancel={() => setDraft(settings.notifications)} onSave={() => save.mutate({ patch: { notifications: draft } })} />
    </SettingsSection>
  );
}

function MaintenanceSection({ settings, save }: { settings: SystemSettings; save: { mutate: (v: { patch: Record<string, unknown> }) => void; isPending: boolean } }) {
  const [on, setOn] = useState(settings.general.maintenanceMode);
  return (
    <SettingsSection title="Maintenance" description="Blocks student and lecturer APIs while administrators remain signed in.">
      <SettingsCard>
        <SettingRow label="Maintenance mode">
          <Switch checked={on} onCheckedChange={setOn} />
        </SettingRow>
      </SettingsCard>
      <SaveBar dirty={on !== settings.general.maintenanceMode} saving={save.isPending} onCancel={() => setOn(settings.general.maintenanceMode)} onSave={() => save.mutate({ patch: { general: { ...settings.general, maintenanceMode: on } } })} />
    </SettingsSection>
  );
}

function AiProvidersSection() {
  const q = trpc.admin.settings.integrations.useQuery();
  const test = trpc.admin.settings.testLmStudio.useMutation({
    onSuccess: (r) => toast.success(r.message),
    onError: (e) => toast.error(e.message),
  });
  return (
    <SettingsSection title="AI Providers" description="Keys stay in server environment variables and are never returned to the browser.">
      <SettingsCard>
        {q.data ? Object.entries(q.data).filter(([k]) => ["lmStudio", "gemini"].includes(k)).map(([key, val]) => (
          <SettingRow key={key} label={key} description={val.detail}>
            <StatusBadge status={val.status} />
          </SettingRow>
        )) : <LoadingState />}
        <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={() => test.mutate()}>Test LM Studio</button>
      </SettingsCard>
    </SettingsSection>
  );
}

function ModelsSection({ settings, save }: { settings: SystemSettings; save: { mutate: (v: { patch: Record<string, unknown> }) => void; isPending: boolean } }) {
  const { draft, setDraft, dirty } = useDraft(settings.ai);
  return (
    <SettingsSection title="Models" description="Empty model name uses the LM Studio default from the server environment.">
      <SettingsCard>
        <SettingRow label="Provider">
          <select className="h-10 w-full rounded-md border px-3 text-sm" value={draft.provider} onChange={(e) => setDraft({ ...draft, provider: e.target.value as typeof draft.provider })}>
            <option value="lmstudio">LM Studio / OpenAI-compatible</option>
            <option value="gemini">Gemini (Forge)</option>
            <option value="openai">OpenAI-compatible</option>
          </select>
        </SettingRow>
        <SettingRow label="Model"><Input value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} /></SettingRow>
        <SettingRow label="Temperature"><Input type="number" step="0.1" value={draft.temperature} onChange={(e) => setDraft({ ...draft, temperature: Number(e.target.value) })} /></SettingRow>
        <SettingRow label="Max output tokens"><Input type="number" value={draft.maxTokens} onChange={(e) => setDraft({ ...draft, maxTokens: Number(e.target.value) })} /></SettingRow>
      </SettingsCard>
      <SaveBar dirty={dirty} saving={save.isPending} onCancel={() => setDraft(settings.ai)} onSave={() => save.mutate({ patch: { ai: draft } })} />
    </SettingsSection>
  );
}

function RagSection({ settings, save }: { settings: SystemSettings; save: { mutate: (v: { patch: Record<string, unknown> }) => void; isPending: boolean } }) {
  const { draft, setDraft, dirty } = useDraft(settings.ai.rag);
  return (
    <SettingsSection title="RAG Configuration" description="Applied on the next index or retrieval. Re-index from Developer Settings after changing chunk size.">
      <SettingsCard>
        <SettingRow label="Chunk size"><Input type="number" value={draft.chunkSize} onChange={(e) => setDraft({ ...draft, chunkSize: Number(e.target.value) })} /></SettingRow>
        <SettingRow label="Chunk overlap"><Input type="number" value={draft.chunkOverlap} onChange={(e) => setDraft({ ...draft, chunkOverlap: Number(e.target.value) })} /></SettingRow>
        <SettingRow label="Top-K"><Input type="number" value={draft.topK} onChange={(e) => setDraft({ ...draft, topK: Number(e.target.value) })} /></SettingRow>
        <SettingRow label="Similarity threshold"><Input type="number" step="0.05" value={draft.similarityThreshold} onChange={(e) => setDraft({ ...draft, similarityThreshold: Number(e.target.value) })} /></SettingRow>
        <SettingRow label="Max retrieved context"><Input type="number" value={draft.maxContext} onChange={(e) => setDraft({ ...draft, maxContext: Number(e.target.value) })} /></SettingRow>
      </SettingsCard>
      <SaveBar dirty={dirty} saving={save.isPending} onCancel={() => setDraft(settings.ai.rag)} onSave={() => save.mutate({ patch: { ai: { ...settings.ai, rag: draft } } })} />
    </SettingsSection>
  );
}

function FlagsSection({ settings, save }: { settings: SystemSettings; save: { mutate: (v: { patch: Record<string, unknown> }) => void; isPending: boolean } }) {
  const { draft, setDraft, dirty } = useDraft(settings.features);
  return (
    <SettingsSection title="Feature flags" description="Disabled flags return an error from the related APIs.">
      <SettingsCard>
        {(Object.keys(draft) as (keyof typeof draft)[]).map((key) => (
          <SettingRow key={key} label={String(key)}>
            <Switch checked={draft[key]} onCheckedChange={(v) => setDraft({ ...draft, [key]: v })} />
          </SettingRow>
        ))}
      </SettingsCard>
      <SaveBar dirty={dirty} saving={save.isPending} onCancel={() => setDraft(settings.features)} onSave={() => save.mutate({ patch: { features: draft } })} />
    </SettingsSection>
  );
}

function ContentSection({ settings, save }: { settings: SystemSettings; save: { mutate: (v: { patch: Record<string, unknown> }) => void; isPending: boolean } }) {
  const { draft, setDraft, dirty } = useDraft(settings.content);
  return (
    <SettingsSection title="Content" description="Upload and course defaults.">
      <SettingsCard>
        <SettingRow label="Max upload (MB)"><Input type="number" value={draft.maxUploadMb} onChange={(e) => setDraft({ ...draft, maxUploadMb: Number(e.target.value) })} /></SettingRow>
        <SettingRow label="Allowed types"><Input value={draft.allowedTypes} onChange={(e) => setDraft({ ...draft, allowedTypes: e.target.value })} /></SettingRow>
        <SettingRow label="Auto-index"><Switch checked={draft.autoIndex} onCheckedChange={(v) => setDraft({ ...draft, autoIndex: v })} /></SettingRow>
        <SettingRow label="Course visibility"><Input value={draft.courseVisibility} onChange={(e) => setDraft({ ...draft, courseVisibility: e.target.value })} /></SettingRow>
        <SettingRow label="Enrollment"><Input value={draft.enrollment} onChange={(e) => setDraft({ ...draft, enrollment: e.target.value })} /></SettingRow>
      </SettingsCard>
      <SaveBar dirty={dirty} saving={save.isPending} onCancel={() => setDraft(settings.content)} onSave={() => save.mutate({ patch: { content: draft } })} />
    </SettingsSection>
  );
}

function QuizSection({ settings, save }: { settings: SystemSettings; save: { mutate: (v: { patch: Record<string, unknown> }) => void; isPending: boolean } }) {
  const { draft, setDraft, dirty } = useDraft(settings.quizzes);
  return (
    <SettingsSection title="Quizzes" description="Defaults for generated quizzes.">
      <SettingsCard>
        <SettingRow label="Default duration (minutes)"><Input type="number" value={draft.defaultDurationMinutes} onChange={(e) => setDraft({ ...draft, defaultDurationMinutes: Number(e.target.value) })} /></SettingRow>
        <SettingRow label="Attempt limit"><Input type="number" value={draft.attemptLimit} onChange={(e) => setDraft({ ...draft, attemptLimit: Number(e.target.value) })} /></SettingRow>
        <SettingRow label="Passing score"><Input type="number" value={draft.passingScore} onChange={(e) => setDraft({ ...draft, passingScore: Number(e.target.value) })} /></SettingRow>
        <SettingRow label="Randomize"><Switch checked={draft.randomize} onCheckedChange={(v) => setDraft({ ...draft, randomize: v })} /></SettingRow>
        <SettingRow label="Show results"><Switch checked={draft.showResults} onCheckedChange={(v) => setDraft({ ...draft, showResults: v })} /></SettingRow>
      </SettingsCard>
      <SaveBar dirty={dirty} saving={save.isPending} onCancel={() => setDraft(settings.quizzes)} onSave={() => save.mutate({ patch: { quizzes: draft } })} />
    </SettingsSection>
  );
}

function AssignmentSection({ settings, save }: { settings: SystemSettings; save: { mutate: (v: { patch: Record<string, unknown> }) => void; isPending: boolean } }) {
  const { draft, setDraft, dirty } = useDraft(settings.assignments);
  return (
    <SettingsSection title="Assignments" description="Default submission rules.">
      <SettingsCard>
        <SettingRow label="Max file size (MB)"><Input type="number" value={draft.maxFileMb} onChange={(e) => setDraft({ ...draft, maxFileMb: Number(e.target.value) })} /></SettingRow>
        <SettingRow label="Allowed types"><Input value={draft.allowedTypes} onChange={(e) => setDraft({ ...draft, allowedTypes: e.target.value })} /></SettingRow>
        <SettingRow label="Late submissions"><Switch checked={draft.lateSubmissions} onCheckedChange={(v) => setDraft({ ...draft, lateSubmissions: v })} /></SettingRow>
      </SettingsCard>
      <SaveBar dirty={dirty} saving={save.isPending} onCancel={() => setDraft(settings.assignments)} onSave={() => save.mutate({ patch: { assignments: draft } })} />
    </SettingsSection>
  );
}

function StorageSection({ settings }: { settings: SystemSettings }) {
  const health = trpc.admin.settings.health.useQuery();
  const bytes = Number(health.data?.storage?.bytes ?? 0);
  return (
    <SettingsSection title="Storage" description="Local document storage on this server.">
      <SettingsCard>
        <SettingRow label="Used">{(bytes / (1024 * 1024)).toFixed(1)} MB</SettingRow>
        <SettingRow label="Documents">{String(health.data?.storage?.count ?? 0)}</SettingRow>
        <SettingRow label="Max upload (MB)"><Input type="number" value={settings.content.maxUploadMb} disabled /></SettingRow>
      </SettingsCard>
      <p className="text-xs text-slate-500">Change upload limits under Content → Documents.</p>
    </SettingsSection>
  );
}

function BackupsSection({ superAdmin }: { superAdmin: boolean }) {
  const q = trpc.admin.settings.backups.useQuery();
  const create = trpc.admin.settings.createBackup.useMutation({
    onSuccess: () => { toast.success("Backup created."); q.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.admin.settings.deleteBackup.useMutation({
    onSuccess: () => { toast.success("Backup deleted."); q.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const restore = trpc.admin.settings.restoreBackup.useMutation({
    onSuccess: (r) => toast.success(r.message),
    onError: (e) => toast.error(e.message),
  });
  return (
    <SettingsSection title="Backups" description="Copies of the SQLite database. Restore stages a file; you must restart the server.">
      <SettingsCard>
        <button type="button" className="rounded-xl bg-[#033c35] px-4 py-2 text-sm text-white" onClick={() => create.mutate()}>Create backup</button>
        {q.data?.length ? (
          <ul className="space-y-2 text-sm">
            {q.data.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
                <span>{b.fileName} · {(b.sizeBytes / 1024).toFixed(0)} KB · {new Date(b.createdAt).toLocaleString()}</span>
                <span className="flex gap-2">
                  <button type="button" className="text-red-600" onClick={() => del.mutate({ id: b.id, confirm: "DELETE" })}>Delete</button>
                  {superAdmin ? <button type="button" onClick={() => restore.mutate({ id: b.id, confirm: "RESTORE" })}>Restore</button> : null}
                </span>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="No backups" body="Create a manual backup to get started." />}
      </SettingsCard>
    </SettingsSection>
  );
}

function ExportSection() {
  const users = trpc.admin.settings.exportUsers.useMutation({
    onSuccess: (rows) => {
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "cognify-users.json"; a.click();
      toast.success("Users exported.");
    },
    onError: (e) => toast.error(e.message),
  });
  const courses = trpc.admin.settings.exportCourses.useMutation({
    onSuccess: (rows) => {
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "cognify-courses.json"; a.click();
      toast.success("Courses exported.");
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <SettingsSection title="Import / Export" description="JSON exports omit password hashes and secrets. Dataset import is not implemented.">
      <SettingsCard>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={() => users.mutate()}>Export users</button>
          <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={() => courses.mutate()}>Export courses</button>
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}

function RetentionSection({ settings, save, superAdmin }: { settings: SystemSettings; save: { mutate: (v: { patch: Record<string, unknown> }) => void; isPending: boolean }; superAdmin: boolean }) {
  const { draft, setDraft, dirty } = useDraft(settings.data);
  const [confirm, setConfirm] = useState("");
  const apply = trpc.admin.settings.applyRetention.useMutation({
    onSuccess: (r) => toast.success(`Removed ${r.auditDeleted} audit rows.`),
    onError: (e) => toast.error(e.message),
  });
  return (
    <SettingsSection title="Data Retention" description="Applying retention permanently deletes old audit rows. Type APPLY RETENTION to confirm.">
      <SettingsCard>
        <SettingRow label="User retention days (0 = keep)"><Input type="number" value={draft.userRetentionDays} onChange={(e) => setDraft({ ...draft, userRetentionDays: Number(e.target.value) })} /></SettingRow>
        <SettingRow label="Chat retention days"><Input type="number" value={draft.chatRetentionDays} onChange={(e) => setDraft({ ...draft, chatRetentionDays: Number(e.target.value) })} /></SettingRow>
        <SettingRow label="Audit retention days"><Input type="number" value={draft.auditRetentionDays} onChange={(e) => setDraft({ ...draft, auditRetentionDays: Number(e.target.value) })} /></SettingRow>
        <SettingRow label="Document retention days"><Input type="number" value={draft.documentRetentionDays} onChange={(e) => setDraft({ ...draft, documentRetentionDays: Number(e.target.value) })} /></SettingRow>
      </SettingsCard>
      <SaveBar dirty={dirty} saving={save.isPending} onCancel={() => setDraft(settings.data)} onSave={() => save.mutate({ patch: { data: draft } })} />
      {superAdmin ? (
        <DangerZone>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder='Type APPLY RETENTION' />
          <button type="button" disabled={confirm !== "APPLY RETENTION"} className="rounded-xl bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-40" onClick={() => apply.mutate({ confirm: "APPLY RETENTION" })}>Apply retention now</button>
        </DangerZone>
      ) : null}
    </SettingsSection>
  );
}

function IntegrationsSection({ focus }: { focus: string }) {
  const q = trpc.admin.settings.integrations.useQuery();
  const testEmail = trpc.admin.settings.sendTestEmail.useMutation({
    onSuccess: () => toast.success("Test email sent."),
    onError: (e) => toast.error(e.message),
  });
  const [to, setTo] = useState("");
  const data = q.data;
  return (
    <SettingsSection title="Integrations" description="Status only. Secrets remain on the server.">
      <SettingsCard>
        {data ? Object.entries(data).map(([key, val]) => (
          <SettingRow key={key} label={key} description={val.detail}><StatusBadge status={val.status} /></SettingRow>
        )) : <LoadingState />}
        {focus === "email" ? (
          <div className="flex gap-2">
            <Input placeholder="you@university.edu" value={to} onChange={(e) => setTo(e.target.value)} />
            <button type="button" className="rounded-xl border px-3 text-sm" onClick={() => testEmail.mutate({ to })}>Send test</button>
          </div>
        ) : null}
      </SettingsCard>
    </SettingsSection>
  );
}

function HealthSection() {
  const q = trpc.admin.settings.health.useQuery(undefined, { refetchInterval: 15000 });
  const d = q.data;
  return (
    <SettingsSection title="System Health" description="Live checks. Background jobs share Operations.">
      <SettingsCard>
        {d ? (
          <>
            <SettingRow label="Backend"><StatusBadge status={d.backend} /></SettingRow>
            <SettingRow label="Database"><StatusBadge status={d.database} /></SettingRow>
            <SettingRow label="Authentication"><StatusBadge status={d.authentication} /></SettingRow>
            <SettingRow label="AI / LM Studio"><StatusBadge status={d.ai} /></SettingRow>
            <SettingRow label="Email">{d.email ? "Configured" : "Unavailable"}</SettingRow>
            <SettingRow label="Google auth">{d.googleAuth ? "Configured" : "Not connected"}</SettingRow>
          </>
        ) : <LoadingState />}
      </SettingsCard>
    </SettingsSection>
  );
}

function ActivitySection() {
  const q = trpc.admin.settings.activity.useQuery();
  return (
    <SettingsSection title="Activity" description="Recent privileged actions.">
      {q.data?.length ? (
        <div className="overflow-hidden rounded-2xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="px-4 py-2">When</th><th className="px-4 py-2">Action</th><th className="px-4 py-2">Target</th></tr></thead>
            <tbody>{q.data.map((row) => <tr key={row.id} className="border-t"><td className="px-4 py-2">{new Date(row.createdAt).toLocaleString()}</td><td className="px-4 py-2">{row.action}</td><td className="px-4 py-2">{row.targetType} #{row.targetId}</td></tr>)}</tbody>
          </table>
        </div>
      ) : <EmptyState title="No activity" body="Administrator actions will show up here." />}
    </SettingsSection>
  );
}

function ApiSection({ settings, save }: { settings: SystemSettings; save: { mutate: (v: { patch: Record<string, unknown> }) => void; isPending: boolean } }) {
  const { draft, setDraft, dirty } = useDraft(settings.api);
  return (
    <SettingsSection title="API" description="tRPC HTTP API. Stored rate-limit is informational unless a limiter is later wired globally.">
      <SettingsCard>
        <SettingRow label="Version"><Input value={draft.version} disabled /></SettingRow>
        <SettingRow label="Rate limit / minute (0 = off)"><Input type="number" value={draft.rateLimitPerMinute} onChange={(e) => setDraft({ ...draft, rateLimitPerMinute: Number(e.target.value) })} /></SettingRow>
      </SettingsCard>
      <SaveBar dirty={dirty} saving={save.isPending} onCancel={() => setDraft(settings.api)} onSave={() => save.mutate({ patch: { api: draft } })} />
    </SettingsSection>
  );
}

function DeveloperSection({ superAdmin }: { superAdmin: boolean }) {
  const [confirm, setConfirm] = useState("");
  const reindex = trpc.admin.settings.reindexDocuments.useMutation({
    onSuccess: (r) => toast.success(`Re-indexed ${r.indexed} documents.`),
    onError: (e) => toast.error(e.message),
  });
  const reset = trpc.admin.settings.resetSettings.useMutation({
    onSuccess: () => toast.success("Settings reset to defaults."),
    onError: (e) => toast.error(e.message),
  });
  if (!superAdmin) {
    return <SettingsSection title="Developer Settings" description="Restricted to Super Admin."><EmptyState title="Access denied" body="Ask a Super Admin for access." /></SettingsSection>;
  }
  return (
    <SettingsSection title="Developer Settings" description="Environment diagnostics. JWT secrets and API keys are never displayed.">
      <SettingsCard title="Environment">
        <p className="text-sm text-slate-600">Node environment is reported by the process, not by this UI. Vector re-index uses stored extracted text.</p>
        <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={() => reindex.mutate()}>Re-index documents</button>
      </SettingsCard>
      <DangerZone>
        <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type RESET SETTINGS" />
        <button type="button" disabled={confirm !== "RESET SETTINGS"} className="rounded-xl bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-40" onClick={() => reset.mutate({ confirm: "RESET SETTINGS" })}>Reset configuration</button>
      </DangerZone>
    </SettingsSection>
  );
}
