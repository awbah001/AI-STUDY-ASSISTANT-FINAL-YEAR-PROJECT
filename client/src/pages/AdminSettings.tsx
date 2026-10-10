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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { storagePut } from "@/lib/storage";
import { trpc } from "@/lib/trpc";
import { setAuthToken } from "@/lib/authToken";
import { SETTINGS_NAV, findSystemSettingsError, type SystemSettings } from "@shared/adminSettings";
import { FieldError } from "@/components/FieldError";
import { useFieldErrors } from "@/lib/formValidation";
import {
  LIMITS,
  MESSAGES,
  validateEmail,
  validateNewPassword,
  validateNumber,
  validatePasswordConfirm,
  validatePersonName,
  validatePhone,
  validateText,
  validateTotpCode,
} from "@shared/validation";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Bell, LockKeyhole, Laptop, KeyRound, FileText, Server, Menu, Search, User, Shield, Users, SlidersHorizontal, Sparkles,
  FileStack, HardDrive, Plug, Activity, Code2, X,
  Mail, Phone, Briefcase, Calendar, Camera, Pencil, Save, Loader2, ChevronDown,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const AVATAR_MAX_BYTES = 3 * 1024 * 1024;

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

const ITEM_ICONS: Record<string, typeof User> = { profile: User, preferences: SlidersHorizontal, notifications: Bell, password: LockKeyhole, twofactor: Shield, sessions: Laptop, "security-logs": FileText, users: Users, roles: KeyRound, permissions: Shield, general: Server };

const DESCRIPTIONS: Record<string, { title: string; body: string }> = {
  profile: { title: "Profile", body: "Your administrator identity on the platform. Keep your information up to date." },
  preferences: { title: "Preferences", body: "Personal display and navigation preferences for this account." },
  notifications: { title: "Notifications", body: "Choose which alerts you receive as an administrator." },
  password: { title: "Password & Authentication", body: "Change your password. Policy minimum length is enforced server-side." },
  twofactor: { title: "Two-Factor Authentication", body: "Protect this administrator account with TOTP and recovery codes." },
  sessions: { title: "Sessions", body: "The platform uses JWT sessions. Signing out others invalidates existing tokens." },
  "security-logs": { title: "Security Logs", body: "Recent authentication and access events." },
  users: { title: "Users", body: "User administration lives in User Management. Force-logout is available here." },
  roles: { title: "Roles", body: "Permission sets for the built-in roles. Custom extra roles are not supported." },
  permissions: { title: "Permissions", body: "Granular capabilities checked on the server, not only in the UI." },
  general: { title: "General", body: "Configure the global behavior and identity of the platform." },
  appearance: { title: "Appearance", body: "Brand colors default to the platform's deep green. Changing them does not restyle the whole app immediately." },
  academic: { title: "Academic", body: "Institution defaults. Course catalog management remains on the Academic page." },
  "sys-notifications": { title: "System notifications", body: "Default notification channels for new administrator preference records." },
  maintenance: { title: "Maintenance", body: "When enabled, students and lecturers cannot use product APIs." },
  "ai-providers": { title: "AI Providers", body: "Groq cloud status. API keys are never shown." },
  models: { title: "Models", body: "Groq model name and generation parameters. Leave model empty to use GROQ_MODEL." },
  rag: { title: "RAG Configuration", body: "Chunking and retrieval used when indexing and answering from documents." },
  "ai-features": { title: "AI Features", body: "Toggles that the backend actually enforces." },
  "autonomous-agent": { title: "Autonomous Agent", body: "Background study coach that checks on students and acts without being asked." },
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
  "storage-int": { title: "Cloud Storage", body: "The platform stores files locally in data/uploads. Object storage is not configured." },
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

  const meta = DESCRIPTIONS[section] ?? { title: "Settings", body: "Configure the platform." };

  return (
    <DashboardLayout>
      <div className="admin-settings flex flex-col gap-6 lg:flex-row lg:items-start">
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
                  placeholder="Search settings..."
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
                            ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        {(() => { const ItemIcon = ITEM_ICONS[item.id] ?? GROUP_ICONS[group.id] ?? SlidersHorizontal; return <ItemIcon className="mr-4 h-5 w-5 shrink-0" />; })()}
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
          {section !== "profile" ? (
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Settings / {meta.title}</p>
          ) : null}
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
  const saveMutation = trpc.admin.settings.save.useMutation({
    onSuccess: async () => {
      toast.success("Settings saved successfully.");
      await utils.admin.settings.get.invalidate();
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const save = {
    isPending: saveMutation.isPending,
    mutate: (v: { patch: Record<string, unknown> }) => {
      const next: Record<string, unknown> = { ...settings };
      for (const [key, value] of Object.entries(v.patch)) {
        const current = next[key];
        next[key] = current && typeof current === "object" && value && typeof value === "object" && !Array.isArray(value)
          ? { ...current, ...value }
          : value;
      }
      const problem = findSystemSettingsError(next as SystemSettings);
      if (problem) {
        toast.error(problem);
        return;
      }
      saveMutation.mutate(v as Parameters<typeof saveMutation.mutate>[0]);
    },
  };
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
  if (section === "autonomous-agent") return <AutonomousAgentSection settings={settings} save={save} />;
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
          <button type="button" className="rounded-xl border border-burgundy-border px-4 py-2 text-sm font-medium text-burgundy transition hover:bg-burgundy-soft" onClick={() => setLocation("/admin/audit")}>
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
  me: {
    id: number;
    name: string | null;
    email: string | null;
    phone: string | null;
    jobTitle: string | null;
    role: string;
    avatarUrl: string | null;
    createdAt: Date;
  };
  updateAccount: {
    mutate: (v: { name?: string; phone?: string; jobTitle?: string; email?: string }) => void;
    isPending: boolean;
  };
}) {
  const { refresh } = useAuth();
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [name, setName] = useState(me.name ?? "");
  const [phone, setPhone] = useState(me.phone ?? "");
  const [jobTitle, setJobTitle] = useState(me.jobTitle ?? "");
  const { errors, check, clear } = useFieldErrors<"name" | "email" | "phone" | "jobTitle">();
  const [email, setEmail] = useState(me.email ?? "");

  useEffect(() => {
    setName(me.name ?? "");
    setPhone(me.phone ?? "");
    setJobTitle(me.jobTitle ?? "");
    setEmail(me.email ?? "");
  }, [me.name, me.phone, me.jobTitle, me.email]);

  const dirty =
    name !== (me.name ?? "") ||
    phone !== (me.phone ?? "") ||
    jobTitle !== (me.jobTitle ?? "") ||
    email !== (me.email ?? "");

  const updateAvatar = trpc.auth.updateProfile.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      await utils.admin.settings.get.invalidate();
      await refresh();
      toast.success("Photo updated.");
    },
    onError: (e) => toast.error(e.message || "Could not update photo"),
  });

  const discard = () => {
    setName(me.name ?? "");
    setPhone(me.phone ?? "");
    setJobTitle(me.jobTitle ?? "");
    setEmail(me.email ?? "");
  };

  const handleAvatarPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      toast.error("Use JPEG, PNG, WebP, or GIF");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("Image must be 3 MB or smaller");
      return;
    }
    setAvatarUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const ext =
        file.type === "image/jpeg"
          ? "jpg"
          : file.type === "image/png"
            ? "png"
            : file.type === "image/webp"
              ? "webp"
              : "gif";
      const key = `avatars/${me.id}-${Date.now()}.${ext}`;
      const { url } = await storagePut(key, new Uint8Array(buf), file.type);
      await updateAvatar.mutateAsync({ avatarUrl: url });
    } catch {
      toast.error("Upload failed");
    } finally {
      setAvatarUploading(false);
    }
  };

  const roleLabel = me.role === "admin" ? "Admin" : me.role;

  return (
    <section className="admin-profile space-y-6">
      <div className="relative overflow-hidden rounded-[1.35rem] border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-[min(52%,420px)] bg-[linear-gradient(135deg,rgba(6,95,70,0.92)_0%,rgba(16,185,129,0.75)_45%,rgba(167,243,208,0.55)_100%)]"
        >
          <svg className="absolute inset-0 h-full w-full opacity-90" viewBox="0 0 420 180" preserveAspectRatio="none">
            <path
              d="M0 110 C70 70 110 150 180 100 C250 50 300 140 420 70 L420 180 L0 180 Z"
              fill="rgba(255,255,255,0.12)"
            />
            <path
              d="M0 130 C90 90 140 160 220 120 C300 80 340 150 420 100 L420 180 L0 180 Z"
              fill="rgba(4,60,50,0.28)"
            />
          </svg>
        </div>
        <div className="relative z-[1] flex items-center justify-between gap-4 px-5 py-6 sm:px-7 sm:py-7">
          <div className="min-w-0 max-w-xl">
            <p className="admin-eyebrow">Settings / Profile</p>
            <h1 className="text-[1.7rem] font-bold tracking-tight text-slate-900">Profile</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
              Your administrator identity on the platform. Keep your information up to date.
            </p>
          </div>
          <div className="hidden shrink-0 sm:flex h-14 w-14 items-center justify-center rounded-2xl border border-white/70 bg-white/95 text-emerald-700 shadow-md">
            <User className="h-7 w-7" strokeWidth={1.6} />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="admin-profile-heading min-w-0">
            <span className="admin-profile-icon"><User /></span>
            <h2 className="text-base font-semibold text-slate-900">Personal Information</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              This information is used for your account and platform identification.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl border-slate-200 text-slate-700"
              disabled={avatarUploading || updateAvatar.isPending}
              onClick={() => fileRef.current?.click()}
            >
              {avatarUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              Change Photo
            </Button>
            <div className="relative shrink-0">
              <Avatar className="h-14 w-14 border-2 border-white shadow-md ring-1 ring-slate-200">
                {me.avatarUrl ? <AvatarImage src={me.avatarUrl} alt="" className="object-cover" /> : null}
                <AvatarFallback className="bg-emerald-600 text-lg font-bold text-white">
                  {(me.name ?? "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                aria-label="Edit photo"
                disabled={avatarUploading || updateAvatar.isPending}
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-burgundy text-white shadow ring-2 ring-white hover:bg-burgundy-hover disabled:opacity-50"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={AVATAR_TYPES.join(",")}
                className="hidden"
                onChange={handleAvatarPick}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-x-5 gap-y-5 px-5 py-6 sm:grid-cols-2 sm:px-6">
          <IconField
            label="Full name"
            icon={<User className="h-4 w-4" />}
            value={name}
            onChange={v => { setName(v); clear("name"); }}
            placeholder="Your full name"
            maxLength={100}
            error={errors.name}
          />
          <IconField
            label="Email address"
            icon={<Mail className="h-4 w-4" />}
            type="email"
            value={email}
            onChange={v => { setEmail(v); clear("email"); }}
            placeholder="you@central.edu.sl"
            maxLength={254}
            error={errors.email}
          />
          <IconField
            label="Phone number"
            icon={<Phone className="h-4 w-4" />}
            type="tel"
            value={phone}
            onChange={v => { setPhone(v); clear("phone"); }}
            placeholder="Enter phone number (optional)"
            maxLength={30}
            error={errors.phone}
          />
          <IconField
            label="Job title"
            icon={<Briefcase className="h-4 w-4" />}
            value={jobTitle}
            onChange={v => { setJobTitle(v); clear("jobTitle"); }}
            placeholder="e.g. Administrator"
            maxLength={LIMITS.shortText}
            error={errors.jobTitle}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Role</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Shield className="h-4 w-4" />
              </span>
              <select
                value={roleLabel}
                disabled
                aria-label="Role"
                className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-700 outline-none disabled:cursor-not-allowed"
              >
                <option value={roleLabel}>{roleLabel}</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
          <IconField
            label="Account created"
            icon={<Calendar className="h-4 w-4" />}
            value={new Date(me.createdAt).toLocaleString()}
            disabled
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-4 sm:px-6">
          <Button
            type="button"
            variant="ghost"
            className="rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            disabled={!dirty || updateAccount.isPending}
            onClick={discard}
          >
            Discard changes
          </Button>
          <Button
            type="button"
            className="rounded-xl bg-[#0b7a5c] px-4 text-white hover:bg-[#09684e]"
            disabled={!dirty || updateAccount.isPending}
            onClick={() => {
              const ok = check({
                name: validatePersonName(name, "Full name"),
                email: validateEmail(email),
                phone: validatePhone(phone),
                jobTitle: validateText(jobTitle, { label: "Job title", required: false, max: LIMITS.shortText }),
              });
              if (ok) updateAccount.mutate({ name: name.trim(), phone: phone.trim(), jobTitle: jobTitle.trim(), email: email.trim() });
            }}
          >
            {updateAccount.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save changes
          </Button>
        </div>
      </div>
    </section>
  );
}

function IconField({
  label,
  icon,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
  error,
  maxLength,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  error?: string | null;
  maxLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
        <Input
          type={type}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={disabled || !onChange}
          maxLength={maxLength}
          aria-invalid={Boolean(error)}
          className="h-11 rounded-xl border-slate-200 pl-10 focus-visible:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-600"
        />
      </div>
      <FieldError message={error} />
    </div>
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
  const { errors, check, clear } = useFieldErrors<"current" | "next" | "confirm">();
  const submit = () => {
    const ok = check({
      current: currentPassword ? null : "Enter your current password.",
      next:
        validateNewPassword(newPassword) ??
        (newPassword.length < minLength ? `Password must be at least ${minLength} characters.` : null) ??
        (newPassword === currentPassword ? "Choose a password that is different from your current one." : null),
      confirm: validatePasswordConfirm(newPassword, confirm),
    });
    if (ok) change.mutate({ currentPassword, newPassword });
  };
  return (
    <SettingsSection title="Password & Authentication" description={`Minimum length is ${minLength} characters, with at least one letter and one number.`}>
      <SettingsCard>
        <SettingRow label="Current password">
          <Input type="password" autoComplete="current-password" aria-invalid={Boolean(errors.current)} value={currentPassword} onChange={(e) => { setCurrent(e.target.value); clear("current"); }} />
          <FieldError message={errors.current} />
        </SettingRow>
        <SettingRow label="New password">
          <Input type="password" autoComplete="new-password" aria-invalid={Boolean(errors.next)} value={newPassword} onChange={(e) => { setNew(e.target.value); clear("next"); }} />
          <FieldError message={errors.next} />
        </SettingRow>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full ${score >= 3 ? "bg-emerald-500" : score >= 2 ? "bg-amber-500" : "bg-red-400"}`} style={{ width: `${score * 25}%` }} />
        </div>
        <SettingRow label="Confirm password">
          <Input type="password" autoComplete="new-password" aria-invalid={Boolean(errors.confirm)} value={confirm} onChange={(e) => { setConfirm(e.target.value); clear("confirm"); }} />
          <FieldError message={errors.confirm} />
        </SettingRow>
        <button
          type="button"
          className="rounded-xl bg-[#033c35] px-4 py-2 text-sm text-white disabled:opacity-40"
          disabled={change.isPending}
          onClick={submit}
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
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const withCode = (run: (code: string) => void, setupOnly = false) => {
    const cleaned = code.replace(/\s+/g, "");
    const error = setupOnly ? (/^\d{6}$/.test(cleaned) ? null : MESSAGES.codeInvalid) : validateTotpCode(cleaned);
    setCodeError(error);
    if (!error) run(cleaned);
  };
  const codeInput = (placeholder: string) => (
    <>
      <Input
        placeholder={placeholder}
        autoComplete="one-time-code"
        maxLength={64}
        aria-invalid={Boolean(codeError)}
        value={code}
        onChange={(e) => { setCode(e.target.value); setCodeError(null); }}
      />
      <FieldError message={codeError} />
    </>
  );
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
            {codeInput("6-digit code")}
            <button type="button" className="rounded-xl bg-[#033c35] px-4 py-2 text-white" onClick={() => withCode((c) => confirm.mutate({ code: c }), true)}>Verify and enable</button>
          </div>
        ) : null}
        {enabled ? (
          <div className="space-y-3">
            {codeInput("Authenticator or recovery code")}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={() => withCode((c) => regen.mutate({ code: c }), true)}>Regenerate recovery codes</button>
              <button type="button" className="rounded-xl border border-red-200 px-4 py-2 text-sm text-red-700" onClick={() => withCode((c) => disable.mutate({ code: c }))}>Disable 2FA</button>
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
  const { errors, check, clear } = useFieldErrors<"userId" | "reason">();
  const force = trpc.admin.settings.forceLogoutUser.useMutation({
    onSuccess: () => toast.success("User sessions invalidated."),
    onError: (e) => toast.error(e.message),
  });
  return (
    <SettingsSection title="Users" description="Create, suspend, and search users in User Management. Force logout is available here.">
      <SettingsCard>
        <button type="button" className="rounded-xl border border-burgundy-border px-4 py-2 text-sm font-medium text-burgundy transition hover:bg-burgundy-soft" onClick={onOpenUsers}>Open user management</button>
      </SettingsCard>
      <DangerZone>
        <SettingRow label="User ID">
          <Input inputMode="numeric" aria-invalid={Boolean(errors.userId)} value={userId} onChange={(e) => { setUserId(e.target.value); clear("userId"); }} />
          <FieldError message={errors.userId} />
        </SettingRow>
        <SettingRow label="Reason">
          <Input maxLength={LIMITS.reason.max} aria-invalid={Boolean(errors.reason)} value={reason} onChange={(e) => { setReason(e.target.value); clear("reason"); }} />
          <FieldError message={errors.reason} />
        </SettingRow>
        <button
          type="button"
          className="rounded-xl border border-red-200 px-4 py-2 text-sm text-red-700"
          onClick={() => {
            const ok = check({
              userId: validateNumber(userId, { label: "User ID", min: 1, integer: true }),
              reason: validateText(reason, { label: "Reason", ...LIMITS.reason }),
            });
            if (ok) force.mutate({ userId: Number(userId), reason: reason.trim() });
          }}
        >
          Force logout
        </button>
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
    <SettingsSection title="General" description="Configure the global behavior and identity of the platform.">
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
    <SettingsSection title="Appearance" description="Defaults preserve the platform's deep green (#033c35).">
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
  const q = trpc.admin.settings.aiHealth.useQuery(undefined, { refetchInterval: 30_000 });
  const metrics = trpc.admin.settings.aiMetrics.useQuery(undefined, { refetchInterval: 30_000 });
  const testGroq = trpc.admin.settings.testGroq.useMutation({
    onSuccess: (r) => toast.success(r.message),
    onError: (e) => toast.error(e.message),
  });
  return (
    <SettingsSection title="AI Provider" description="The assistant uses Groq as its sole LLM. API keys never leave the server.">
      <SettingsCard>
        {q.data ? q.data.map((row) => (
          <SettingRow
            key={row.provider}
            label="Groq"
            description={`${row.detail}${row.model ? ` · Model: ${row.model}` : ""}${row.latencyMs != null ? ` · ${row.latencyMs} ms` : ""}`}
          >
            <StatusBadge status={row.status === "connected" ? "connected" : row.status === "misconfigured" ? "error" : "not_connected"} />
          </SettingRow>
        )) : <LoadingState />}
        {metrics.data && metrics.data.length > 0 && (
          <div className="mt-2 space-y-2 border-t pt-3 text-sm text-muted-foreground">
            {metrics.data.map((m) => (
              <p key={m.provider}>
                Groq: {m.requests} requests · success {m.successRate ?? 0}% · avg {m.averageLatencyMs ?? "—"} ms
              </p>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={() => testGroq.mutate()} disabled={testGroq.isPending}>
            {testGroq.isPending ? "Testing…" : "Test Groq"}
          </button>
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}

function ModelsSection({ settings, save }: { settings: SystemSettings; save: { mutate: (v: { patch: Record<string, unknown> }) => void; isPending: boolean } }) {
  const { draft, setDraft, dirty } = useDraft({
    model: settings.ai.model,
    temperature: settings.ai.temperature,
    maxTokens: settings.ai.maxTokens,
  });
  return (
    <SettingsSection title="Models" description="Groq generation parameters. Leave model empty to use GROQ_MODEL from the server environment.">
      <SettingsCard>
        <SettingRow label="Provider">
          <Input value="Groq" disabled />
        </SettingRow>
        <SettingRow label="Model"><Input value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} placeholder="Leave empty for GROQ_MODEL env default" /></SettingRow>
        <SettingRow label="Temperature"><Input type="number" step="0.1" value={draft.temperature} onChange={(e) => setDraft({ ...draft, temperature: Number(e.target.value) })} /></SettingRow>
        <SettingRow label="Max output tokens"><Input type="number" value={draft.maxTokens} onChange={(e) => setDraft({ ...draft, maxTokens: Number(e.target.value) })} /></SettingRow>
      </SettingsCard>
      <SaveBar
        dirty={dirty}
        saving={save.isPending}
        onCancel={() => setDraft({ model: settings.ai.model, temperature: settings.ai.temperature, maxTokens: settings.ai.maxTokens })}
        onSave={() => save.mutate({ patch: { ai: { ...settings.ai, provider: "groq", ...draft } } })}
      />
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

const RUN_STATUS_TONE: Record<string, string> = {
  acted: "bg-emerald-50 text-emerald-800 ring-emerald-100",
  idle: "bg-slate-100 text-slate-600 ring-slate-200",
  failed: "bg-red-50 text-red-700 ring-red-100",
};

function AutonomousAgentSection({ settings, save }: { settings: SystemSettings; save: { mutate: (v: { patch: Record<string, unknown> }) => void; isPending: boolean } }) {
  const { draft, setDraft, dirty } = useDraft(settings.autonomousAgent);
  const utils = trpc.useUtils();
  const overview = trpc.admin.autonomousAgent.overview.useQuery(undefined, {
    refetchInterval: (query) => (query.state.data?.status.running ? 4000 : 30000),
  });
  const runNow = trpc.admin.autonomousAgent.runNow.useMutation({
    onSuccess: () => {
      toast.success("Sweep started. Results will appear in the activity log.");
      void utils.admin.autonomousAgent.overview.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const stats = overview.data?.stats;
  const status = overview.data?.status;
  const last = status?.lastSweep;

  return (
    <SettingsSection
      title="Autonomous Agent"
      description="Every few hours the agent looks at each student's deadlines, quiz results, new lecture material, due flashcards and activity. When something needs attention it decides what to do: send a notification, or create flashcards or a practice quiz. It never changes calendars, and students can switch it off in their Settings."
    >
      <SettingsCard title="Behaviour">
        <SettingRow label="Enabled" description="Global switch. When off, no background runs happen.">
          <Switch checked={draft.enabled} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} />
        </SettingRow>
        <SettingRow label="Check each student every" description="Hours between runs for the same student.">
          <select value={draft.intervalHours} onChange={(e) => setDraft({ ...draft, intervalHours: Number(e.target.value) })}>
            {[2, 3, 4, 6, 8, 12, 24].map((h) => <option key={h} value={h}>{h} hours</option>)}
          </select>
        </SettingRow>
        <SettingRow label="Students per sweep" description="Caps AI usage per 15-minute sweep; remaining students are picked up next sweep.">
          <Input type="number" min={1} max={200} value={draft.maxStudentsPerSweep} onChange={(e) => setDraft({ ...draft, maxStudentsPerSweep: Number(e.target.value) })} />
        </SettingRow>
        <SettingRow label="Create study material" description="Allow the agent to generate flashcards and practice quizzes on its own. Off means notifications only.">
          <Switch checked={draft.allowContentCreation} onCheckedChange={(v) => setDraft({ ...draft, allowContentCreation: v })} />
        </SettingRow>
      </SettingsCard>
      <SaveBar dirty={dirty} saving={save.isPending} onCancel={() => setDraft(settings.autonomousAgent)} onSave={() => save.mutate({ patch: { autonomousAgent: draft } })} />

      <SettingsCard title="Last 7 days">
        {stats ? (
          <div className="grid grid-cols-2 gap-4 py-4 sm:grid-cols-4">
            {[
              ["Runs", stats.runsThisWeek],
              ["Students helped", stats.studentsReached],
              ["Notifications sent", stats.notifications],
              ["Materials created", stats.materials],
              ["Failed runs", stats.failedThisWeek],
              ["Students", stats.students],
              ["Opted out", stats.optedOut],
            ].map(([label, value]) => (
              <div key={label as string}>
                <p className="text-2xl font-bold text-slate-900">{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        ) : <div className="py-4"><LoadingState /></div>}
        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          <p className="text-xs text-slate-500">
            {status?.running
              ? "A sweep is running now…"
              : last?.finishedAt
                ? `Last sweep ${new Date(last.finishedAt).toLocaleString()}: ${last.result?.processed ?? 0} checked, ${last.result?.acted ?? 0} acted on${last.result?.skippedReason ? ` (${last.result.skippedReason})` : ""}.`
                : "No sweep since the server started. The first one runs about a minute after start-up."}
          </p>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => runNow.mutate()} disabled={runNow.isPending || status?.running}>
            {runNow.isPending || status?.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Run now for all students
          </Button>
        </div>
      </SettingsCard>

      {overview.data?.runs.length ? (
        <div className="overflow-hidden rounded-2xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Student</th>
                <th className="px-4 py-2">Outcome</th>
                <th className="px-4 py-2">What the agent did</th>
              </tr>
            </thead>
            <tbody>
              {overview.data.runs.map((run) => (
                <tr key={run.id} className="border-t align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {new Date(run.createdAt).toLocaleString()}
                    {run.trigger === "manual" ? <span className="ml-1 text-[11px]">(manual)</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{run.userName || "Student"}</p>
                    <p className="text-xs text-slate-500">{run.userEmail}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ring-1 ${RUN_STATUS_TONE[run.status] ?? RUN_STATUS_TONE.idle}`}>{run.status}</span>
                    {!run.usedLlm && run.status === "acted" ? <p className="mt-1 text-[11px] text-slate-500">fallback reminder</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-800">{run.error || run.summary}</p>
                    {run.actions?.length ? (
                      <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                        {run.actions.map((a, i) => <li key={i}>{a.ok ? "✓" : "✗"} {a.type}: {a.detail}</li>)}
                      </ul>
                    ) : null}
                    {run.signals?.length ? (
                      <p className="mt-1 text-[11px] text-slate-400">Noticed: {run.signals.map((s) => s.kind.replace("_", " ")).join(", ")}</p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : overview.data ? (
        <EmptyState title="No runs yet" body="Each background check will be listed here with what the agent noticed and did." />
      ) : null}
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
        <button type="button" className="rounded-xl bg-burgundy px-4 py-2 text-sm text-white transition hover:bg-burgundy-hover" onClick={() => create.mutate()}>Create backup</button>
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
      a.href = url; a.download = "ai-learning-assistant-users.json"; a.click();
      toast.success("Users exported.");
    },
    onError: (e) => toast.error(e.message),
  });
  const courses = trpc.admin.settings.exportCourses.useMutation({
    onSuccess: (rows) => {
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "ai-learning-assistant-courses.json"; a.click();
      toast.success("Courses exported.");
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <SettingsSection title="Import / Export" description="JSON exports omit password hashes and secrets. Dataset import is not implemented.">
      <SettingsCard>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-xl border border-burgundy-border px-4 py-2 text-sm font-medium text-burgundy transition hover:bg-burgundy-soft" onClick={() => users.mutate()}>Export users</button>
          <button type="button" className="rounded-xl border border-burgundy-border px-4 py-2 text-sm font-medium text-burgundy transition hover:bg-burgundy-soft" onClick={() => courses.mutate()}>Export courses</button>
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
  const [toError, setToError] = useState<string | null>(null);
  const data = q.data;
  return (
    <SettingsSection title="Integrations" description="Status only. Secrets remain on the server.">
      <SettingsCard>
        {data ? Object.entries(data).map(([key, val]) => (
          <SettingRow key={key} label={key} description={val.detail}><StatusBadge status={val.status} /></SettingRow>
        )) : <LoadingState />}
        {focus === "email" ? (
          <div className="flex gap-2">
            <Input type="email" placeholder="you@university.edu" aria-invalid={Boolean(toError)} value={to} onChange={(e) => { setTo(e.target.value); setToError(null); }} />
            <button
              type="button"
              className="rounded-xl border px-3 text-sm"
              onClick={() => {
                const error = validateEmail(to, { requireSchoolDomain: false });
                setToError(error);
                if (!error) testEmail.mutate({ to: to.trim() });
              }}
            >
              Send test
            </button>
          </div>
        ) : null}
        {focus === "email" ? <FieldError message={toError} /> : null}
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
            <SettingRow label="AI / Groq"><StatusBadge status={d.ai} /></SettingRow>
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
