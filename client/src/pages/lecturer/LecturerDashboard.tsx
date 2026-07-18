import DashboardLayout from "@/components/DashboardLayout";
import { LecturerStatCard } from "@/components/lecturer/LecturerStatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { trpc } from "@/lib/trpc";
import {
  BookMarked,
  Users,
  FileText,
  ClipboardList,
  Megaphone,
  Brain,
  Layers,
  GraduationCap,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function LecturerDashboard() {
  const { user, isAllowed } = useRoleGuard("lecturer");
  const [, setLocation] = useLocation();

  const { data: stats, isLoading } = trpc.lecturer.dashboardStats.useQuery(undefined, {
    enabled: isAllowed,
  });
  const { data: engagement } = trpc.lecturer.analytics.engagement.useQuery(undefined, {
    enabled: isAllowed,
  });

  if (!isAllowed || !user) return null;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-indigo-700">
                <GraduationCap className="h-6 w-6" />
                <span className="text-sm font-semibold uppercase tracking-wide">Lecturer Portal</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                Welcome back, {user.name?.split(" ")[0] ?? "Professor"}
              </h1>
              <p className="text-muted-foreground max-w-xl">
                Manage courses, upload academic materials, and monitor student learning with AI-powered insights.
              </p>
            </div>
            <Button
              className="rounded-2xl bg-indigo-600 hover:bg-indigo-700"
              onClick={() => setLocation("/lecturer/courses")}
            >
              Manage courses
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <LecturerStatCard
            label="Courses"
            value={isLoading ? null : stats?.courseCount ?? 0}
            icon={<BookMarked className="h-5 w-5 text-white" />}
            accent="from-indigo-500 to-indigo-600"
          />
          <LecturerStatCard
            label="Enrolled students"
            value={isLoading ? null : stats?.studentCount ?? 0}
            icon={<Users className="h-5 w-5 text-white" />}
            accent="from-violet-500 to-violet-600"
          />
          <LecturerStatCard
            label="Materials"
            value={isLoading ? null : stats?.documentCount ?? 0}
            icon={<FileText className="h-5 w-5 text-white" />}
            accent="from-blue-500 to-blue-600"
          />
          <LecturerStatCard
            label="Assignments"
            value={isLoading ? null : stats?.assignmentCount ?? 0}
            icon={<ClipboardList className="h-5 w-5 text-white" />}
            accent="from-cyan-500 to-cyan-600"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <LecturerStatCard
            label="AI quizzes"
            value={isLoading ? null : stats?.quizCount ?? 0}
            icon={<Brain className="h-5 w-5 text-white" />}
            accent="from-purple-500 to-purple-600"
            description="Generated from your materials"
          />
          <LecturerStatCard
            label="Flashcard sets"
            value={isLoading ? null : stats?.flashcardCount ?? 0}
            icon={<Layers className="h-5 w-5 text-white" />}
            accent="from-fuchsia-500 to-fuchsia-600"
          />
          <LecturerStatCard
            label="Announcements"
            value={isLoading ? null : stats?.announcementCount ?? 0}
            icon={<Megaphone className="h-5 w-5 text-white" />}
            accent="from-rose-500 to-rose-600"
          />
        </div>

        <Card className="rounded-3xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Course engagement</CardTitle>
            <p className="text-sm text-muted-foreground">Average student activity score per course</p>
          </CardHeader>
          <CardContent className="h-[280px]">
            {engagement && engagement.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={engagement}>
                  <CartesianGrid strokeDasharray="4 6" vertical={false} />
                  <XAxis dataKey="courseTitle" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avgEngagement" fill="#4f46e5" radius={[8, 8, 0, 0]} name="Engagement" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                Create a course and enroll students to see engagement analytics.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="rounded-3xl cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/lecturer/courses")}>
            <CardContent className="p-6">
              <BookMarked className="h-8 w-8 text-indigo-600 mb-3" />
              <h3 className="font-semibold text-lg">Course management</h3>
              <p className="text-sm text-muted-foreground mt-1">Create subjects, upload notes, and share enrollment codes.</p>
            </CardContent>
          </Card>
          <Card className="rounded-3xl cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/lecturer/analytics")}>
            <CardContent className="p-6">
              <Brain className="h-8 w-8 text-indigo-600 mb-3" />
              <h3 className="font-semibold text-lg">Student performance</h3>
              <p className="text-sm text-muted-foreground mt-1">Track quiz scores, study time, and participation.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
