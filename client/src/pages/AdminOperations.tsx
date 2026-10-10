import { AdminHero } from "@/components/admin/AdminHero";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { promptReason } from "@/lib/formValidation";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Cloud,
  Database,
  FileText,
  Hexagon,
  MoreVertical,
  RotateCw,
  Server,
  Settings2,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const CHECKLIST = [
  "Monitor processing queue",
  "Track storage health",
  "Identify and resolve failures",
  "Ensure platform stability",
] as const;

export default function AdminOperations() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: overview, isLoading } = trpc.admin.getOperationsOverview.useQuery(undefined, {
    enabled: user?.role === "admin",
    refetchInterval: 15_000,
  });
  const { data: failures, isLoading: failuresLoading } = trpc.admin.listDocuments.useQuery(
    { page: 1, pageSize: 50, search: "", status: "failed" },
    { enabled: user?.role === "admin" }
  );
  const retry = trpc.admin.retryDocumentProcessing.useMutation({
    onSuccess: () => {
      toast.success("Processing retry queued.");
      utils.admin.getOperationsOverview.invalidate();
      utils.admin.listDocuments.invalidate();
      setSelected(new Set());
    },
    onError: (e) => toast.error(e.message),
  });

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const failedItems = failures?.items ?? [];
  const allSelected = failedItems.length > 0 && failedItems.every((d) => selected.has(d.id));

  const bytes = overview?.storageBytes ?? 0;
  const storageLabel =
    bytes >= 1_073_741_824
      ? `${(bytes / 1_073_741_824).toFixed(1)} GB`
      : `${(bytes / 1_048_576).toFixed(1)} MB`;

  const queued = overview?.jobs.pending ?? 0;
  const completed = overview?.jobs.ready ?? 0;
  const failed = overview?.jobs.failed ?? 0;


  if (!user || user.role !== "admin") return null;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(failedItems.map((d) => d.id)));
  };

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const retryOne = (documentId: number) => {
    const reason = promptReason("Reason for retry:");
    if (reason) retry.mutate({ documentId, reason });
  };

  const retrySelected = async () => {
    if (!selected.size) {
      toast.message("Select at least one failed job to retry.");
      return;
    }
    const reason = promptReason(`Reason for retrying ${selected.size} job(s):`);
    if (!reason) return;
    for (const documentId of selected) {
      await retry.mutateAsync({ documentId, reason });
    }
  };

  return (
    <DashboardLayout>
      <main className="admin-content admin-operations mx-auto space-y-5">
        {/* Hero banner */}
        <AdminHero kind="operations" />

        {/* Metric cards */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Queued jobs"
            value={isLoading ? "—" : queued}
            hint="Waiting to be processed"
            icon={<Clock3 className="h-4 w-4" />}
            iconClass="bg-amber-50 text-amber-600"


          />
          <MetricCard
            label="Completed jobs"
            value={isLoading ? "—" : completed}
            hint="Successfully processed"
            icon={<CheckCircle2 className="h-4 w-4" />}
            iconClass="bg-emerald-50 text-emerald-700"


          />
          <MetricCard
            label="Failed jobs"
            value={isLoading ? "—" : failed}
            hint="Require attention"
            icon={<AlertCircle className="h-4 w-4" />}
            iconClass="bg-rose-50 text-rose-600"


          />
          <MetricCard
            label="Storage used"
            value={isLoading ? "—" : storageLabel}
            hint="Platform storage utilization"
            icon={<Database className="h-4 w-4" />}
            iconClass="bg-sky-50 text-sky-700"


          />
        </section>

        {/* Failed document processing */}
        <section className="overflow-hidden rounded-[1.25rem] border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <FileText className="h-5 w-5" strokeWidth={1.7} />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-900">Failed document processing</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Retry creates a tracked processing job and preserves the original failure message.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={retry.isPending || selected.size === 0}
                onClick={() => void retrySelected()}
                className="h-9 gap-2 rounded-full border-emerald-200 bg-white px-3.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
              >
                <RotateCw className={`h-3.5 w-3.5 ${retry.isPending ? "animate-spin" : ""}`} />
                Retry selected
              </Button>
              <button
                type="button"
                aria-label="More options"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[12px] font-semibold text-slate-400">
                  <th className="w-12 px-5 py-3 sm:px-6">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={!failedItems.length}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-700 accent-emerald-700"
                    />
                  </th>
                  <SortHeader label="Document" />
                  <SortHeader label="Owner" />
                  <SortHeader label="Failure message" />
                  <SortHeader label="Created at" />
                  <th className="px-5 py-3 text-right sm:px-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {failuresLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="px-4 py-4">
                          <Skeleton className="h-4 w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : failedItems.length ? (
                  failedItems.map((doc) => (
                    <tr
                      key={doc.id}
                      className="border-b border-slate-50 transition-colors hover:bg-slate-50/60"
                    >
                      <td className="px-5 py-4 sm:px-6">
                        <input
                          type="checkbox"
                          aria-label={`Select ${doc.title}`}
                          checked={selected.has(doc.id)}
                          onChange={() => toggleOne(doc.id)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-700 accent-emerald-700"
                        />
                      </td>
                      <td className="px-3 py-4 font-semibold text-slate-900">{doc.title}</td>
                      <td className="px-3 py-4 text-slate-600">{doc.ownerName ?? "—"}</td>
                      <td className="max-w-xs truncate px-3 py-4 text-rose-600">
                        {doc.processingError || "Unknown failure"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-slate-500">
                        {doc.createdAt ? new Date(doc.createdAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-5 py-4 text-right sm:px-6">
                        <button
                          type="button"
                          disabled={retry.isPending}
                          onClick={() => retryOne(doc.id)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          <RotateCw className="h-3.5 w-3.5" />
                          Retry
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-16">
                      <div className="mx-auto flex max-w-sm flex-col items-center text-center">
                        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-slate-100">
                          <FileText className="h-7 w-7" strokeWidth={1.5} />
                        </div>
                        <p className="text-sm font-semibold text-slate-800">No failed processing jobs</p>
                        <p className="mt-1 text-sm text-slate-500">
                          All documents are being processed successfully.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent platform errors */}
        <section className="overflow-hidden rounded-[1.25rem] border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <AlertTriangle className="h-5 w-5" strokeWidth={1.7} />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-900">Recent platform errors</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  System errors and exceptions across the platform.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLocation("/admin/audit")}
              className="h-9 gap-2 rounded-full border-emerald-200 bg-white px-3.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          {(overview?.recentErrors?.length ?? 0) > 0 ? (
            <div className="divide-y divide-slate-50 border-t border-slate-100">
              {overview!.recentErrors.slice(0, 5).map((event) => (
                <div key={event.id} className="px-5 py-3.5 sm:px-6">
                  <p className="text-sm font-medium text-slate-800">
                    {event.category}: {event.message}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {new Date(event.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </main>
    </DashboardLayout>
  );
}

function SortHeader({ label }: { label: string }) {
  return (
    <th className="px-3 py-3">
      <span className="inline-flex items-center gap-1">
        {label}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </span>
    </th>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  iconClass,


}: {
  label: string;
  value: string | number;
  hint: string;
  icon: ReactNode;
  iconClass: string;


}) {
  return (
    <div className="admin-stat-card rounded-[1.1rem] border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-2">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconClass}`}>{icon}</div>
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

