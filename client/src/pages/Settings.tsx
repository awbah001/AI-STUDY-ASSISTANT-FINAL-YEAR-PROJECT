import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Moon,
  Sun,
  Palette,
  Brain,
  Layers,
  Info,
  ChevronRight,
  Check,
} from "lucide-react";

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your preferences and application settings.
          </p>
        </div>

        {/* ── Appearance ── */}
        <SettingsSection
          icon={<Palette className="h-4 w-4 text-violet-600" />}
          iconBg="bg-violet-50"
          title="Appearance"
          description="Customize how the application looks"
        >
          <SettingsRow
            label="Theme"
            description="Switch between light and dark mode"
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => theme !== "light" && toggleTheme?.()}
                className={[
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                  theme === "light"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                ].join(" ")}
              >
                <Sun className="h-4 w-4" />
                Light
                {theme === "light" && <Check className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => theme !== "dark" && toggleTheme?.()}
                className={[
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                  theme === "dark"
                    ? "border-slate-600 bg-slate-800 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                ].join(" ")}
              >
                <Moon className="h-4 w-4" />
                Dark
                {theme === "dark" && <Check className="h-3.5 w-3.5" />}
              </button>
            </div>
          </SettingsRow>
        </SettingsSection>

        {/* ── Learning preferences ── */}
        <SettingsSection
          icon={<Brain className="h-4 w-4 text-blue-600" />}
          iconBg="bg-blue-50"
          title="Learning Preferences"
          description="Customize your learning experience"
        >
          <SettingsRow
            label="Default quiz length"
            description="Number of questions for AI-generated quizzes"
          >
            <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all">
              <option>5 questions</option>
              <option>10 questions</option>
              <option>15 questions</option>
              <option>20 questions</option>
            </select>
          </SettingsRow>
          <SettingsRow
            label="Default flashcard count"
            description="Number of flashcards to generate per document"
            last
          >
            <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all">
              <option>5 cards</option>
              <option>10 cards</option>
              <option>15 cards</option>
              <option>20 cards</option>
            </select>
          </SettingsRow>
        </SettingsSection>

        {/* ── Notifications (placeholder) ── */}
        <SettingsSection
          icon={<Layers className="h-4 w-4 text-emerald-600" />}
          iconBg="bg-emerald-50"
          title="Notifications"
          description="Control what alerts you receive"
        >
          <ToggleRow label="Study reminders" description="Remind me to study daily" defaultOn />
          <ToggleRow label="New announcements" description="Alert when a lecturer posts an announcement" defaultOn />
          <ToggleRow label="Quiz results" description="Notify when AI grades are ready" last />
        </SettingsSection>

        {/* ── About ── */}
        <SettingsSection
          icon={<Info className="h-4 w-4 text-slate-500" />}
          iconBg="bg-slate-100"
          title="About"
          description="Application information"
        >
          <div className="divide-y divide-slate-50">
            <AboutRow label="Version" value="Cognify v1.0" />
            <AboutRow label="AI Engine" value="Google Gemini" />
            <AboutRow label="Platform" value="React · Express · SQLite" />
            <AboutRow label="Account" value={user?.email ?? "—"} last />
          </div>
        </SettingsSection>

      </div>
    </DashboardLayout>
  );
}

// ── Reusable section wrapper ───────────────────────────────────────────────────

function SettingsSection({
  icon,
  iconBg,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">{title}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Settings row with right-side control ──────────────────────────────────────

function SettingsRow({
  label,
  description,
  children,
  last = false,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 px-6 py-4 ${!last ? "border-b border-slate-50" : ""}`}>
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      {children}
    </div>
  );
}

// ── Toggle row (visual only — extend with state as needed) ────────────────────

function ToggleRow({
  label,
  description,
  defaultOn = false,
  last = false,
}: {
  label: string;
  description: string;
  defaultOn?: boolean;
  last?: boolean;
}) {
  const [on, setOn] = useState(defaultOn);

  return (
    <div className={`flex items-center justify-between gap-4 px-6 py-4 ${!last ? "border-b border-slate-50" : ""}`}>
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn((v) => !v)}
        className={[
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
          on ? "bg-emerald-500" : "bg-slate-200",
        ].join(" ")}
      >
        <span
          className={[
            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform",
            on ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

// ── About info row ─────────────────────────────────────────────────────────────

function AboutRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between px-6 py-3.5 ${!last ? "border-b border-slate-50" : ""}`}>
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <span className="text-sm text-slate-500">{value}</span>
    </div>
  );
}

// Need useState for the toggle rows
import { useState } from "react";
