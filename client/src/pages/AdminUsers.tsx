import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Search, ShieldAlert, Ban, Trash2, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";

export default function AdminUsers() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (user && user.role !== "admin") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  const { data: analytics, isLoading, refetch } = trpc.admin.getAnalytics.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const banMutation = trpc.admin.toggleUserBan.useMutation({
    onSuccess: () => refetch(),
  });

  const deleteMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: () => refetch(),
  });

  if (!user || user.role !== "admin") {
    return null;
  }

  const allUsers = analytics?.allUsers || [];
  const filteredUsers = allUsers.filter(u =>
    (u.userName?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
    (u.userEmail?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150 fill-mode-both">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl border border-emerald-100/80 bg-gradient-to-br from-emerald-50/90 via-white to-white p-6 shadow-sm shadow-emerald-900/5 dark:border-emerald-900/40 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 sm:p-8">
          <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-500/10" />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Users className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
                  System Users
                </h2>
              </div>
              <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
                View and manage all users registered in the system.
              </p>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="border-b border-slate-200/80 px-6 py-5 dark:border-slate-700/70">
            <CardTitle className="text-lg">Find Users</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-2xl border-slate-200 dark:border-slate-700"
              />
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-slate-200/80 px-6 py-5 dark:border-slate-700/70">
            <CardTitle className="text-lg">All Users ({allUsers.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-700/70 bg-slate-50/50 dark:bg-slate-900/30">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-slate-100">User</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-slate-100">Email</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-slate-100">Engagement Score</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-slate-100">Quizzes Attempted</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-200/80 dark:border-slate-700/70">
                        <td className="px-6 py-4"><Skeleton className="h-5 w-24" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-5 w-32" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-5 w-20" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-5 w-16" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-9 w-20" /></td>
                      </tr>
                    ))
                  ) : filteredUsers.length > 0 ? (
                    filteredUsers.map((u: any) => (
                      <tr key={u.userId} className="border-b border-slate-200/80 dark:border-slate-700/70 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-sm font-semibold">
                              {u.userInitials || "U"}
                            </div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{u.userName}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{u.userEmail}</td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{u.engagementScore?.toLocaleString() || "0"}</span>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{u.quizzesAttempted || 0}</td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className={`rounded-2xl text-xs ${u.isBanned ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-amber-600 border-amber-200 bg-amber-50'}`}
                              onClick={() => banMutation.mutate({ userId: u.userId })}
                              disabled={banMutation.isPending}
                            >
                              {u.isBanned ? <ShieldCheck className="h-3 w-3 mr-1" /> : <Ban className="h-3 w-3 mr-1" />}
                              {u.isBanned ? 'Unban' : 'Ban'}
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="rounded-2xl text-xs text-red-600 border-red-200 bg-red-50 hover:bg-red-100"
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete ${u.userName}? This action is permanent.`)) {
                                  deleteMutation.mutate({ userId: u.userId });
                                }
                              }}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                        {searchQuery ? "No users found matching your search" : "No users in the system"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
