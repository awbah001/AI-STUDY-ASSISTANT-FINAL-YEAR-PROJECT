import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, BarChart3, Users } from "lucide-react";

export default function AdminAcademic() {
  const { user } = useAuth();
  const { data, isLoading } = trpc.admin.getAcademicPerformance.useQuery(undefined, { enabled: user?.role === "admin" });
  if (!user || user.role !== "admin") return null;
  const exportCsv = () => {
    const rows = [["Course", "Code", "Lecturer", "Enrolled", "Average quiz score"], ...(data?.courses ?? []).map(c => [c.title, c.code, c.lecturerName ?? "", c.enrolled, Math.round(c.averageScore)])];
    const blob = new Blob([rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "academic-performance.csv"; link.click(); URL.revokeObjectURL(link.href);
  };
  return <DashboardLayout><main className="mx-auto max-w-6xl space-y-6">
    <header className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-bold text-slate-900">Academic Performance Center</h1><p className="text-sm text-slate-500">Course outcomes, risk signals, and learning weaknesses.</p></div><button onClick={exportCsv} disabled={!data} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Export CSV</button></header>
    <section className="grid gap-4 md:grid-cols-3">
      <Metric icon={<Users />} label="Courses" value={data?.courses.length ?? 0} /><Metric icon={<AlertTriangle />} label="Students at risk" value={data?.atRisk.length ?? 0} /><Metric icon={<BarChart3 />} label="Weak topics" value={data?.topicWeaknesses.length ?? 0} />
    </section>
    <Panel title="Course enrolment and lecturer comparison"><Table heads={["Course", "Lecturer", "Enrolled", "Average quiz score"]} rows={(data?.courses ?? []).map(c => [<>{c.code} — {c.title}</>, c.lecturerName ?? "Unassigned", c.enrolled, `${Math.round(c.averageScore)}%`])} loading={isLoading} /></Panel>
    <Panel title="Students requiring follow-up"><Table heads={["Student", "Last activity", "Quiz average", "Late submissions"]} rows={(data?.atRisk ?? []).map(s => [<><b>{s.name}</b><br/><span className="text-xs text-slate-500">{s.email}</span></>, s.lastActivity ? new Date(s.lastActivity).toLocaleDateString() : "No activity", `${Math.round(s.averageScore)}%`, s.overdue])} loading={isLoading} /></Panel>
    <Panel title="Topic-level quiz weaknesses"><Table heads={["Topic", "Attempts", "Average score"]} rows={(data?.topicWeaknesses ?? []).map(t => [t.topic || "Uncategorised", t.attempted, `${Math.round(t.averageScore)}%`])} loading={isLoading} /></Panel>
  </main></DashboardLayout>;
}
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <div className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex gap-3 text-emerald-600">{icon}<span className="text-sm text-slate-500">{label}</span></div><p className="mt-2 text-3xl font-bold">{value}</p></div>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><h2 className="border-b px-5 py-4 font-semibold">{title}</h2>{children}</section>; }
function Table({ heads, rows, loading }: { heads: string[]; rows: React.ReactNode[][]; loading: boolean }) { return <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-slate-500"><tr>{heads.map(h => <th key={h} className="px-5 py-3">{h}</th>)}</tr></thead><tbody>{loading ? <tr><td className="p-5" colSpan={heads.length}>Loading…</td></tr> : rows.length ? rows.map((row, i) => <tr key={i} className="border-t">{row.map((cell, j) => <td key={j} className="px-5 py-3">{cell}</td>)}</tr>) : <tr><td className="p-5 text-slate-500" colSpan={heads.length}>No data yet.</td></tr>}</tbody></table></div>; }
