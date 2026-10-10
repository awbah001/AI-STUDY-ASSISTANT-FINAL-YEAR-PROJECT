import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  User,
  Mail,
  Camera,
  Lock,
  Palette,
  BookOpen,
  Bell,
  Sun,
  Moon,
  Monitor,
  Save,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { storagePut } from "@/lib/storage";
import {
  getStudentPreferences,
  saveStudentPreferences,
  STUDENT_COUNTS,
} from "@/lib/studentPreferences";
import DashboardLayout from "@/components/DashboardLayout";
import { StudentHero } from "@/components/StudentUi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/FieldError";
import { PasswordRules } from "@/components/PasswordRules";
import { useFieldErrors } from "@/lib/formValidation";
import { validateNewPassword, validatePasswordConfirm, validatePersonName } from "@shared/validation";
import { toast } from "sonner";

function Panel({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="student-panel">
      <div className="student-account-heading">
        <span className="student-icon">{icon}</span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
export default function StudentAccount({
  settings = false,
}: {
  settings?: boolean;
}) {
  const { user, refresh } = useAuth();
  const { preference, setPreference } = useTheme();
  const utils = trpc.useUtils();
  const [name, setName] = useState(user?.name || "");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preferences, setPreferences] = useState(() =>
    getStudentPreferences(user?.id)
  );
  const [passwordOpen, setPasswordOpen] = useState(false);
  const notifications = trpc.admin.settings.preferences.useQuery();
  useEffect(() => {
    setName(user?.name || "");
    setPreferences(getStudentPreferences(user?.id));
  }, [user?.id, user?.name]);
  const update = trpc.auth.updateProfile.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      await refresh();
      toast.success("Profile updated");
    },
    onError: e => toast.error(e.message),
  });
  const saveNotifications = trpc.admin.settings.savePreferences.useMutation({
    onSuccess: () => {
      void utils.admin.settings.preferences.invalidate();
      toast.success("Preferences saved");
    },
    onError: e => toast.error(e.message),
  });
  const password = trpc.auth.changePassword.useMutation({
    onError: e => toast.error(e.message),
  });
  const { errors, check, clear } = useFieldErrors<"name" | "current" | "new" | "confirm">();
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const saveName = () => {
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (!check({ name: validatePersonName(trimmed, "Display name") })) return;
    update.mutate({ name: trimmed });
  };
  const nameError = <FieldError message={errors.name} />;
  const profile = (
    <Panel
      title={settings ? "Profile information" : "Your profile"}
      description="Update your personal details and profile photo."
      icon={<User />}
    >
      <div className="student-profile-editor">
        <div className="student-photo-wrap">
          {user?.avatarUrl ? (
            <img
              className="student-profile-photo"
              src={user.avatarUrl}
              alt="Your profile"
            />
          ) : (
            <div className="student-profile-photo student-icon">
              <User />
            </div>
          )}
          <button
            aria-label="Change photo"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || update.isPending}
          >
            <Camera />
          </button>
        </div>
        <div>
          {!settings && (
            <>
              <h2>{user?.name}</h2>
              <span className="student-badge">Student</span>
            </>
          )}
          <label htmlFor="student-display-name">Display name</label>
          <Input
            id="student-display-name"
            value={name}
            maxLength={100}
            aria-invalid={Boolean(errors.name)}
            onChange={e => {
              setName(e.target.value);
              clear("name");
            }}
          />
          {nameError}
          <div className="student-profile-actions">
            <Button
              onClick={saveName}
              disabled={update.isPending || name.trim() === user?.name}
            >
              <Save />
              Save changes
            </Button>
            {settings ? (
              <Button
                variant="outline"
                disabled={!user?.avatarUrl || update.isPending}
                onClick={() => update.mutate({ avatarUrl: "" })}
              >
                <Trash2 />
                Remove photo
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <Camera />
                {uploading ? "Uploading..." : "Change photo"}
              </Button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        hidden
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={async e => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (
            !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
              file.type
            ) ||
            file.size > 3 * 1024 * 1024
          ) {
            toast.error("Choose a JPEG, PNG, WebP, or GIF under 3 MB.");
            return;
          }
          setUploading(true);
          try {
            const { url } = await storagePut(
              `avatars/${user?.id}-${crypto.randomUUID()}.${file.type.split("/")[1]}`,
              new Uint8Array(await file.arrayBuffer()),
              file.type
            );
            await update.mutateAsync({ avatarUrl: url });
          } catch {
            toast.error("Could not upload photo.");
          } finally {
            setUploading(false);
          }
        }}
      />
    </Panel>
  );
  const summary = (
    <Panel
      title="Account summary"
      description="Your account details at a glance."
      icon={<Mail />}
    >
      {[
        ["Email address", user?.email],
        ["Sign-in method", user?.loginMethod],
        ["Role", "Student"],
        [
          "Member since",
          user?.createdAt
            ? new Date(user.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "—",
        ],
      ].map(([label, value]) => (
        <div className="student-setting-row" key={label}>
          <span>{label}</span>
          <span>{value || "—"}</span>
        </div>
      ))}
    </Panel>
  );
  return (
    <DashboardLayout>
      <div
        className={`student-content ${settings ? "student-settings" : "student-profile"}`}
      >
        <StudentHero
          title={settings ? "Settings" : "Profile"}
          description={
            settings
              ? "Manage your preferences and application settings."
              : "Manage your personal information and account security."
          }
        />
        <div className="student-account-grid">
          <div className="student-account-column">
            {profile}
            {settings ? (
              <>
                <Panel
                  title="Appearance"
                  description="Customize how the application looks."
                  icon={<Palette />}
                >
                  <p className="mb-2">Theme</p>
                  <div className="student-theme-options">
                    {(["light", "dark", "system"] as const).map(value => (
                      <button
                        key={value}
                        className={value === preference ? "active" : ""}
                        aria-pressed={value === preference}
                        onClick={() => {
                          setPreference(value);
                          if (value !== "system")
                            saveNotifications.mutate({ theme: value });
                        }}
                      >
                        {value === "light" ? (
                          <Sun />
                        ) : value === "dark" ? (
                          <Moon />
                        ) : (
                          <Monitor />
                        )}
                        <span>
                          {value === "light"
                            ? "Light"
                            : value === "dark"
                              ? "Dark"
                              : "System"}
                          <small>
                            {value === "light"
                              ? "Clean and bright"
                              : value === "dark"
                                ? "Easy on the eyes"
                                : "Matches your device"}
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                </Panel>
                <Panel
                  title="Notifications"
                  description="Choose which categories appear in your inbox."
                  icon={<Bell />}
                >
                  {[
                    ["assignments", "Assignments"],
                    ["quizzes", "Quizzes"],
                    ["announcements", "Announcements"],
                    ["system", "System and reminders"],
                    [
                      "aiCoach",
                      "AI study coach",
                      "Checks in every few hours and may prepare flashcards or practice quizzes for you.",
                    ],
                  ].map(([key, label, hint]) => (
                    <div className="student-setting-row" key={key}>
                      <span>
                        {label}
                        {hint && (
                          <small className="block text-xs font-normal text-muted-foreground">
                            {hint}
                          </small>
                        )}
                      </span>
                      <button
                        className="student-switch"
                        role="switch"
                        aria-label={label}
                        aria-checked={
                          notifications.data?.notifications?.[
                            `student.${key}`
                          ] !== false
                        }
                        disabled={
                          notifications.isLoading ||
                          !!notifications.error ||
                          saveNotifications.isPending
                        }
                        onClick={() =>
                          saveNotifications.mutate({
                            notifications: {
                              ...notifications.data?.notifications,
                              [`student.${key}`]:
                                notifications.data?.notifications?.[
                                  `student.${key}`
                                ] === false,
                            },
                          })
                        }
                      >
                        <span />
                      </button>
                    </div>
                  ))}
                  {notifications.error && (
                    <p role="alert">
                      Could not load preferences.{" "}
                      <button onClick={() => notifications.refetch()}>
                        Retry
                      </button>
                    </p>
                  )}
                </Panel>
              </>
            ) : (
              <Panel
                title="Account information"
                description="Update your personal details."
                icon={<Mail />}
              >
                <label className="block mb-2" htmlFor="student-email">
                  Email address
                </label>
                <Input id="student-email" value={user?.email || ""} disabled />
                <small className="block mt-2">
                  Your sign-in email cannot be changed here.
                </small>
                <div className="grid sm:grid-cols-2 gap-6 mt-5">
                  <label>
                    Display name
                    <Input
                      className="mt-2"
                      value={name}
                      aria-invalid={Boolean(errors.name)}
                      onChange={e => {
                        setName(e.target.value);
                        clear("name");
                      }}
                      maxLength={100}
                    />
                    {nameError}
                  </label>
                  <label>
                    Role
                    <Input className="mt-2" value="Student" disabled />
                  </label>
                </div>
                <Button
                  className="mt-4"
                  onClick={saveName}
                  disabled={update.isPending || name.trim() === user?.name}
                >
                  <Save />
                  Save changes
                </Button>
              </Panel>
            )}
          </div>
          <div className="student-account-column">
            {summary}
            {settings ? (
              <Panel
                title="Learning preferences"
                description="Customize your learning experience on this browser."
                icon={<BookOpen />}
              >
                {(["quizLength", "flashcardCount"] as const).map(key => (
                  <label className="student-setting-row" key={key}>
                    <span>
                      {key === "quizLength"
                        ? "Default quiz length"
                        : "Default flashcard count"}
                      <small>
                        {key === "quizLength"
                          ? "Number of questions for AI-generated quizzes"
                          : "Number of flashcards to generate per document"}
                      </small>
                    </span>
                    <select
                      value={preferences[key]}
                      onChange={e => {
                        const next = {
                          ...preferences,
                          [key]: Number(e.target.value),
                        };
                        if (!user) return;
                        try {
                          saveStudentPreferences(user.id, next);
                          setPreferences(next);
                          toast.success("Learning preferences saved");
                        } catch {
                          toast.error(
                            "Could not save preferences in this browser."
                          );
                        }
                      }}
                    >
                      {STUDENT_COUNTS.map(n => (
                        <option key={n} value={n}>
                          {n} {key === "quizLength" ? "questions" : "cards"}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </Panel>
            ) : (
              <Panel
                title="Security"
                description="Change your password and keep your account safe."
                icon={<Lock />}
              >
                {user?.loginMethod === "local" ? (
                  <>
                    <button
                      className="student-security-open"
                      onClick={() => setPasswordOpen(!passwordOpen)}
                      aria-expanded={passwordOpen}
                    >
                      <span className="student-icon">
                        <Lock />
                      </span>
                      <span>
                        <strong>Change password</strong>
                        <small>
                          Use a strong password you don’t reuse elsewhere.
                        </small>
                      </span>
                      <span>›</span>
                    </button>
                    {passwordOpen && (
                      <form
                        className="space-y-4 mt-5"
                        noValidate
                        onSubmit={async e => {
                          e.preventDefault();
                          const form = e.currentTarget;
                          const data = new FormData(form);
                          const current = String(data.get("current") ?? "");
                          const next = String(data.get("new") ?? "");
                          const confirm = String(data.get("confirm") ?? "");
                          const ok = check({
                            current: current ? null : "Enter your current password.",
                            new:
                              validateNewPassword(next) ??
                              (next === current
                                ? "Choose a password that is different from your current one."
                                : null),
                            confirm: validatePasswordConfirm(next, confirm),
                          });
                          if (!ok) return;
                          try {
                            await password.mutateAsync({
                              currentPassword: current,
                              newPassword: next,
                            });
                            form.reset();
                            setNewPasswordValue("");
                            setPasswordOpen(false);
                            toast.success("Password changed");
                          } catch {}
                        }}
                      >
                        {(
                          [
                            ["current", "Current password"],
                            ["new", "New password"],
                            ["confirm", "Confirm password"],
                          ] as const
                        ).map(([key, label]) => (
                          <label className="block" key={key}>
                            {label}
                            <Input
                              className="mt-2"
                              name={key}
                              type="password"
                              aria-invalid={Boolean(errors[key])}
                              onChange={e => {
                                clear(key);
                                if (key === "new") setNewPasswordValue(e.target.value);
                              }}
                              autoComplete={
                                key === "current"
                                  ? "current-password"
                                  : "new-password"
                              }
                            />
                            {key === "new" && <PasswordRules value={newPasswordValue} />}
                            <FieldError message={errors[key]} />
                          </label>
                        ))}
                        <Button disabled={password.isPending}>
                          Update password
                        </Button>
                      </form>
                    )}
                  </>
                ) : (
                  <p className="student-muted">
                    Manage your password through your sign-in provider.
                  </p>
                )}
              </Panel>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
