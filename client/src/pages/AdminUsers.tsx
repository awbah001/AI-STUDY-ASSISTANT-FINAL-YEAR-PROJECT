import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  Search,
  Ban,
  Trash2,
  ShieldCheck,
  UserPlus,
  MoreVertical,
  Download,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
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

const PAGE_SIZE = 10;

export default function AdminUsers() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (user && user.role !== "admin") setLocation("/dashboard");
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
      setDialogOpen(false);
      refetch();
    },
    onError: (err) => toast.error(err.message || "Failed to create lecturer account"),
  });

  const banMutation = trpc.admin.toggleUserBan.useMutation({ onSuccess: () => refetch() });
  const deleteMutation = trpc.admin.deleteUser.useMutation({ onSuccess: () => refetch() });

  if (!user || user.role !== "admin") return null;

  const allUsers = analytics?.allUsers || [];
  const filtered = allUsers.filter((u) =>
    (u.userName?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
    (u.userEmail?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageUsers = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">

        {/* ── Page header ── */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white px-8 py-6 shadow-sm">
          {/* decorative right illustration */}
          <div className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 hidden sm:flex items-end gap-3 opacity-30">
            <div className="h-10 w-10 rounded-full bg-slate-300" />
            <div className="relative h-14 w-14 rounded-full bg-emerald-400 ring-4 ring-white">
              <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
                <ShieldCheck className="h-3 w-3 text-white" />
              </div>
            </div>
            <div className="h-10 w-10 rounded-full bg-slate-200" />
          </div>

          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-emerald-600">
            System Users
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">System Users</h1>
          <p className="mt-1 text-sm text-slate-500">
            View and manage all users registered in the system.
          </p>
        </div>

        {/* ── Find Users ── */}
        <div className="rounded-2xl border border-slate-100 bg-white px-6 py-5 shadow-sm">
          <div className="mb-1 flex items-center gap-2">
            <Search className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold text-slate-800">Find Users</span>
          </div>
          <p className="mb-4 text-xs text-slate-500">Search for users by name or email address.</p>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="h-10 rounded-xl border-slate-200 pl-9 text-sm focus-visible:ring-emerald-500"
              />
            </div>
            <Button variant="outline" className="h-10 gap-2 rounded-xl border-slate-200 px-4 text-sm font-medium">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </Button>
          </div>
        </div>

        {/* ── All Users table ── */}
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          {/* table header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              <span className="font-semibold text-slate-800">
                All Users ({filtered.length})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2 rounded-xl border-slate-200 px-4 text-sm font-medium"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>

              {/* Add User dialog */}
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="h-9 gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 shadow-sm"
                  >
                    <UserPlus className="h-4 w-4" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Register Lecturer</DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={form.handleSubmit((v) => createLecturer.mutate(v))}
                    className="space-y-4 pt-2"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="lec-name">Full name</Label>
                      <Input id="lec-name" placeholder="Dr. John Smith" className="rounded-xl" {...form.register("name")} />
                      {form.formState.errors.name && (
                        <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lec-email">Email</Label>
                      <Input id="lec-email" type="email" placeholder="lecturer@university.edu" className="rounded-xl" {...form.register("email")} />
                      {form.formState.errors.email && (
                        <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lec-dept">Department <span className="text-muted-foreground text-xs">(optional)</span></Label>
                      <Input id="lec-dept" placeholder="e.g. Computer Science" className="rounded-xl" {...form.register("department")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lec-pass">Password</Label>
                      <div className="relative">
                        <Input
                          id="lec-pass"
                          type={showPassword ? "text" : "password"}
                          placeholder="Min. 8 characters"
                          className="rounded-xl pr-10"
                          {...form.register("password")}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {form.formState.errors.password && (
                        <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                      )}
                    </div>
                    <Button
                      type="submit"
                      className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                      disabled={createLecturer.isPending}
                    >
                      {createLecturer.isPending ? "Creating…" : "Create Lecturer Account"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-6 py-3 text-left font-semibold text-slate-500">
                    <span className="flex items-center gap-1">User <ChevronRight className="h-3 w-3 rotate-90" /></span>
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-500">
                    <span className="flex items-center gap-1">Email <ChevronRight className="h-3 w-3 rotate-90" /></span>
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-500">
                    <span className="flex items-center gap-1">Engagement Score <ChevronRight className="h-3 w-3 rotate-90" /></span>
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-500">
                    <span className="flex items-center gap-1">Quizzes Attempted <ChevronRight className="h-3 w-3 rotate-90" /></span>
                  </th>
                  <th className="px-6 py-3 text-center font-semibold text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      <td className="px-6 py-4"><Skeleton className="h-5 w-32" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-5 w-40" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-6 w-10 rounded-full" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-5 w-8" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-8 w-8 rounded-full mx-auto" /></td>
                    </tr>
                  ))
                ) : pageUsers.length > 0 ? (
                  pageUsers.map((u: any) => (
                    <tr key={u.userId} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      {/* User */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                            {u.userInitials || "U"}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{u.userName}</p>
                            <RoleBadge role={u.role} />
                          </div>
                        </div>
                      </td>
                      {/* Email */}
                      <td className="px-6 py-4 text-slate-600">{u.userEmail}</td>
                      {/* Engagement score */}
                      <td className="px-6 py-4">
                        <span className="inline-flex h-7 min-w-[2rem] items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700">
                          {u.engagementScore ?? 0}
                        </span>
                      </td>
                      {/* Quizzes */}
                      <td className="px-6 py-4 text-slate-600">{u.quizzesAttempted ?? 0}</td>
                      {/* Actions — 3-dot dropdown */}
                      <td className="px-6 py-4 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="mx-auto flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
                              <MoreVertical className="h-4 w-4 text-slate-500" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-lg">
                            <DropdownMenuItem
                              className="gap-2 text-amber-600 focus:text-amber-700 focus:bg-amber-50 cursor-pointer"
                              onClick={() => banMutation.mutate({ userId: u.userId })}
                            >
                              {u.isBanned
                                ? <><ShieldCheck className="h-4 w-4" /> Unban User</>
                                : <><Ban className="h-4 w-4" /> Ban User</>}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2 text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                              onClick={() => {
                                if (confirm(`Delete ${u.userName}? This is permanent.`)) {
                                  deleteMutation.mutate({ userId: u.userId });
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" /> Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      {searchQuery ? "No users match your search." : "No users in the system."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination footer ── */}
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3">
            <p className="text-xs text-slate-500">
              Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} results
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                    p === page
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function RoleBadge({ role }: { role?: string }) {
  if (role === "admin")
    return (
      <span className="mt-0.5 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
        Administrator
      </span>
    );
  if (role === "lecturer")
    return (
      <span className="mt-0.5 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">
        Lecturer
      </span>
    );
  return (
    <span className="mt-0.5 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
      Student
    </span>
  );
}
