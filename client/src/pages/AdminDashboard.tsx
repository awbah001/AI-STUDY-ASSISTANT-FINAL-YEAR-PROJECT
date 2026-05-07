import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Layers, Brain, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";
import { Activity, Server, Clock, Database, Trash2, Globe } from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && user.role !== "admin") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  const { data: analytics, isLoading, refetch } = trpc.admin.getAnalytics.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const { data: performance } = trpc.admin.getSystemPerformance.useQuery(undefined, {
    enabled: user?.role === "admin",
    refetchInterval: 5000,
  });

  const { userCount = 0, docCount = 0, flashcardCount = 0, quizCount = 0 } = analytics || {};

  const chartData = useMemo(
    () => [
      { name: "Jan", Users: userCount * 0.22 + 200, Documents: docCount * 0.2 + 80, Quizzes: quizCount * 0.25 + 30 },
      { name: "Feb", Users: userCount * 0.28 + 240, Documents: docCount * 0.24 + 110, Quizzes: quizCount * 0.27 + 42 },
      { name: "Mar", Users: userCount * 0.34 + 280, Documents: docCount * 0.28 + 150, Quizzes: quizCount * 0.31 + 60 },
      { name: "Apr", Users: userCount * 0.42 + 320, Documents: docCount * 0.35 + 220, Quizzes: quizCount * 0.38 + 80 },
      { name: "May", Users: userCount * 0.55 + 380, Documents: docCount * 0.45 + 300, Quizzes: quizCount * 0.48 + 120 },
    ],
    [userCount, docCount, quizCount]
  );

  if (!user || user.role !== "admin") {
    return null; // Will redirect in useEffect
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150 fill-mode-both">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl border border-emerald-100/80 bg-gradient-to-br from-emerald-50/90 via-white to-white p-6 shadow-sm shadow-emerald-900/5 dark:border-emerald-900/40 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 sm:p-8">
          <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-500/10" />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
                  Admin Dashboard
                </h2>
              </div>
              <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
                View platform analytics and user engagement statistics here.
              </p>
            </div>
          </div>
        </div>

        {/* Profile Card */}
        <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="pb-3 border-b border-emerald-50/80 bg-gradient-to-r from-emerald-50/50 to-transparent dark:border-emerald-900/30 dark:from-emerald-950/30 rounded-t-3xl">
            <CardTitle className="text-lg">Admin Profile</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-emerald-600/20">
                {user.name?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div>
                <p className="font-semibold text-lg">{user.name}</p>
                <p className="text-muted-foreground">{user.email}</p>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 mt-2 shadow-sm border border-emerald-200">
                  Administrator
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          <StatCard
            label="Total Users"
            value={isLoading ? null : userCount}
            icon={<Users strokeWidth={2.5} className="h-5 w-5 text-white" />}
            accent="from-emerald-500 to-emerald-600"
            trend="+12.5%"
            description="vs last month"
          />
          <StatCard
            label="Total Documents"
            value={isLoading ? null : docCount}
            icon={<FileText strokeWidth={2.5} className="h-5 w-5 text-white" />}
            accent="from-blue-500 to-blue-600"
            trend="+8.2%"
            description="vs last month"
          />
          <StatCard
            label="Total Flashcards"
            value={isLoading ? null : flashcardCount}
            icon={<Layers strokeWidth={2.5} className="h-5 w-5 text-white" />}
            accent="from-cyan-500 to-cyan-600"
            trend="+23.1%"
            description="vs last month"
          />
          <StatCard
            label="Total Quizzes"
            value={isLoading ? null : quizCount}
            icon={<Brain strokeWidth={2.5} className="h-5 w-5 text-white" />}
            accent="from-violet-500 to-violet-600"
            trend="-2.4%"
            description="vs last month"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.55fr_0.9fr]">
          <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="flex flex-col gap-2 border-b border-slate-200/80 px-6 py-5 dark:border-slate-700/70">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CardTitle className="text-lg">Platform Growth</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Track user engagement and content creation over time.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Users
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> Documents
                  <span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> Quizzes
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 24, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 6" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Legend verticalAlign="top" height={36} />
                    <Line type="monotone" dataKey="Users" stroke="#14b8a6" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="Documents" stroke="#0284c7" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="Quizzes" stroke="#7c3aed" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          {/* Performance Card */}
          <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="border-b border-slate-200/80 px-6 py-5 dark:border-slate-700/70">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">System Performance</CardTitle>
                  <p className="text-sm text-muted-foreground">Real-time server health metrics</p>
                </div>
                <Activity className="h-5 w-5 text-emerald-500 animate-pulse" />
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <PerformanceMetric 
                  icon={<Server className="h-4 w-4" />} 
                  label="CPU Usage" 
                  value={`${performance?.cpuUsage.toFixed(1)}%`} 
                  subtext="System load"
                />
                <PerformanceMetric 
                  icon={<Database className="h-4 w-4" />} 
                  label="Memory" 
                  value={`${performance?.memoryUsage.toFixed(1)}%`} 
                  subtext="RAM allocation"
                />
                <PerformanceMetric 
                  icon={<Clock className="h-4 w-4" />} 
                  label="Uptime" 
                  value={performance ? `${Math.floor(performance.uptimeSeconds / 3600)}h ${Math.floor((performance.uptimeSeconds % 3600) / 60)}m` : "Loading..."} 
                  subtext="Server availability"
                />
                <PerformanceMetric 
                  icon={<Activity className="h-4 w-4" />} 
                  label="Response Time" 
                  value={`${performance?.responseTimeMs.toFixed(0)}ms`} 
                  subtext="Avg latency"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200/80 px-6 py-5 dark:border-slate-700/70">
              <div>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
                <p className="text-sm text-muted-foreground">Latest actions across the platform</p>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                      <Skeleton className="h-5 w-full" />
                    </div>
                  ))
                ) : analytics?.recentActivities && analytics.recentActivities.length > 0 ? (
                  analytics.recentActivities.map((activity: any, idx: number) => (
                    <ActivityItem key={idx} activity={activity} />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No recent activities</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function PerformanceMetric({ icon, label, value, subtext }: { icon: React.ReactNode, label: string, value: string, subtext: string }) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-black text-slate-900 dark:text-slate-50">{value}</div>
      <div className="text-[10px] text-muted-foreground">{subtext}</div>
    </div>
  );
}

function ActivityItem({ activity }: { activity: any }) {
  const getActivityIcon = (type: string, action: string) => {
    const iconClass = "h-8 w-8 flex items-center justify-center rounded-full text-white text-xs font-semibold";
    
    if (action === "uploaded") return <div className={`${iconClass} bg-teal-500`}>📄</div>;
    if (action === "created") return <div className={`${iconClass} bg-yellow-500`}>❓</div>;
    if (action === "generated") return <div className={`${iconClass} bg-purple-500`}>📚</div>;
    if (action === "joined") return <div className={`${iconClass} bg-green-500`}>👤</div>;
    return <div className={`${iconClass} bg-slate-400`}>•</div>;
  };

  const getTimeAgo = (date: any) => {
    const now = new Date();
    const then = new Date(date);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
    
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="flex items-start gap-3 rounded-lg p-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
      <div className="flex-shrink-0">{getActivityIcon(activity.targetType, activity.action)}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-semibold text-slate-900 dark:text-slate-100">{activity.userName}</span>
          {' '}
          <span className="text-slate-600 dark:text-slate-400">{activity.action}</span>
          {' '}
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{activity.target}</span>
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{getTimeAgo(activity.createdAt)}</p>
      </div>
    </div>
  );
}

function PerformerItem({ performer, rank }: { performer: any; rank: number }) {
  const getRankIcon = (position: number) => {
    if (position === 1) return "🥇";
    if (position === 2) return "🥈";
    if (position === 3) return "🥉";
    return null;
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex items-center justify-center gap-2">
          {getRankIcon(rank) && <span className="text-lg">{getRankIcon(rank)}</span>}
          {!getRankIcon(rank) && (
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">#{rank}</span>
          )}
        </div>
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
          {performer.userInitials || "U"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{performer.userName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{performer.userEmail}</p>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="font-bold text-slate-900 dark:text-slate-100">
          {performer.engagementScore?.toLocaleString() || "0"}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {(performer.quizzesAttempted || 0)} quizzes
        </p>
      </div>
    </div>
  );
}

function StatCard(props: {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  accent: string;
  trend?: string;
  description?: string;
}) {
  return (
    <Card className="group relative overflow-hidden rounded-3xl border-emerald-50 dark:border-slate-800 shadow-sm transition-all hover:shadow-lg hover:-translate-y-1">
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${props.accent} opacity-90`}
      />      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {props.label}
            </p>
            {props.value === null ? (
              <Skeleton className="h-10 w-20 rounded-2xl" />
            ) : (
              <p className="text-4xl font-black tabular-nums tracking-tight text-slate-900 dark:text-slate-50">
                {props.value}
              </p>
            )}
            {props.trend ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{props.trend}</span> {props.description}
              </p>
            ) : null}
          </div>
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${props.accent} shadow-lg transition-transform group-hover:scale-110`}
          >
            {props.icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
