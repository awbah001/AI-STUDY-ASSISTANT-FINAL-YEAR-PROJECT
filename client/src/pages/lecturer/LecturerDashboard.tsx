import DashboardLayout from "@/components/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { trpc } from "@/lib/trpc";
import {
  BookMarked, Users, FileText, ClipboardList,
  Megaphone, Brain, Layers, GraduationCap,
  TrendingUp, ChevronRight,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

export default function LecturerDashboard() {
  const { user, isAllowed } = useRoleGuard("lecturer");
  const [, setLocation] = useLocation();

  const { data: stats, isLoading } = trpc.lecturer.dashboardStats.useQuery(undefined, { enabled: isAllowed });
  const { data: engagement } = trpc.lecturer.analytics.engagement.useQuery(undefined, { enabled: isAllowed });

  if (!isAllowed || !user) return null;

  const firstName = user.name?.split(" ")[0] ?? "Professor";

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">

        {/* ── Welcome strip ── */}
        <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-white px-8 py-6 shadow-sm">
          <div className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-2 opacity-20">
            <GraduationCap className="h-24 w-24 text-indigo-400" />
          </div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-indigo-600">Lecturer Portal</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back, {firstName}</h1>
          <p className="mt-1 text-sm text-slate-500 max-w-lg">
            Manage courses, upload academic materials, and monitor student learning with AI-powered insights.
          </p>
          <Button
            className="mt-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
            size="sm"
            onClick={() => setLocation("/lecturer/courses")}
          >
            <BookMarked className="h-4 w-4" /> Manage courses
          </Button>
        </div>

        {/* ── Stats row 1 ── */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Courses"   value={isLoading ? null : stats?.courseCount ?? 0}    icon={<BookMarked className="h-5 w-5 text-white" />}    color="bg-indigo-500"  border="border-t-indigo-500" />
          <StatCard label="Students"  value={isLoading ? null : stats?.studentCount ?? 0}   icon={<Users className="h-5 w-5 text-white" />}         color="bg-violet-500"  border="border-t-violet-500" />
          <StatCard label="Materials" value={isLoading ? null : stats?.documentCount ?? 0}  icon={<FileText className="h-5 w-5 text-white" />}      color="bg-blue-500"    border="border-t-blue-500" />
          <StatCard label="Assignments" value={isLoading ? null : stats?.assignmentCount ?? 0} icon={<ClipboardList className="h-5 w-5 text-white" />} color="bg-cyan-500" border="border-t-cyan-500" />
        </div>

        {/* ── Stats row 2 ── */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="AI Quizzes"     value={isLoading ? null : stats?.quizCount ?? 0}         icon={<Brain className="h-5 w-5 text-white" />}    color="bg-purple-500"  border="border-t-purple-500" />
          <StatCard label="Flashcard sets" value={isLoading ? null : stats?.flashcardCount ?? 0}    icon={<Layers className="h-5 w-5 text-white" />}   color="bg-fuchsia-500" border="border-t-fuchsia-500" />
          <StatCard label="Announcements"  value={isLoading ? null : stats?.announcementCount ?? 0} icon={<Megaphone className="h-5 w-5 text-white" />} color="bg-rose-500"    border="border-t-rose-500" />
        </div>

        {/* ── Engagement chart ── */}
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
              <TrendingUp className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Course Engagement</p>
              <p className="text-xs text-slate-500">Average student activity score per course</p>
            </div>
          </div>
          <div className="p-6 h-[260px]">
            {engagement && engagement.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={engagement} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 6" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="courseTitle" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
                  <Bar dataKey="avgEngagement" fill="#4f46e5" radius={[8, 8, 0, 0]} name="Avg Engagement" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <TrendingUp className="h-10 w-10 text-slate-200" />
                <p className="text-sm text-slate-500">Create a course and enroll students to see engagement analytics.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Quick nav cards ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QuickNav icon={<BookMarked className="h-5 w-5 text-indigo-600" />} bg="bg-indigo-50" title="Course Management" desc="Create subjects, upload notes, and share enrollment codes." path="/lecturer/courses" setLocation={setLocation} />
          <QuickNav icon={<Brain className="h-5 w-5 text-purple-600" />} bg="bg-purple-50" title="Student Performance" desc="Track quiz scores, study time, and participation." path="/lecturer/analytics" setLocation={setLocation} />
          <QuickNav icon={<ClipboardList className="h-5 w-5 text-cyan-600" />} bg="bg-cyan-50" title="Progress Reports" desc="Generate detailed per-student progress reports." path="/lecturer/reports" setLocation={setLocation} />
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value, icon, color, border }: {
  label: string; value: number | null; icon: React.ReactNode; color: string; border: string;
}) {
  return (
    <div className={`rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden border-t-4 ${border}`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            {value === null
              ? <Skeleton className="mt-2 h-8 w-14 rounded-lg" />
              : <p className="mt-1 text-3xl font-black tabular-nums text-slate-900">{value}</p>
            }
          </div>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color} shadow-sm`}>
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickNav({ icon, bg, title, desc, path, setLocation }: {
  icon: React.ReactNode; bg: string; title: string; desc: string;
  path: string; setLocation: (p: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => setLocation(path)}
      className="group rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
    >
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>{icon}</div>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
      </div>
      <p className="mt-1 text-sm text-slate-500">{desc}</p>
    </button>
  );
}
