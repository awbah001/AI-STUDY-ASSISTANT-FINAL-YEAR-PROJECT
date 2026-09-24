import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, BarChart3, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

export default function AdminAcademic() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.getAcademicPerformance.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const { data: lecturers } = trpc.admin.listUsers.useQuery(
    { page: 1, pageSize: 100, search: "", role: "lecturer", status: "active" },
    { enabled: user?.role === "admin" }
  );

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [lecturerId, setLecturerId] = useState("");
  const [reason, setReason] = useState("Assigned as module lecturer");

  const createCourse = trpc.admin.createCourse.useMutation({
    onSuccess: (course) => {
      toast.success(`Assigned ${course.title} (${course.code}) to the lecturer.`);
      setTitle("");
      setSubject("");
      setDescription("");
      setLecturerId("");
      utils.admin.getAcademicPerformance.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const reassign = trpc.admin.assignLecturerToCourse.useMutation({
    onSuccess: () => {
      toast.success("Lecturer updated for this course.");
      utils.admin.getAcademicPerformance.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  if (!user || user.role !== "admin") return null;

  const lecturerOptions = lecturers?.items ?? [];

  const exportCsv = () => {
    const rows = [
      ["Course", "Code", "Lecturer", "Enrolled", "Average quiz score"],
      ...(data?.courses ?? []).map((c) => [
        c.title,
        c.code,
        c.lecturerName ?? "",
        c.enrolled,
        Math.round(c.averageScore),
      ]),
    ];
    const blob = new Blob(
      [rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n")],
      { type: "text/csv" }
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "academic-performance.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-6xl space-y-6">
        <AdminPageHeader
          eyebrow="Catalogue"
          title="Academic"
          description="Create courses, assign lecturers, and review enrolment and outcomes."
          actions={
            <button
              onClick={exportCsv}
              disabled={!data}
              className="rounded-xl bg-[#033c35] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Export CSV
            </button>
          }
        />

        <section className="rounded-2xl border border-teal-100/80 bg-gradient-to-b from-teal-50/60 to-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Give a lecturer a course</h2>
          <p className="mt-1 text-sm text-slate-500">
            Only administrators can add a course to the catalogue. The selected lecturer then sees it under My Courses.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Course title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Geographic Information Systems"
                className="w-full rounded-xl border px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Lecturer</span>
              <select
                value={lecturerId}
                onChange={(e) => setLecturerId(e.target.value)}
                className="w-full rounded-xl border px-3 py-2"
              >
                <option value="">Select a lecturer</option>
                {lecturerOptions.map((lecturer) => (
                  <option key={lecturer.id} value={lecturer.id}>
                    {lecturer.name} ({lecturer.email})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Subject (optional)</span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Computer Science"
                className="w-full rounded-xl border px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Reason</span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl border px-3 py-2"
              />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">Description (optional)</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-xl border px-3 py-2"
              />
            </label>
          </div>
          <button
            className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={!title.trim() || !lecturerId || reason.trim().length < 3 || createCourse.isPending}
            onClick={() =>
              createCourse.mutate({
                title: title.trim(),
                subject: subject.trim() || undefined,
                description: description.trim() || undefined,
                lecturerId: Number(lecturerId),
                reason: reason.trim(),
              })
            }
          >
            {createCourse.isPending ? "Assigning…" : "Create and assign course"}
          </button>
          {lecturerOptions.length === 0 ? (
            <p className="mt-3 text-sm text-amber-700">Create a lecturer account on Users first, then assign a course here.</p>
          ) : null}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Metric icon={<Users />} label="Courses" value={data?.courses.length ?? 0} tone="emerald" />
          <Metric icon={<AlertTriangle />} label="Students at risk" value={data?.atRisk.length ?? 0} tone="amber" />
          <Metric icon={<BarChart3 />} label="Weak topics" value={data?.topicWeaknesses.length ?? 0} tone="violet" />
        </section>
        <Panel title="Course enrolment and lecturer assignment" tone="emerald">
          <Table
            heads={["Course", "Lecturer", "Enrolled", "Average quiz score", "Reassign"]}
            rows={(data?.courses ?? []).map((c) => [
              <>
                {c.code} — {c.title}
              </>,
              c.lecturerName ?? "Unassigned",
              c.enrolled,
              `${Math.round(c.averageScore)}%`,
              <select
                key={c.courseId}
                defaultValue={c.lecturerId ?? ""}
                className="max-w-[220px] rounded-lg border px-2 py-1 text-xs"
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (!next || next === c.lecturerId) return;
                  const note = prompt("Reason for reassignment?");
                  if (!note || note.trim().length < 3) {
                    toast.error("A reason of at least 3 characters is required.");
                    e.target.value = String(c.lecturerId ?? "");
                    return;
                  }
                  reassign.mutate({ courseId: c.courseId, lecturerId: next, reason: note.trim() });
                }}
              >
                {lecturerOptions.map((lecturer) => (
                  <option key={lecturer.id} value={lecturer.id}>
                    {lecturer.name}
                  </option>
                ))}
              </select>,
            ])}
            loading={isLoading}
          />
        </Panel>
        <Panel title="Students requiring follow-up" tone="amber">
          <Table
            heads={["Student", "Last activity", "Quiz average", "Late submissions"]}
            rows={(data?.atRisk ?? []).map((s) => [
              <>
                <b>{s.name}</b>
                <br />
                <span className="text-xs text-slate-500">{s.email}</span>
              </>,
              s.lastActivity ? new Date(s.lastActivity).toLocaleDateString() : "No activity",
              `${Math.round(s.averageScore)}%`,
              s.overdue,
            ])}
            loading={isLoading}
          />
        </Panel>
        <Panel title="Topic-level quiz weaknesses" tone="violet">
          <Table
            heads={["Topic", "Attempts", "Average score"]}
            rows={(data?.topicWeaknesses ?? []).map((t) => [
              t.topic || "Uncategorised",
              t.attempted,
              `${Math.round(t.averageScore)}%`,
            ])}
            loading={isLoading}
          />
        </Panel>
      </main>
    </DashboardLayout>
  );
}
function Metric({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: "emerald" | "amber" | "violet" }) {
  const tones = {
    emerald: "from-emerald-50 to-white border-emerald-100 text-emerald-700",
    amber: "from-amber-50 to-white border-amber-100 text-amber-700",
    violet: "from-violet-50 to-white border-violet-100 text-violet-700",
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-5 shadow-sm ${tones[tone]}`}>
      <div className="flex gap-3">
        {icon}
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
function Panel({ title, children, tone = "emerald" }: { title: string; children: ReactNode; tone?: "emerald" | "amber" | "violet" }) {
  const tones = {
    emerald: "border-emerald-100/80 from-emerald-50/50",
    amber: "border-amber-100/80 from-amber-50/50",
    violet: "border-violet-100/80 from-violet-50/50",
  };
  return (
    <section className={`overflow-hidden rounded-2xl border bg-gradient-to-b to-white shadow-sm ${tones[tone]}`}>
      <h2 className="border-b border-slate-100/80 px-5 py-4 font-semibold">{title}</h2>
      {children}
    </section>
  );
}
function Table({ heads, rows, loading }: { heads: string[]; rows: ReactNode[][]; loading: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            {heads.map((h) => (
              <th key={h} className="px-5 py-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td className="p-5" colSpan={heads.length}>
                Loading…
              </td>
            </tr>
          ) : rows.length ? (
            rows.map((row, i) => (
              <tr key={i} className="border-t">
                {row.map((cell, j) => (
                  <td key={j} className="px-5 py-3">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className="p-5 text-slate-500" colSpan={heads.length}>
                No data yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
