import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { StaffWelcomeBanner } from "@/components/StaffWelcomeBanner";
import { DashboardHeading, DashboardShortcuts } from "@/components/DashboardOverview";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, LoadingState } from "@/components/QueryState";
import { useReducedMotion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Users, Layers, Brain,
  Activity, Server, Clock, Database, TrendingUp,
} from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && user.role !== "admin") setLocation("/login");
  }, [user, setLocation]);

  const reducedMotion = useReducedMotion();
  const metricsQuery = trpc.admin.getDashboardMetrics.useQuery({ days: 30 }, {
    enabled: user?.role === "admin",
  });
  const { data: metrics, isLoading } = metricsQuery;
  // Kept undefined until a dedicated top-performers endpoint is introduced.
  const analytics = {} as { topPerformers?: any[] };

  const performanceQuery = trpc.admin.getSystemPerformance.useQuery(undefined, {
    enabled: user?.role === "admin",
    refetchInterval: 5000,
  });

  const { data: performance } = performanceQuery;
  const chartData = (metrics?.series ?? []).map((point) => ({ name: point.date, Signups: point.signUps, Uploads: point.uploads, Active: point.activeLearners }));
  const metricValue = (value: number | undefined) => isLoading || metricsQuery.isError ? null : value ?? 0;

  if (!user || user.role !== "admin") return null;

  return (
    <DashboardLayout>
      <div className="admin-dashboard w-full min-w-0 space-y-4">

        <StaffWelcomeBanner
          name={user.name?.split(" ")[0] ?? "Admin"}
          body="Oversee users, moderate content, and keep the platform running with live platform health and academic insights."
          actionLabel="Manage users"
          onAction={() => setLocation("/admin/users")}
        />

        <DashboardHeading title="Your platform at a glance" description="People, learning activity, and the health of your workspace." />

        {/* ── Stat cards ── */}
        {metricsQuery.error && <ErrorState message={metricsQuery.error.message} onRetry={() => metricsQuery.refetch()} />}
        <div className="admin-dashboard-stats grid min-w-0 gap-4" aria-busy={isLoading}>
          <StatCard label="Total users" value={metricValue(metrics?.usersTotal)} icon={<Users />} hint="Registered accounts" loading={isLoading} />
          <StatCard label="Active learners" value={metricValue(metrics?.activeLearners)} icon={<Activity />} hint="Last 30 days" loading={isLoading} />
          <StatCard label="Quiz completion" value={metricValue(metrics?.quizCompletionRate)} suffix="%" icon={<Brain />} hint="Completed quizzes · all time" loading={isLoading} />
          <StatCard label="Failed jobs" value={metricValue(metrics?.failedJobs)} icon={<Layers />} hint={metrics ? `${metrics.queuedJobs} queued for processing` : "Processing queue"} loading={isLoading} />
        </div>

        <DashboardShortcuts items={[
          { title: "Manage people", description: "Accounts, roles, and access", href: "/admin/users", icon: Users },
          { title: "Academic structure", description: "Organize your institution", href: "/admin/academic", icon: Layers },
          { title: "Platform operations", description: "Review jobs and system activity", href: "/admin/operations", icon: Server },
        ]} />

        {/* ── Growth chart + side panels ── */}
        <div className="admin-dashboard-panels grid min-w-0 gap-4">

          {/* Growth chart */}
          <div className="dashboard-panel overflow-hidden rounded-2xl border shadow-sm">
            <div className="flex flex-wrap items-center gap-3 border-b border-emerald-100/70 px-4 py-4 sm:px-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                <TrendingUp className="h-4 w-4 text-emerald-700" />
              </div>
              <div className="min-w-0 flex-1 basis-40">
                <p className="text-sm font-semibold text-slate-800">Platform Growth</p>
                <p className="text-xs text-slate-500">Actual sign-ups, uploads, and active learners over the last 30 days</p>
              </div>
              <div className="flex basis-full flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="dashboard-chart-legend-primary h-2 w-2 rounded-full" />Sign-ups</span>
                <span className="flex items-center gap-1"><span className="dashboard-chart-legend-secondary h-2 w-2 rounded-full" />Uploads</span>
                <span className="flex items-center gap-1"><span className="dashboard-chart-legend-accent h-2 w-2 rounded-full" />Active learners</span>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <div className="h-[280px] min-w-0" role="region" aria-label="Daily sign-ups, uploads, and active learners over the last 30 days">
                {isLoading ? <LoadingState label="Loading platform growth" rows={4} /> : metricsQuery.isError ? <p className="p-6 text-sm text-muted-foreground">Growth data is unavailable. Use Try again above to reload.</p> : !chartData.some(point => point.Signups || point.Uploads || point.Active) ? <EmptyState>No platform activity in the last 30 days. New sign-ups and learning activity will appear here.</EmptyState> : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart accessibilityLayer data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 6" stroke="var(--ui-chart-grid)" vertical={false} />
                    <XAxis dataKey="name" tickFormatter={date => String(date).slice(5)} interval="preserveStartEnd" minTickGap={24} padding={{ left: 8, right: 12 }} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--secondary-text)" }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--secondary-text)" }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", boxShadow: "var(--ui-shadow)" }}
                    />
                    <Line name="Sign-ups" type="monotone" dataKey="Signups" stroke="var(--ui-chart-primary)" strokeWidth={2.5} dot={false} isAnimationActive={!reducedMotion} />
                    <Line name="Uploads" type="monotone" dataKey="Uploads" stroke="var(--ui-chart-secondary)" strokeDasharray="5 3" strokeWidth={2.5} dot={false} isAnimationActive={!reducedMotion} />
                    <Line name="Active learners" type="monotone" dataKey="Active" stroke="var(--ui-chart-accent)" strokeDasharray="2 3" strokeWidth={2.5} dot={false} isAnimationActive={!reducedMotion} />
                  </LineChart>
                </ResponsiveContainer>
                )}
              </div>
            </div>
            {!!chartData.length && !metricsQuery.isError && <details className="dashboard-chart-data">
              <summary>View chart data</summary>
              <div className="max-h-64 overflow-auto" tabIndex={0} role="region" aria-label="Platform growth data">
                <table className="w-full"><caption className="sr-only">Daily platform growth for the last 30 days</caption>
                  <thead><tr><th scope="col">Date</th><th scope="col">Sign-ups</th><th scope="col">Uploads</th><th scope="col">Active learners</th></tr></thead>
                  <tbody>{chartData.map(point => <tr key={point.name}><th scope="row">{point.name}</th><td>{point.Signups}</td><td>{point.Uploads}</td><td>{point.Active}</td></tr>)}</tbody>
                </table>
              </div>
            </details>}
          </div>

          {/* Right column — performance + activity stacked */}
          <div className="flex min-w-0 flex-col gap-4">

            {/* System performance */}
            <div className="dashboard-panel overflow-hidden rounded-2xl border shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-sky-100/70 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100">
                    <Server className="h-4 w-4 text-sky-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">System Health</p>
                    <p className="text-xs text-slate-500">Real-time metrics</p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                  <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${performanceQuery.isError ? "bg-slate-400" : "bg-emerald-500"}`} />
                  {performanceQuery.isError ? "Unavailable" : performance ? "Live" : "Loading"}
                </span>
              </div>
              {performanceQuery.error && <ErrorState message={performanceQuery.error.message} onRetry={() => performanceQuery.refetch()} />}
              <div className="grid grid-cols-2 gap-px bg-slate-100" aria-busy={performanceQuery.isLoading}>
                <PerfMetric icon={<Server className="h-3.5 w-3.5" />}   label="CPU"      value={performance ? `${performance.cpuUsage.toFixed(1)}%` : "—"}        color="text-blue-600"   bg="bg-blue-50" />
                <PerfMetric icon={<Database className="h-3.5 w-3.5" />} label="Memory"   value={performance ? `${performance.memoryUsage.toFixed(1)}%` : "—"}     color="text-violet-600" bg="bg-violet-50" />
                <PerfMetric icon={<Clock className="h-3.5 w-3.5" />}    label="Uptime"   value={performance ? `${Math.floor(performance.uptimeSeconds / 3600)}h ${Math.floor((performance.uptimeSeconds % 3600) / 60)}m` : "—"} color="text-emerald-600" bg="bg-emerald-50" />
                <PerfMetric icon={<Activity className="h-3.5 w-3.5" />} label="Response" value={performance ? `${performance.responseTimeMs.toFixed(0)}ms` : "—"} color="text-amber-600"  bg="bg-amber-50" />
              </div>
            </div>

            {/* Recent activity */}
            <div className="dashboard-panel flex-1 overflow-hidden rounded-2xl border shadow-sm">
              <div className="flex items-center gap-3 border-b border-violet-100/70 px-6 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
                  <Activity className="h-4 w-4 text-violet-700" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Recent Activity</p>
                  <p className="text-xs text-slate-500">Latest actions across the platform</p>
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-50" tabIndex={0} role="region" aria-label="Recent activity">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-6 py-3">
                      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                      <Skeleton className="h-4 flex-1" />
                    </div>
                  ))
                ) : metricsQuery.isError ? <p className="p-6 text-sm text-muted-foreground">Recent activity is unavailable.</p> : metrics?.recentEvents?.length ? (
                  metrics.recentEvents.map((a: any, i: number) => (
                    <ActivityRow key={i} activity={a} />
                  ))
                ) : (
                  <EmptyState>No recent activity. Platform events will appear here as people use the app.</EmptyState>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Top performers ── */}
        {analytics?.topPerformers && analytics.topPerformers.length > 0 && (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
                <Brain className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Top Performers</p>
                <p className="text-xs text-slate-500">Most engaged students on the platform</p>
              </div>
            </div>
            <div className="divide-y divide-slate-50">
              {analytics.topPerformers.map((p: any, i: number) => (
                <PerformerRow key={p.userId} performer={p} rank={i + 1} />
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, hint, suffix = "", loading }: {
  label: string; value: number | null; icon: React.ReactNode; hint: string; suffix?: string; loading: boolean;
}) {
  return (
    <div className="dashboard-metric overflow-hidden rounded-2xl border shadow-sm">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            {loading
              ? <Skeleton className="h-9 w-16 rounded-lg" />
              : <p className="text-3xl font-bold tabular-nums text-foreground" aria-label={value === null ? "Unavailable" : undefined}>{value === null ? "—" : `${value.toLocaleString()}${suffix}`}</p>
            }
          </div>
          <div className="dashboard-metric-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            {icon}
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

// ── System performance metric cell ────────────────────────────────────────────

function PerfMetric({
  icon, label, value, color, bg,
}: {
  icon: React.ReactNode; label: string; value: string; color: string; bg: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 bg-white p-4">
      <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${bg} ${color}`}>
        {icon}
      </div>
      <p className="text-lg font-bold text-slate-900">{value}</p>
      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
    </div>
  );
}

// ── Activity row ──────────────────────────────────────────────────────────────

const ACTION_STYLES: Record<string, { emoji: string; bg: string }> = {
  uploaded:  { emoji: "📄", bg: "bg-teal-100" },
  created:   { emoji: "❓", bg: "bg-yellow-100" },
  generated: { emoji: "📚", bg: "bg-purple-100" },
  joined:    { emoji: "👤", bg: "bg-green-100" },
};

function timeAgo(date: any) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function ActivityRow({ activity }: { activity: any }) {
  const style = ACTION_STYLES[activity.action] ?? { emoji: "•", bg: "bg-slate-100" };
  return (
    <div className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50 transition-colors">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base ${style.bg}`}>
        {style.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-700 truncate">
          <span className="font-semibold text-slate-900">{activity.userName}</span>
          {" "}{activity.action}{" "}
          <span className="font-medium text-emerald-600">{activity.target}</span>
        </p>
      </div>
      <span className="shrink-0 text-xs text-slate-400">{timeAgo(activity.createdAt)}</span>
    </div>
  );
}

// ── Top performer row ─────────────────────────────────────────────────────────

const RANK_ICON: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function PerformerRow({ performer, rank }: { performer: any; rank: number }) {
  return (
    <div className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors">
      <span className="w-6 text-center text-base shrink-0">
        {RANK_ICON[rank] ?? <span className="text-xs font-bold text-slate-400">#{rank}</span>}
      </span>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
        {performer.userInitials || "U"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 truncate">{performer.userName}</p>
        <p className="text-xs text-slate-500 truncate">{performer.userEmail}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-slate-900">{(performer.engagementScore ?? 0).toLocaleString()}</p>
        <p className="text-xs text-slate-400">{performer.quizzesAttempted ?? 0} quizzes</p>
      </div>
    </div>
  );
}
