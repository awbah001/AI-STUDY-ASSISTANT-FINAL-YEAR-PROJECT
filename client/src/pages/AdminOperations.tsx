import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle2, Clock3, Database, RotateCw } from "lucide-react";
import { toast } from "sonner";

export default function AdminOperations() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: overview, isLoading } = trpc.admin.getOperationsOverview.useQuery(undefined, { enabled: user?.role === "admin", refetchInterval: 15_000 });
  const { data: failures } = trpc.admin.listDocuments.useQuery({ page: 1, pageSize: 50, search: "", status: "failed" }, { enabled: user?.role === "admin" });
  const retry = trpc.admin.retryDocumentProcessing.useMutation({ onSuccess: () => { toast.success("Processing retry queued."); utils.admin.getOperationsOverview.invalidate(); utils.admin.listDocuments.invalidate(); }, onError: e => toast.error(e.message) });
  if (!user || user.role !== "admin") return null;
  const bytes = overview?.storageBytes ?? 0;
  return <DashboardLayout><main className="mx-auto max-w-6xl space-y-6">
    <header><h1 className="text-2xl font-bold text-slate-900">Platform Operations</h1><p className="text-sm text-slate-500">AI processing queue, storage health, and operational failures.</p></header>
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Metric icon={<Clock3 />} label="Queued jobs" value={overview?.jobs.pending ?? 0} tone="amber" />
      <Metric icon={<CheckCircle2 />} label="Completed jobs" value={overview?.jobs.ready ?? 0} tone="emerald" />
      <Metric icon={<AlertCircle />} label="Failed jobs" value={overview?.jobs.failed ?? 0} tone="red" />
      <Metric icon={<Database />} label="Storage used" value={`${(bytes / 1_048_576).toFixed(1)} MB`} tone="blue" />
    </section>
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b px-5 py-4"><h2 className="font-semibold">Failed document processing</h2><p className="text-xs text-slate-500">Retry creates a tracked processing job and preserves the original failure message.</p></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-slate-500"><tr><th className="px-5 py-3">Document</th><th className="px-5 py-3">Owner</th><th className="px-5 py-3">Failure</th><th className="px-5 py-3" /></tr></thead><tbody>{failures?.items.length ? failures.items.map(doc => <tr key={doc.id} className="border-t"><td className="px-5 py-3 font-medium">{doc.title}</td><td className="px-5 py-3">{doc.ownerName}</td><td className="max-w-sm truncate px-5 py-3 text-red-600">{doc.processingError || "Unknown failure"}</td><td className="px-5 py-3 text-right"><button disabled={retry.isPending} onClick={() => { const reason = prompt("Reason for retry:"); if (reason && reason.trim().length >= 3) retry.mutate({ documentId: doc.id, reason: reason.trim() }); else if (reason !== null) toast.error("A reason of at least 3 characters is required."); }} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-emerald-700 hover:bg-emerald-50"><RotateCw className="h-3.5 w-3.5" />Retry</button></td></tr>) : <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-500">{isLoading ? "Loading…" : "No failed processing jobs."}</td></tr>}</tbody></table></div></section>
    <section className="rounded-2xl border bg-white shadow-sm"><div className="border-b px-5 py-4"><h2 className="font-semibold">Recent platform errors</h2></div><div className="divide-y">{overview?.recentErrors.length ? overview.recentErrors.map(event => <div key={event.id} className="px-5 py-3"><p className="text-sm font-medium">{event.category}: {event.message}</p><p className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</p></div>) : <p className="px-5 py-8 text-center text-sm text-slate-500">No unresolved errors.</p>}</div></section>
  </main></DashboardLayout>;
}
function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone: string }) { const tones: Record<string, string> = { amber: "text-amber-600", emerald: "text-emerald-600", red: "text-red-600", blue: "text-blue-600" }; return <div className="rounded-2xl border bg-white p-5 shadow-sm"><div className={`flex gap-2 text-sm ${tones[tone]}`}>{icon}<span>{label}</span></div><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p></div>; }
