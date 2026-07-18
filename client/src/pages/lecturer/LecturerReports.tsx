import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { trpc } from "@/lib/trpc";
import { ClipboardList, Download } from "lucide-react";
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
  const { data: report } = trpc.lecturer.students.progressReport.useQuery(
    { courseId: cid!, studentId: Number(studentId) },
    { enabled: isAllowed && !!cid && !!studentId }
  );

  const exportCsv = () => {
    if (!report) return;
    const rows = [
      ["Student", report.student.name ?? ""],
      ["Email", report.student.email ?? ""],
      ["Course", report.course?.title ?? ""],
      ["Avg Quiz Score", String(report.student.avgQuizScore)],
      ["Quizzes Attempted", String(report.student.quizzesAttempted)],
      ["Flashcards Reviewed", String(report.student.flashcardsReviewed)],
      ["Study Minutes", String(report.student.studyMinutes)],
      ["Engagement Score", String(report.student.engagementScore)],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `progress-report-${studentId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isAllowed) return null;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-indigo-600" />
            Progress reports
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Generate detailed reports on individual student progress.
          </p>
        </div>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Select student</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Select value={courseId} onValueChange={(v) => { setCourseId(v); setStudentId(""); }}>
              <SelectTrigger className="rounded-2xl"><SelectValue placeholder="Course" /></SelectTrigger>
              <SelectContent>
                {courses?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={studentId} onValueChange={setStudentId} disabled={!cid}>
              <SelectTrigger className="rounded-2xl"><SelectValue placeholder="Student" /></SelectTrigger>
              <SelectContent>
                {students?.map((s) => (
                  <SelectItem key={s.studentId} value={String(s.studentId)}>
                    {s.name} ({s.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {report ? (
          <Card className="rounded-3xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{report.student.name}</CardTitle>
              <Button variant="outline" className="rounded-2xl gap-2" onClick={exportCsv}>
                <Download className="h-4 w-4" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Stat label="Avg quiz score" value={`${report.student.avgQuizScore}%`} />
                <Stat label="Quizzes" value={String(report.student.quizzesAttempted)} />
                <Stat label="Flashcards" value={String(report.student.flashcardsReviewed)} />
                <Stat label="Engagement" value={String(report.student.engagementScore)} />
              </div>
              <div>
                <h4 className="font-semibold mb-2">Course materials</h4>
                <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                  {report.documents?.map((d) => (
                    <li key={d.id}>{d.title}</li>
                  ))}
                </ul>
              </div>
              {report.recentSessions.length > 0 ? (
                <div>
                  <h4 className="font-semibold mb-2">Recent study sessions</h4>
                  <ul className="text-sm space-y-1">
                    {report.recentSessions.map((s, i) => (
                      <li key={i} className="text-muted-foreground">
                        {s.activityType} — {s.durationMinutes ?? 0} min —{" "}
                        {new Date(s.startTime).toLocaleDateString()}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <p className="text-center text-muted-foreground py-12">
            Select a course and student to view their progress report.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-indigo-50 p-4">
      <p className="text-xs text-indigo-600 font-medium">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}
