import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
  icon: Icon,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <header className="portal-header px-5 py-5 sm:px-6 sm:py-6">
      <div className="relative z-[1] flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {Icon ? <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"><Icon className="h-6 w-6" strokeWidth={1.8} /></div> : null}
          <div className="min-w-0 space-y-1">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700/90">{eyebrow}</p>
          ) : null}
          <h1 className="text-[1.4rem] font-bold tracking-tight text-slate-900 sm:text-[1.6rem]">{title}</h1>
          {description ? <p className="max-w-2xl text-sm leading-relaxed text-slate-600">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

const PANEL_TONES = {
  emerald: "portal-panel",
  sky: "portal-panel-sky",
  violet: "portal-panel-violet",
  amber: "portal-panel-amber",
} as const;

export function AdminPanel({
  title,
  description,
  icon,
  actions,
  children,
  padded = true,
  tone = "emerald",
}: {
  title?: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  padded?: boolean;
  tone?: keyof typeof PANEL_TONES;
}) {
  const iconTone =
    tone === "sky"
      ? "bg-sky-50 text-sky-700"
      : tone === "violet"
        ? "bg-violet-50 text-violet-700"
        : tone === "amber"
          ? "bg-amber-50 text-amber-700"
          : "bg-emerald-50 text-emerald-700";

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        PANEL_TONES[tone],
      )}
    >
      {(title || description || actions) && (
        <div className="flex items-start justify-between gap-3 border-b border-slate-100/80 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            {icon ? (
              <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", iconTone)}>
                {icon}
              </div>
            ) : null}
            <div className="min-w-0">
              {title ? <h2 className="text-sm font-semibold text-slate-900">{title}</h2> : null}
              {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
            </div>
          </div>
          {actions}
        </div>
      )}
      <div className={padded ? "p-5 sm:p-6" : ""}>{children}</div>
    </section>
  );
}
