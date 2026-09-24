import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-[1.55rem] font-bold tracking-tight text-slate-900">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function SettingsCard({
  title,
  description,
  children,
  danger,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        danger ? "border-red-200" : "border-slate-200/80"
      )}
    >
      {(title || description) && (
        <div className={cn("border-b px-5 py-4 sm:px-6", danger ? "border-red-100 bg-red-50/70" : "border-slate-100 bg-slate-50/60")}>
          {title ? (
            <h2 className={cn("text-sm font-semibold", danger ? "text-red-800" : "text-slate-900")}>{title}</h2>
          ) : null}
          {description ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p> : null}
        </div>
      )}
      <div className={cn("divide-y divide-slate-100 px-5 py-1 sm:px-6", danger && "bg-red-50/20")}>{children}</div>
    </div>
  );
}

export function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0 sm:max-w-[52%]">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {description ? <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p> : null}
      </div>
      <div className="w-full sm:w-auto sm:min-w-[260px] [&_input]:h-10 [&_input]:rounded-xl [&_input]:border-slate-200 [&_select]:h-10 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-slate-200 [&_select]:bg-white [&_select]:px-3 [&_select]:text-sm">
        {children}
      </div>
    </div>
  );
}

export function SaveBar({
  dirty,
  saving,
  onSave,
  onCancel,
}: {
  dirty: boolean;
  saving?: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (!dirty && !saving) return null;
  return (
    <div className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-white/95 px-4 py-3 shadow-[0_12px_40px_rgba(2,44,34,0.12)] backdrop-blur">
      <p className="text-xs font-medium text-slate-500">You have unsaved changes</p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="rounded-xl" onClick={onCancel} disabled={!dirty || saving}>
          Cancel
        </Button>
        <Button type="button" className="rounded-xl bg-[#033c35] hover:bg-[#045c50]" onClick={onSave} disabled={!dirty || saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save changes
        </Button>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "operational" || status === "connected"
      ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"
      : status === "warning"
        ? "bg-amber-50 text-amber-800 ring-1 ring-amber-100"
        : status === "not_connected"
          ? "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
          : "bg-red-50 text-red-700 ring-1 ring-red-100";
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize", tone)}>{status.replace("_", " ")}</span>;
}

export function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200/70" />
      <div className="h-44 animate-pulse rounded-2xl bg-slate-200/70" />
      <div className="h-44 animate-pulse rounded-2xl bg-slate-200/70" />
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-8 py-12 text-center">
      <p className="font-semibold text-slate-800">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{body}</p>
    </div>
  );
}

export function DangerZone({ children }: { children: ReactNode }) {
  return (
    <SettingsCard title="Danger zone" description="These actions are irreversible or disruptive. Confirm carefully." danger>
      {children}
    </SettingsCard>
  );
}
