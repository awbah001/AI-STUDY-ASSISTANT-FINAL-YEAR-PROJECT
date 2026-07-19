import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Search, Ban, Trash2, ShieldCheck, UserPlus, GraduationCap, Eye, EyeOff } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const lecturerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  department: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
type LecturerForm = z.infer<typeof lecturerSchema>;

export default function AdminUsers() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const utils = trpc.useUtils();

  useEffect(() => {
    if (user && user.role !== "admin") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  const { data: analytics, isLoading, refetch } = trpc.admin.getAnalytics.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const form = useForm<LecturerForm>({
    resolver: zodResolver(lecturerSchema),
    defaultValues: { name: "", email: "", department: "", password: "" },
  });

  const createLecturer = trpc.admin.createLecturer.useMutation({
    onSuccess: (newUser) => {
      toast.success(`Lecturer account created for ${newUser.name}`);
      form.reset();
      refetch();
    },
    onError: (err) => toast.error(err.message || "Failed to create lecturer account"),
  });

  const banMutation = trpc.admin.toggleUserBan.useMutation({
    onSuccess: () => refetch(),
  });

  const deleteMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: () => refetch(),
  });

  if (!user || user.role !== "admin") return null;

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
          <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Users className="h-6 w-6 text-emerald-600" />
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  User Management
                </h2>
              </div>
              <p className="max-w-xl text-sm text-muted-foreground">
                Register lecturer accounts and manage all platform users.
              </p>
            </div>
          </div>
        </div>

        {/* Register Lecturer */}
        <Card className="rounded-3xl border-indigo-100 shadow-sm">
          <CardHeader className="border-b border-indigo-50 bg-gradient-to-r from-indigo-50/60 to-transparent pb-4 rounded-t-3xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Register Lecturer</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Create a lecturer account. Share the credentials with the lecturer to log in.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <form
              onSubmit={form.handleSubmit((values) => createLecturer.mutate(values))}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              <div className="space-y-1.5">
                <Label htmlFor="lec-name">Full name</Label>
                <Input
                  id="lec-name"
                  placeholder="Dr. John Smith"
                  className="rounded-2xl"
                  {...form.register("name")}
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lec-email">Email address</Label>
                <Input
                  id="lec-email"
                  type="email"
                  placeholder="lecturer@university.edu"
                  className="rounded-2xl"
                  {...form.register("email")}
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lec-dept">Department <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  id="lec-dept"
                  placeholder="e.g. Computer Science"
                  className="rounded-2xl"
                  {...form.register("department")}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lec-pass">Password</Label>
                <div className="relative">
                  <Input
                    id="lec-pass"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    className="rounded-2xl pr-10"
                    {...form.register("password")}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-700"
                    onClick={() => setShowPassword(v => !v)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {form.formState.errors.password && (
                  <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                  disabled={createLecturer.isPending}
                >
                  <UserPlus className="h-4 w-4" />
                  {createLecturer.isPending ? "Creating account..." : "Create lecturer account"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Search */}
        <Card className="rounded-3xl border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-200/80 px-6 py-5">
            <CardTitle className="text-lg">Find Users</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-2xl border-slate-200"
              />
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-slate-200/80 px-6 py-5">
            <CardTitle className="text-lg">All Users ({allUsers.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/50">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">User</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Email</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Role</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Engagement</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-slate-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-200/80">
                        <td className="px-6 py-4"><Skeleton className="h-5 w-24" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-5 w-32" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-5 w-16" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-5 w-20" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-9 w-20" /></td>
                      </tr>
                    ))
                  ) : filteredUsers.length > 0 ? (
                    filteredUsers.map((u: any) => (
                      <tr key={u.userId} className="border-b border-slate-200/80 hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-sm font-semibold">
                              {u.userInitials || "U"}
                            </div>
                            <span className="font-semibold text-slate-900">{u.userName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600">{u.userEmail}</td>
                        <td className="px-6 py-4">
                          <RoleBadge role={(u as any).role} />
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-900">{u.engagementScore?.toLocaleString() || "0"}</td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className={`rounded-2xl text-xs ${u.isBanned ? "text-emerald-600 border-emerald-200 bg-emerald-50" : "text-amber-600 border-amber-200 bg-amber-50"}`}
                              onClick={() => banMutation.mutate({ userId: u.userId })}
                              disabled={banMutation.isPending}
                            >
                              {u.isBanned ? <ShieldCheck className="h-3 w-3 mr-1" /> : <Ban className="h-3 w-3 mr-1" />}
                              {u.isBanned ? "Unban" : "Ban"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-2xl text-xs text-red-600 border-red-200 bg-red-50 hover:bg-red-100"
                              onClick={() => {
                                if (confirm(`Delete ${u.userName}? This is permanent.`)) {
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
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
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

function RoleBadge({ role }: { role?: string }) {
  if (role === "admin") return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
      Admin
    </span>
  );
  if (role === "lecturer") return (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
      Lecturer
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
      Student
    </span>
  );
}
