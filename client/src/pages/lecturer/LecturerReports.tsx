import DashboardLayout from "@/components/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { trpc } from "@/lib/trpc";
import {
  ClipboardList, Download, User, BookOpen,
  Brain, Layers, Clock, TrendingUp, FileText,
} from "lucide-react";
import { useState } from "react";

export default function LecturerReports() {
  const { isAllowed } = useRoleGuard("lecturer");
  const [courseId, setCourseId] = useState("");
  const [studentId, setStudentId] = useState("");

  const { data: courses } = trpc.lecturer.courses.list.useQuery(undefined, { enabled: isAllowed });
  const cid = courseId ? Number(courseId) : undefined;
  const { data: students } = trpc.lecturer.students.listByCourse.useQuery(
    { courseId: cid! },
    { enabled: isAllowed && !!cid }
  );
  const { data: report, isLoading: reportLoading } = trpc.lecturer.students.progressReport.useQuery(
    { courseId: cid!, studentId: Number(studentId) },
    { enabled: isAllowed && !!cid && !!studentId }
  );

  const exportCsv = () => {
    if (!report) return;
    const rows: string[][] = [
      ["Student", report.student.name ?? ""],
      ["Email", report.student.email ?? ""],
      ["Course", report.course?.title ?? ""],
      ["Avg Quiz Score", `${report.student.avgQuizScore}%`],
      ["Quizzes Attempted", String(report.student.quizzesAttempted)],
      ["Flashcards Reviewed", String(report.student.flashcardsReviewed)],
      ["Study Minutes", String(report.student.studyMinutes)],
      ["Engagement Score", String(report.student.engagementScore)],
      [],
      ["Materials", ""],
      ...(report.documents?.map((d) => ["", d.title]) ?? []),
      [],
      ["Recent Study Sessions", "", "", ""],
      ["Activity", "Duration (min)", "Date"],
      ...report.recentSessions.map((s) => [
        s.activityType,
        String(s.durationMinutes ?? 0),
        new Date(s.startTime).toLocaleDateString(),
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${report.student.name?.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isAllowed) return null;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Progress Reports</h1>
          <p className="mt-1 text-sm text-slate-500">Generate detailed reports on individual student progress.</p>
        </div>

        {/* Selector */}
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
              <User className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Select Student</p>
              <p className="text-xs text-slate-500">Choose a course first, then pick a student</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 p-6">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Course</p>
              <Select value={courseId} onValueChange={(v) => { setCourseId(v); setStudentId(""); }}>
                <SelectTrigger className="rounded-xl border-slate-200">
                  <SelectValue placeholder="Select course..." />
                </SelectTrigger>
                <SelectContent>
                  {courses?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</p>
              <Select value={studentId} onValueChange={setStudentId} disabled={!cid}>
                <SelectTrigger className="rounded-xl border-slate-200">
                  <SelectValue placeholder="Select student..." />
                </SelectTrigger>
                <SelectContent>
                  {students?.map((s) => (
                    <SelectItem key={s.studentId} value={String(s.studentId)}>
                      {s.name} — {s.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Loading */}
        {reportLoading && (
          <div className="space-y-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        )}

        {/* Report */}
        {report && !reportLoading && (
          <>
            {/* Student header */}
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-lg font-bold text-white">
                    {report.student.name?.charAt(0).toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{report.student.name}</p>
                    <p className="text-sm text-slate-500">{report.student.email}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-slate-200 gap-2"
                  onClick={exportCsv}
                >
                  <Download className="h-4 w-4" /> Export CSV
                </Button>
              </div>

              {/* Stat tiles */}
              <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-5">
                <StatTile icon={<Brain className="h-4 w-4 text-indigo-600" />}   bg="bg-indigo-50" label="Avg Score"     value={`${report.student.avgQuizScore}%`} />
                <StatTile icon={<Brain className="h-4 w-4 text-purple-600" />}   bg="bg-purple-50" label="Quizzes"       value={String(report.student.quizzesAttempted)} />
                <StatTile icon={<Layers className="h-4 w-4 text-blue-600" />}    bg="bg-blue-50"   label="Flashcards"    value={String(report.student.flashcardsReviewed)} />
                <StatTile icon={<Clock className="h-4 w-4 text-cyan-600" />}     bg="bg-cyan-50"   label="Study mins"    value={String(report.student.studyMinutes)} />
                <StatTile icon={<TrendingUp className="h-4 w-4 text-emerald-600" />} bg="bg-emerald-50" label="Engagement" value={String(report.student.engagementScore)} />
              </div>
            </div>

            {/* Materials */}
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                  <FileText className="h-4 w-4 text-slate-600" />
                </div>
                <p className="text-sm font-semibold text-slate-800">Course Materials</p>
              </div>
              {!report.documents || report.documents.length === 0 ? (
                <p className="px-6 py-4 text-sm text-slate-400">No materials in this course yet.</p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {report.documents.map((d) => (
                    <div key={d.id} className="flex items-center gap-3 px-6 py-3">
                      <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-700">{d.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Study sessions */}
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                  <Clock className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="text-sm font-semibold text-slate-800">Recent Study Sessions</p>
              </div>
              {report.recentSessions.length === 0 ? (
                <p className="px-6 py-4 text-sm text-slate-400">No study sessions recorded yet.</p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {report.recentSessions.map((s, i) => (
                    <div key={i} className="flex items-center justify-between px-6 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          s.activityType === "quiz" ? "bg-purple-50 text-purple-700" :
                          s.activityType === "flashcard" ? "bg-blue-50 text-blue-700" :
                          s.activityType === "chat" ? "bg-emerald-50 text-emerald-700" :
                          "bg-slate-100 text-slate-600"
                        }`}>
                          {s.activityType}
                        </span>
                        <span className="text-sm text-slate-600">
                          {new Date(s.startTime).toLocaleDateString(undefined, { dateStyle: "medium" })}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-slate-700">{s.durationMinutes ?? 0} min</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Empty state */}
        {!report && !reportLoading && (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-500">Select a course and student</p>
            <p className="text-xs text-slate-400 mt-1">Their progress report will appear here.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatTile({ icon, bg, label, value }: {
  icon: React.ReactNode; bg: string; label: string; value: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 bg-white p-4`}>
      <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${bg}`}>{icon}</div>
      <p className="text-lg font-bold text-slate-900">{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}
