import DashboardLayout from "@/components/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { trpc } from "@/lib/trpc";
import { BarChart3, TrendingUp, Users, Brain, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

export default function LecturerAnalytics() {
  const { isAllowed } = useRoleGuard("lecturer");
  const [courseId, setCourseId] = useState<string>("");
  const [expandedQuiz, setExpandedQuiz] = useState<number | null>(null);

  const { data: courses } = trpc.lecturer.courses.list.useQuery(undefined, { enabled: isAllowed });
  const { data: engagement, isLoading: engagementLoading } = trpc.lecturer.analytics.engagement.useQuery(undefined, { enabled: isAllowed });

  const selectedId = courseId ? Number(courseId) : courses?.[0]?.id;
  const { data: performance, isLoading: perfLoading } = trpc.lecturer.analytics.coursePerformance.useQuery(
    { courseId: selectedId! },
    { enabled: isAllowed && !!selectedId }
  );
  const { data: quizAttempts, isLoading: attemptsLoading } = trpc.lecturer.analytics.quizAttempts.useQuery(
    { courseId: selectedId! },
    { enabled: isAllowed && !!selectedId }
  );

  if (!isAllowed) return null;

  const chartData = (performance ?? []).map((p) => ({
    name: p.name?.split(" ")[0] ?? "Student",
    Engagement: p.engagementScore,
    Quizzes: p.quizzesAttempted,
    "Avg Score %": p.avgQuizScore,
  }));

  const selectedCourse = courses?.find((c) => c.id === selectedId);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Student Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">Track participation, quiz performance, and engagement.</p>
        </div>

        {/* Course selector — shared across all sections */}
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium text-slate-600 shrink-0">Viewing course:</p>
          <Select value={courseId || String(courses?.[0]?.id ?? "")} onValueChange={setCourseId}>
            <SelectTrigger className="w-[260px] rounded-xl border-slate-200">
              <SelectValue placeholder="Select course" />
            </SelectTrigger>
            <SelectContent>
              {courses?.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── Engagement by course ── */}
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
              <TrendingUp className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Engagement by Course</p>
              <p className="text-xs text-slate-500">Average student activity score per course</p>
            </div>
          </div>
          <div className="p-6 h-[260px]">
            {engagementLoading ? (
              <Skeleton className="h-full w-full rounded-xl" />
            ) : engagement && engagement.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={engagement} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 6" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="courseTitle" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
                  <Bar dataKey="avgEngagement" fill="#6366f1" radius={[6, 6, 0, 0]} name="Avg Engagement" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <BarChart3 className="h-10 w-10 text-slate-200" />
                <p className="text-sm text-slate-500">No engagement data yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Per-student performance ── */}
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
              <Brain className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Student Performance</p>
              <p className="text-xs text-slate-500">{selectedCourse?.title ?? "Select a course"}</p>
            </div>
          </div>

          <div className="px-6 pt-6 pb-2 h-[280px]">
            {perfLoading ? (
              <Skeleton className="h-full w-full rounded-xl" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 6" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Engagement" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Quizzes" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Avg Score %" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <Users className="h-10 w-10 text-slate-200" />
                <p className="text-sm text-slate-500">Enroll students to see performance data.</p>
              </div>
            )}
          </div>

          {performance && performance.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-slate-100 bg-slate-50/60">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Student</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Engagement</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Quizzes</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Avg Score</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Study time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Chat msgs</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.map((p) => (
                    <tr key={p.studentId} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                            {p.name?.charAt(0).toUpperCase() ?? "?"}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{p.name}</p>
                            <p className="text-xs text-slate-500">{p.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                          {p.engagementScore}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.quizzesAttempted}</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${p.avgQuizScore >= 70 ? "text-emerald-600" : p.avgQuizScore >= 50 ? "text-amber-600" : "text-red-500"}`}>
                          {p.avgQuizScore}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.studyMinutes} min</td>
                      <td className="px-4 py-3 text-slate-600">{p.chatCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Quiz attempts per quiz ── */}
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
              <HelpCircle className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Quiz Attempts</p>
              <p className="text-xs text-slate-500">See which students attempted each quiz and their scores</p>
            </div>
          </div>

          {attemptsLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : !quizAttempts || quizAttempts.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <HelpCircle className="mx-auto h-10 w-10 text-slate-200 mb-3" />
              <p className="text-sm text-slate-500">No quizzes generated for this course yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {quizAttempts.map((quiz) => (
                <div key={quiz.id}>
                  {/* Quiz row header */}
                  <button
                    type="button"
                    className="flex w-full items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors text-left"
                    onClick={() => setExpandedQuiz(expandedQuiz === quiz.id ? null : quiz.id)}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50">
                      <HelpCircle className="h-4 w-4 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{quiz.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {quiz.totalQuestions} questions ·{" "}
                        {quiz.attemptCount} attempt{quiz.attemptCount !== 1 ? "s" : ""} ·{" "}
                        Avg: <span className={`font-semibold ${quiz.avgScore >= 70 ? "text-emerald-600" : quiz.avgScore >= 50 ? "text-amber-600" : "text-red-500"}`}>
                          {quiz.attemptCount > 0 ? `${quiz.avgScore}%` : "—"}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        {quiz.attemptCount} attempted
                      </span>
                      {expandedQuiz === quiz.id
                        ? <ChevronUp className="h-4 w-4 text-slate-400" />
                        : <ChevronDown className="h-4 w-4 text-slate-400" />
                      }
                    </div>
                  </button>

                  {/* Expanded student attempts */}
                  {expandedQuiz === quiz.id && (
                    <div className="border-t border-slate-50 bg-slate-50/40">
                      {quiz.attempts.length === 0 ? (
                        <p className="px-8 py-4 text-sm text-slate-400">No students have attempted this quiz yet.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="px-8 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Student</th>
                              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Score</th>
                              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Completed</th>
                            </tr>
                          </thead>
                          <tbody>
                            {quiz.attempts.map((a) => (
                              <tr key={a.studentId} className="border-b border-slate-50 hover:bg-white transition-colors">
                                <td className="px-8 py-3">
                                  <div className="flex items-center gap-2.5">
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                                      {a.studentName?.charAt(0).toUpperCase() ?? "?"}
                                    </div>
                                    <div>
                                      <p className="font-medium text-slate-900">{a.studentName}</p>
                                      <p className="text-xs text-slate-400">{a.studentEmail}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  {a.score !== null ? (
                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                      a.score >= 70 ? "bg-emerald-50 text-emerald-700" :
                                      a.score >= 50 ? "bg-amber-50 text-amber-700" :
                                      "bg-red-50 text-red-600"
                                    }`}>
                                      {a.score.toFixed(0)}%
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-xs">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-500">
                                  {a.completedAt
                                    ? new Date(a.completedAt).toLocaleDateString(undefined, { dateStyle: "medium" })
                                    : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
