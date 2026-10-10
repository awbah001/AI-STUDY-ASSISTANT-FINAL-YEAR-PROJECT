import { AdminHero } from "@/components/admin/AdminHero";
import { useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  ArrowDownUp,
  BookOpen,
  Calendar,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  List,
  Megaphone,
  MoreVertical,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  User,
  UserCog,
  Users,
} from "lucide-react";
import { toast } from "sonner";

const CHECKLIST = [
  "Track administrative actions",
  "Ensure accountability",
  "Maintain platform security",
] as const;

const TIME_PRESETS = [
  { id: "all", label: "All time" },
  { id: "24h", label: "Last 24 hours" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
] as const;

type TimePreset = (typeof TIME_PRESETS)[number]["id"];

export default function AdminAudit() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [action, setAction] = useState("");
  const [adminId, setAdminId] = useState<number | "all">("all");
  const [timePreset, setTimePreset] = useState<TimePreset>("all");

  const range = useMemo(() => rangeFromPreset(timePreset), [timePreset]);

  const { data, isLoading, refetch, isFetching } = trpc.admin.listAuditLogs.useQuery(
    {
      search,
      action: action || undefined,
      adminId: adminId === "all" ? undefined : adminId,
      from: range.from,
      to: range.to,
      limit: 100,
    },
    { enabled: user?.role === "admin" }
  );

  const { data: actionCatalog } = trpc.admin.listAuditLogs.useQuery(
    { search: "", limit: 200 },
    { enabled: user?.role === "admin" }
  );

  const { data: adminsPage } = trpc.admin.listUsers.useQuery(
    { page: 1, pageSize: 50, search: "", role: "admin" },
    { enabled: user?.role === "admin" }
  );

  const actionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const log of actionCatalog ?? []) set.add(log.action);
    return [...set].sort();
  }, [actionCatalog]);

  if (!user || user.role !== "admin") return null;

  const applyFilters = () => {
    setSearch(draftSearch.trim());
  };

  const resetFilters = () => {
    setDraftSearch("");
    setSearch("");
    setAction("");
    setAdminId("all");
    setTimePreset("all");
  };

  const exportCsv = () => {
    if (!data?.length) {
      toast.message("No audit records to export.");
      return;
    }
    const header = ["When", "Administrator", "Action", "Target", "Reason", "IP Address", "Status"];
    const rows = data.map((log) => [
      new Date(log.createdAt).toLocaleString(),
      log.adminName ?? "",
      log.action,
      formatTarget(log.targetType, log.targetId, log.metadata),
      log.reason ?? "",
      ipFromMetadata(log.metadata),
      "Success",
    ]);
    const csv = [header, ...rows]
      .map((cols) => cols.map(csvEscape).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-learning-assistant-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Audit CSV exported.");
  };

  return (
    <DashboardLayout>
      <main className="admin-content admin-audit mx-auto space-y-5">
        {/* Hero */}
        <AdminHero kind="audit" />

        {/* Filters */}
        <section className="rounded-[1.15rem] border border-slate-200/90 bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.05)] sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilters();
                }}
                placeholder="Search actions, users, or reasons..."
                className="h-10 rounded-full border-slate-200 bg-slate-50/80 pl-10 text-sm focus-visible:ring-emerald-500"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect
                icon={<Calendar className="h-3.5 w-3.5 text-slate-400" />}
                value={timePreset}
                onChange={(v) => setTimePreset(v as TimePreset)}
                options={TIME_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
              />
              <FilterSelect
                icon={<Users className="h-3.5 w-3.5 text-slate-400" />}
                value={adminId === "all" ? "all" : String(adminId)}
                onChange={(v) => setAdminId(v === "all" ? "all" : Number(v))}
                options={[
                  { value: "all", label: "All administrators" },
                  ...(adminsPage?.items ?? []).map((a) => ({
                    value: String(a.id),
                    label: a.name ?? `Admin #${a.id}`,
                  })),
                ]}
              />
              <FilterSelect
                icon={<List className="h-3.5 w-3.5 text-slate-400" />}
                value={action || "all"}
                onChange={(v) => setAction(v === "all" ? "" : v)}
                options={[
                  { value: "all", label: "All actions" },
                  ...actionOptions.map((a) => ({ value: a, label: a })),
                ]}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-10 gap-2 rounded-full px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                Reset
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={applyFilters}
                className="h-10 gap-2 rounded-full bg-[#033c35] px-4 text-sm font-semibold text-white hover:bg-[#045c50]"
              >
                <Filter className="h-3.5 w-3.5" />
                Filter
              </Button>
            </div>
          </div>
        </section>

        {/* Records table */}
        <section className="overflow-hidden rounded-[1.25rem] border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <FileText className="h-5 w-5" strokeWidth={1.7} />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-900">Audit records</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Complete history of privileged actions performed on the platform.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="accent-outline"
              size="sm"
              onClick={exportCsv}
              className="h-9 gap-2 rounded-full px-3.5 text-sm font-medium"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[12px] font-semibold text-slate-400">
                  <SortHeader label="When" />
                  <SortHeader label="Administrator" />
                  <SortHeader label="Action" />
                  <SortHeader label="Target" />
                  <SortHeader label="Reason" />
                  <SortHeader label="IP Address" />
                  <SortHeader label="Status" />
                  <th className="w-12 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      {Array.from({ length: 8 }).map((__, j) => (
                        <td key={j} className="px-4 py-4">
                          <Skeleton className="h-4 w-20" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : data?.length ? (
                  data.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-slate-50 transition-colors hover:bg-slate-50/60"
                    >
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-500 sm:px-5">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-800 sm:px-5">
                        {log.adminName ?? `Admin #${log.adminId}`}
                      </td>
                      <td className="px-4 py-3.5 sm:px-5">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-3.5 text-slate-600 sm:px-5">
                        {formatTarget(log.targetType, log.targetId, log.metadata)}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3.5 text-slate-500 sm:px-5">
                        {log.reason || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs text-slate-500 sm:px-5">
                        {ipFromMetadata(log.metadata)}
                      </td>
                      <td className="px-4 py-3.5 sm:px-5">
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Success
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <button
                          type="button"
                          aria-label="Row options"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          onClick={() => {
                            void navigator.clipboard?.writeText(
                              JSON.stringify(
                                {
                                  id: log.id,
                                  action: log.action,
                                  target: formatTarget(log.targetType, log.targetId, log.metadata),
                                  reason: log.reason,
                                  when: log.createdAt,
                                },
                                null,
                                2
                              )
                            );
                            toast.success("Audit row copied.");
                          }}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-slate-100">
                          <ShieldCheck className="h-7 w-7" strokeWidth={1.5} />
                        </div>
                        <p className="text-sm font-semibold text-slate-800">No matching audit records</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Try adjusting search or filters, then click Filter.
                        </p>
                        <button
                          type="button"
                          onClick={() => refetch()}
                          className="mt-3 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          Refresh
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </DashboardLayout>
  );
}

function SortHeader({ label }: { label: string }) {
  return (
    <th className="px-4 py-3 sm:px-5">
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowDownUp className="h-3 w-3 opacity-50" />
      </span>
    </th>
  );
}

function FilterSelect({
  icon,
  value,
  options,
  onChange,
}: {
  icon: ReactNode;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <label className="relative inline-flex h-10 items-center">
      <span className="pointer-events-none absolute left-3 z-[1]">{icon}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 max-w-[180px] appearance-none rounded-full border border-slate-200 bg-white pl-8 pr-8 text-sm font-medium text-slate-600 outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActionBadge({ action }: { action: string }) {
  const tone = actionTone(action);
  const Icon = tone.icon;
  return (
    <span
      className={`inline-flex max-w-[220px] items-center gap-1.5 truncate rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.className}`}
      title={action}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {action}
    </span>
  );
}

function actionTone(action: string): {
  className: string;
  icon: typeof Trash2;
} {
  const a = action.toLowerCase();
  if (a.includes("delete") || a.includes("banned")) {
    return { className: "bg-violet-100 text-violet-800", icon: Trash2 };
  }
  if (a.includes("announcement") || a.includes("sent")) {
    return { className: "bg-sky-100 text-sky-800", icon: Megaphone };
  }
  if (a.includes("course") || a.includes("created")) {
    return { className: "bg-emerald-100 text-emerald-800", icon: BookOpen };
  }
  if (a.includes("updated") || a.includes("role") || a.includes("restored") || a.includes("password")) {
    return { className: "bg-amber-100 text-amber-800", icon: UserCog };
  }
  if (a.includes("setting") || a.includes("backup") || a.includes("system") || a.includes("retention")) {
    return { className: "bg-pink-100 text-pink-800", icon: Settings };
  }
  if (a.includes("user")) {
    return { className: "bg-amber-100 text-amber-800", icon: User };
  }
  return { className: "bg-slate-100 text-slate-700", icon: CheckCircle2 };
}

function formatTarget(
  targetType: string,
  targetId: number,
  metadata: Record<string, unknown> | null | undefined
): string {
  if (metadata && typeof metadata.code === "string") {
    return String(metadata.code);
  }
  if (metadata && typeof metadata.title === "string") {
    return String(metadata.title);
  }
  if (!targetId) return targetType;
  return `${targetType} #${targetId}`;
}

function ipFromMetadata(metadata: Record<string, unknown> | null | undefined): string {
  if (!metadata) return "—";
  const ip = metadata.ip ?? metadata.ipAddress ?? metadata.clientIp;
  return typeof ip === "string" && ip.trim() ? ip : "—";
}

function rangeFromPreset(preset: TimePreset): { from?: Date; to?: Date } {
  if (preset === "all") return {};
  const to = new Date();
  const from = new Date(to);
  if (preset === "24h") from.setHours(from.getHours() - 24);
  if (preset === "7d") from.setDate(from.getDate() - 7);
  if (preset === "30d") from.setDate(from.getDate() - 30);
  return { from, to };
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
