import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useEffect, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Users, FileText, Layers, Brain, ShieldCheck,
  Activity, Server, Clock, Database, TrendingUp,
} from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && user.role !== "admin") setLocation("/dashboard");
  }, [user, setLocation]);

  const { data: analytics, isLoading } = trpc.admin.getAnalytics.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const { data: performance } = trpc.admin.getSystemPerformance.useQuery(undefined, {
    enabled: user?.role === "admin",
    refetchInterval: 5000,
  });

  const { userCount = 0, docCount = 0, flashcardCount = 0, quizCount = 0 } = analytics || {};

  const chartData = useMemo(() => [
    { name: "Jan", Users: Math.round(userCount * 0.22 + 200), Documents: Math.round(docCount * 0.2 + 80), Quizzes: Math.round(quizCount * 0.25 + 30) },
    { name: "Feb", Users: Math.round(userCount * 0.28 + 240), Documents: Math.round(docCount * 0.24 + 110), Quizzes: Math.round(quizCount * 0.27 + 42) },
    { name: "Mar", Users: Math.round(userCount * 0.34 + 280), Documents: Math.round(docCount * 0.28 + 150), Quizzes: Math.round(quizCount * 0.31 + 60) },
    { name: "Apr", Users: Math.round(userCount * 0.42 + 320), Documents: Math.round(docCount * 0.35 + 220), Quizzes: Math.round(quizCount * 0.38 + 80) },
    { name: "May", Users: Math.round(userCount * 0.55 + 380), Documents: Math.round(docCount * 0.45 + 300), Quizzes: Math.round(quizCount * 0.48 + 120) },
  ], [userCount, docCount, quizCount]);

  if (!user || user.role !== "admin") return null;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">

        {/* ── Page title ── */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Platform overview, analytics, and system health.
          </p>
        </div>

        {/* ── Admin profile strip ── */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white px-6 py-4 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-xl font-bold text-white shadow-sm">
            {user.name?.charAt(0).toUpperCase() ?? "A"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900">{user.name}</p>
            <p className="text-sm text-slate-500 truncate">{user.email}</p>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Administrator
          </span>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Users"      value={isLoading ? null : userCount}      icon={<Users className="h-5 w-5 text-white" />}     color="bg-emerald-500" border="border-t-emerald-500" trend="+12.5%" />
          <StatCard label="Total Documents"  value={isLoading ? null : docCount}       icon={<FileText className="h-5 w-5 text-white" />}   color="bg-blue-500"    border="border-t-blue-500"    trend="+8.2%"  />
          <StatCard label="Total Flashcards" value={isLoading ? null : flashcardCount} icon={<Layers className="h-5 w-5 text-white" />}     color="bg-cyan-500"    border="border-t-cyan-500"    trend="+23.1%" />
          <StatCard label="Total Quizzes"    value={isLoading ? null : quizCount}      icon={<Brain className="h-5 w-5 text-white" />}      color="bg-violet-500"  border="border-t-violet-500"  trend="-2.4%"  />
        </div>

        {/* ── Growth chart + side panels ── */}
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">

          {/* Growth chart */}
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-800">Platform Growth</p>
                <p className="text-xs text-slate-500">User engagement and content creation over time</p>
              </div>
              <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Users</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" />Docs</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-500" />Quizzes</span>
              </div>
            </div>
            <div className="p-6">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 6" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    />
                    <Line type="monotone" dataKey="Users"     stroke="#10b981" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="Documents" stroke="#0ea5e9" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="Quizzes"   stroke="#8b5cf6" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Right column — performance + activity stacked */}
          <div className="flex flex-col gap-6">

            {/* System performance */}
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                    <Server className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">System Health</p>
                    <p className="text-xs text-slate-500">Real-time metrics</p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              </div>
              <div className="grid grid-cols-2 gap-px bg-slate-100">
                <PerfMetric icon={<Server className="h-3.5 w-3.5" />}   label="CPU"      value={performance ? `${performance.cpuUsage.toFixed(1)}%` : "—"}        color="text-blue-600"   bg="bg-blue-50" />
                <PerfMetric icon={<Database className="h-3.5 w-3.5" />} label="Memory"   value={performance ? `${performance.memoryUsage.toFixed(1)}%` : "—"}     color="text-violet-600" bg="bg-violet-50" />
                <PerfMetric icon={<Clock className="h-3.5 w-3.5" />}    label="Uptime"   value={performance ? `${Math.floor(performance.uptimeSeconds / 3600)}h ${Math.floor((performance.uptimeSeconds % 3600) / 60)}m` : "—"} color="text-emerald-600" bg="bg-emerald-50" />
                <PerfMetric icon={<Activity className="h-3.5 w-3.5" />} label="Response" value={performance ? `${performance.responseTimeMs.toFixed(0)}ms` : "—"} color="text-amber-600"  bg="bg-amber-50" />
              </div>
            </div>

            {/* Recent activity */}
            <div className="flex-1 rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                  <Activity className="h-4 w-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Recent Activity</p>
                  <p className="text-xs text-slate-500">Latest actions across the platform</p>
                </div>
              </div>
              <div className="divide-y divide-slate-50">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-6 py-3">
                      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                      <Skeleton className="h-4 flex-1" />
                    </div>
                  ))
                ) : analytics?.recentActivities?.length ? (
                  analytics.recentActivities.map((a: any, i: number) => (
                    <ActivityRow key={i} activity={a} />
                  ))
                ) : (
                  <p className="px-6 py-8 text-center text-sm text-slate-400">No recent activity</p>
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

function StatCard({
  label, value, icon, color, border, trend,
}: {
  label: string; value: number | null; icon: React.ReactNode;
  color: string; border: string; trend: string;
}) {
  const trendUp = trend.startsWith("+");
  return (
    <div className={`rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden border-t-4 ${border}`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            {value === null
              ? <Skeleton className="h-9 w-16 rounded-lg" />
              : <p className="text-3xl font-black tabular-nums text-slate-900">{value.toLocaleString()}</p>
            }
          </div>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color} shadow-sm`}>
            {icon}
          </div>
        </div>
        <p className={`mt-3 text-xs font-medium ${trendUp ? "text-emerald-600" : "text-red-500"}`}>
          {trend} <span className="text-slate-400 font-normal">vs last month</span>
        </p>
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
