import DashboardLayout from "@/components/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, LoadingState } from "@/components/QueryState";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { trpc } from "@/lib/trpc";
import { StaffWelcomeBanner } from "@/components/StaffWelcomeBanner";
import { DashboardHeading, DashboardShortcuts } from "@/components/DashboardOverview";
import {
  BookMarked, Users, FileText, ClipboardList,
  Megaphone, Brain, Layers,
  TrendingUp,
} from "lucide-react";
import { useLocation } from "wouter";
import { EngagementChart, ENGAGEMENT_HINT } from "@/components/lecturer/EngagementChart";

export default function LecturerDashboard() {
  const { user, isAllowed } = useRoleGuard("lecturer");
  const [, setLocation] = useLocation();

  const statsQuery = trpc.lecturer.dashboardStats.useQuery(undefined, { enabled: isAllowed });
  const engagementQuery = trpc.lecturer.analytics.engagement.useQuery(undefined, { enabled: isAllowed });
  const { data: stats, isLoading } = statsQuery;
  const { data: engagement } = engagementQuery;
  const metricValue = (value: number | undefined) => isLoading || statsQuery.isError ? null : value ?? 0;

  if (!isAllowed || !user) return null;

  const firstName = user.name?.split(" ")[0] ?? "Professor";

  return (
    <DashboardLayout>
      <div className="lecturer-dashboard w-full space-y-6">

        <StaffWelcomeBanner
          name={firstName}
          body="Manage your courses, upload academic materials, and monitor student learning with AI-powered insights."
          actionLabel="Manage courses"
          onAction={() => setLocation("/lecturer/courses")}
        />

        <DashboardHeading title="Your teaching at a glance" description="A clear view of your courses, students, and learning resources." />

        {/* ── Stats row 1 ── */}
        {statsQuery.error && <ErrorState message={statsQuery.error.message} onRetry={() => statsQuery.refetch()} />}
        <div className="dashboard-stat-grid" aria-busy={isLoading}>
          <StatCard label="Courses" value={metricValue(stats?.courseCount)} icon={<BookMarked />} loading={isLoading} />
          <StatCard label="Students" value={metricValue(stats?.studentCount)} icon={<Users />} loading={isLoading} />
          <StatCard label="Materials" value={metricValue(stats?.documentCount)} icon={<FileText />} loading={isLoading} />
          <StatCard label="Assignments" value={metricValue(stats?.assignmentCount)} icon={<ClipboardList />} loading={isLoading} />
        </div>

        {/* ── Stats row 2 ── */}
        <div className="dashboard-stat-grid dashboard-stat-grid--three" aria-busy={isLoading}>
          <StatCard label="AI quizzes" value={metricValue(stats?.quizCount)} icon={<Brain />} loading={isLoading} />
          <StatCard label="Flashcard sets" value={metricValue(stats?.flashcardCount)} icon={<Layers />} loading={isLoading} />
          <StatCard label="Announcements" value={metricValue(stats?.announcementCount)} icon={<Megaphone />} loading={isLoading} />
        </div>

        {/* ── Engagement chart ── */}
        <div className="dashboard-panel overflow-hidden rounded-2xl border shadow-sm">
          <div className="flex items-center gap-3 border-b border-emerald-100/70 px-6 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
              <TrendingUp className="h-4 w-4 text-emerald-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Course Engagement</p>
              <p className="text-xs text-slate-500">{ENGAGEMENT_HINT}</p>
            </div>
          </div>
          <div className="min-h-[260px] p-4 sm:p-6">
            {engagementQuery.isLoading ? <LoadingState label="Loading course engagement" /> : engagementQuery.error ? <ErrorState message={engagementQuery.error.message} onRetry={() => engagementQuery.refetch()} /> : engagement && engagement.length > 0 ? (
              <div className="h-[220px]" role="region" aria-label="Average engagement points by course">
              <EngagementChart data={engagement} color="#047857" />
              </div>
            ) : (
              <EmptyState action={<button type="button" onClick={() => setLocation("/lecturer/courses")} className="web-button font-semibold text-emerald-700 underline underline-offset-4">Manage courses</button>}>Create a course and enroll students to see engagement analytics.</EmptyState>
            )}
          </div>
        </div>

        {/* ── Quick nav cards ── */}
        <DashboardShortcuts items={[
          { title: "Course management", description: "Materials, subjects, and enrollment", href: "/lecturer/courses", icon: BookMarked },
          { title: "Student performance", description: "Quiz scores and participation", href: "/lecturer/analytics", icon: Brain },
          { title: "Progress reports", description: "Individual learning insights", href: "/lecturer/reports", icon: ClipboardList },
        ]} />
      </div>
    </DashboardLayout>
  );
}
function StatCard({ label, value, icon, loading }: {
  label: string; value: number | null; icon: React.ReactNode; loading: boolean;
}) {
  return (
    <div className="dashboard-metric overflow-hidden rounded-2xl border shadow-sm">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            {loading
              ? <Skeleton className="mt-2 h-8 w-14 rounded-lg" />
              : <p className="mt-1 text-3xl font-bold tabular-nums text-foreground" aria-label={value === null ? "Unavailable" : undefined}>{value === null ? "—" : value.toLocaleString()}</p>
            }
          </div>
          <div className="dashboard-metric-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
}
