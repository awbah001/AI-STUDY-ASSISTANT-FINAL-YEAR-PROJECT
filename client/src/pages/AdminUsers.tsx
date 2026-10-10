import { AdminHero } from "@/components/admin/AdminHero";
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
  Users,
  Search,
  Ban,
  Trash2,
  ShieldCheck,
  UserPlus,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  User,
  BarChart3,
  Filter,
  Pencil,
  CircleDot,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ALLOWED_EMAIL_DOMAIN } from "@shared/emailDomain";
import { validateEmail, validateNewPassword, validatePersonName } from "@shared/validation";
import { fromValidator, promptReason } from "@/lib/formValidation";
import { FieldError } from "@/components/FieldError";
import { PasswordRules } from "@/components/PasswordRules";

const createUserSchema = z.object({
  name: fromValidator(v => validatePersonName(v, "Full name")),
  email: fromValidator(v => validateEmail(v)),
  role: z.enum(["user", "lecturer"]),
  password: fromValidator(validateNewPassword),
});
type CreateUserForm = z.infer<typeof createUserSchema>;

const PAGE_SIZE = 10;

const AVATAR_TONES = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-pink-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-indigo-500",
] as const;

export default function AdminUsers() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleTab, setRoleTab] = useState<"user" | "lecturer">("user");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "banned">("all");
  const [showPassword, setShowPassword] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [viewUser, setViewUser] = useState<{
    userId: number;
    userName: string | null;
    userEmail: string | null;
    role: string;
    isBanned: boolean;
    engagementScore: number;
    quizzesAttempted: number;
  } | null>(null);

  useEffect(() => {
    if (user && user.role !== "admin") setLocation("/login");
  }, [user, setLocation]);

  const listInput = {
    page,
    pageSize: PAGE_SIZE,
    search: searchQuery,
    role: roleTab,
    ...(statusFilter !== "all" ? { status: statusFilter as "active" | "banned" } : {}),
  };

  const { data: usersPage, isLoading, refetch } = trpc.admin.listUsers.useQuery(listInput, {
    enabled: user?.role === "admin",
  });
  const { data: studentSummary } = trpc.admin.listUsers.useQuery(
    { page: 1, pageSize: 1, search: "", role: "user" },
    { enabled: user?.role === "admin" }
  );
  const { data: lecturerSummary } = trpc.admin.listUsers.useQuery(
    { page: 1, pageSize: 1, search: "", role: "lecturer" },
    { enabled: user?.role === "admin" }
  );
  const { data: activeSummary } = trpc.admin.listUsers.useQuery(
    { page: 1, pageSize: 1, search: "", status: "active" },
    { enabled: user?.role === "admin" }
  );
  const { data: allSummary } = trpc.admin.listUsers.useQuery(
    { page: 1, pageSize: 1, search: "" },
    { enabled: user?.role === "admin" }
  );

  const form = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    mode: "onTouched",
    defaultValues: { name: "", email: "", role: "user", password: "" },
  });
  const newRole = form.watch("role");
  const newPassword = form.watch("password");
  const createErrors = form.formState.errors;
  const utils = trpc.useUtils();

  const createUser = trpc.admin.createUser.useMutation({
    onSuccess: (newUser) => {
      toast.success(`${newUser.role === "lecturer" ? "Lecturer" : "Student"} account created for ${newUser.name}. Share the email and password with them.`);
      form.reset({ name: "", email: "", role: newUser.role === "lecturer" ? "lecturer" : "user", password: "" });
      setDialogOpen(false);
      void utils.admin.listUsers.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to create account"),
  });

  const openCreateDialog = (open: boolean) => {
    if (open) form.reset({ name: "", email: "", role: roleTab, password: "" });
    setDialogOpen(open);
  };

  const banMutation = trpc.admin.toggleUserBan.useMutation({
    onSuccess: () => {
      toast.success("User status updated.");
      refetch();
      setViewUser(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      toast.success("User deleted.");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const studentTotal = studentSummary?.total ?? 0;
  const lecturerTotal = lecturerSummary?.total ?? 0;
  const totalUsers = allSummary?.total ?? studentTotal + lecturerTotal;
  const activeUsers = activeSummary?.total ?? 0;
  const activePct = totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0;
  const growthBadge = null;

  const rows = useMemo(
    () =>
      (usersPage?.items ?? []).map((u) => ({
        userId: u.id,
        userName: u.name,
        userEmail: u.email,
        role: u.role,
        isBanned: Boolean(u.isBanned),
        userInitials:
          u.name
            ?.split(" ")
            .filter(Boolean)
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase() || "U",
        engagementScore: Math.round(u.averageQuizScore ?? 0),
        quizzesAttempted: u.quizzesAttempted ?? 0,
      })),
    [usersPage?.items]
  );

  const totalPages = Math.max(1, Math.ceil((usersPage?.total ?? 0) / PAGE_SIZE));
  const from = rows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, usersPage?.total ?? 0);

  if (!user || user.role !== "admin") return null;

  const handleDelete = (row: { userId: number; userName: string | null }) => {
    if (!confirm(`Delete ${row.userName}? This is permanent.`)) return;
    const reason = promptReason("Reason for permanent deletion:");
    if (reason) deleteMutation.mutate({ userId: row.userId, reason });
  };

  const handleBan = (row: { userId: number; userName: string | null; isBanned: boolean }) => {
    const reason = promptReason(`Reason to ${row.isBanned ? "restore" : "ban"} ${row.userName}:`);
    if (reason) banMutation.mutate({ userId: row.userId, reason });
  };

  return (
    <DashboardLayout>
      <div className="admin-content admin-users mx-auto space-y-5">
        {/* Hero — matches design banner */}
        <AdminHero kind="users" />

        {/* Stats — 4 cards */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Users"
            value={totalUsers}
            hint="All registered users"
            icon={<Users className="h-4 w-4" />}
            iconClass="bg-emerald-50 text-emerald-700"
            badge={growthBadge}
          />
          <StatCard
            label="Students"
            value={studentTotal}
            hint="Mobile app registrations"
            icon={<User className="h-4 w-4" />}
            iconClass="bg-sky-50 text-sky-700"
          />
          <StatCard
            label="Lecturers"
            value={lecturerTotal}
            hint="Created by administrators"
            icon={<User className="h-4 w-4" />}
            iconClass="bg-violet-50 text-violet-700"
          />
          <StatCard
            label="Active Users"
            value={activeUsers}
            hint={`${activePct}% active`}
            icon={<BarChart3 className="h-4 w-4" />}
            iconClass="bg-orange-50 text-orange-600"
          />
        </section>

        {/* Tabs + Add */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-fit gap-1 rounded-full bg-slate-100/90 p-1">
            <button
              type="button"
              onClick={() => {
                setRoleTab("user");
                setPage(1);
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                roleTab === "user"
                  ? "bg-[#033c35] text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Students ({studentTotal})
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleTab("lecturer");
                setPage(1);
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                roleTab === "lecturer"
                  ? "bg-[#033c35] text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Lecturers ({lecturerTotal})
            </button>
          </div>

          <Dialog open={dialogOpen} onOpenChange={openCreateDialog}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="h-10 gap-2 rounded-full bg-[#033c35] px-4 text-sm font-semibold text-white hover:bg-[#045c50]"
              >
                <UserPlus className="h-4 w-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create {newRole === "lecturer" ? "lecturer" : "student"} account</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={form.handleSubmit((v) => createUser.mutate(v))}
                className="space-y-4 pt-2"
              >
                <div className="space-y-1.5">
                  <Label>Account type</Label>
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Account type">
                    {([["user", "Student"], ["lecturer", "Lecturer"]] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={newRole === value}
                        onClick={() => form.setValue("role", value)}
                        className={`h-10 rounded-xl border text-sm font-semibold transition ${newRole === value ? "border-[#033c35] bg-[#033c35] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Users can't sign up on their own. Share the email and password with them; they can change the password after signing in.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lec-name">Full name</Label>
                  <Input
                    id="lec-name"
                    placeholder={newRole === "lecturer" ? "Dr. John Smith" : "Jane Doe"}
                    className="rounded-xl"
                    maxLength={100}
                    aria-invalid={Boolean(createErrors.name)}
                    {...form.register("name")}
                  />
                  <FieldError message={createErrors.name?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lec-email">Email</Label>
                  <Input
                    id="lec-email"
                    type="email"
                    placeholder={`${newRole === "lecturer" ? "lecturer" : "student"}@${ALLOWED_EMAIL_DOMAIN}`}
                    className="rounded-xl"
                    maxLength={254}
                    aria-invalid={Boolean(createErrors.email)}
                    {...form.register("email")}
                  />
                  <FieldError message={createErrors.email?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lec-pass">Password</Label>
                  <div className="relative">
                    <Input
                      id="lec-pass"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 8 characters, a letter and a number"
                      className="rounded-xl pr-10"
                      autoComplete="new-password"
                      aria-invalid={Boolean(createErrors.password)}
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
                  <PasswordRules value={newPassword} />
                  <FieldError message={createErrors.password?.message} />
                </div>
                <Button
                  type="submit"
                  className="w-full rounded-xl bg-[#033c35] font-semibold text-white hover:bg-[#045c50]"
                  disabled={createUser.isPending}
                >
                  {createUser.isPending ? "Creating…" : `Create ${newRole === "lecturer" ? "Lecturer" : "Student"} Account`}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Table card */}
        <div className="overflow-hidden rounded-[1.25rem] border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-full border-slate-200 bg-slate-50/80 pl-10 text-sm focus-visible:ring-emerald-500"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect
                icon={<User className="h-3.5 w-3.5 text-slate-400" />}
                value="all"
                disabled
                options={[{ value: "all", label: "All Roles" }]}
                onChange={() => undefined}
              />
              <FilterSelect
                icon={<CircleDot className="h-3.5 w-3.5 text-emerald-500" />}
                value={statusFilter}
                options={[
                  { value: "all", label: "All Status" },
                  { value: "active", label: "Active" },
                  { value: "banned", label: "Banned" },
                ]}
                onChange={(v) => {
                  setStatusFilter(v as "all" | "active" | "banned");
                  setPage(1);
                }}
              />
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <Filter className="h-3.5 w-3.5" />
                Filter
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 sm:px-6">#</th>
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3">Engagement Score</th>
                  <th className="px-3 py-3">Quizzes</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-5 py-3 text-right sm:px-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      {Array.from({ length: 8 }).map((__, j) => (
                        <td key={j} className="px-3 py-4">
                          <Skeleton className="h-5 w-16" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : rows.length > 0 ? (
                  rows.map((u, index) => (
                    <tr
                      key={u.userId}
                      className="border-b border-slate-50 transition-colors hover:bg-slate-50/60"
                    >
                      <td className="px-5 py-4 text-slate-400 sm:px-6">
                        {(page - 1) * PAGE_SIZE + index + 1}
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                              AVATAR_TONES[u.userId % AVATAR_TONES.length]
                            }`}
                          >
                            {u.userInitials}
                          </div>
                          <p className="font-semibold text-slate-900">{u.userName}</p>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-slate-500">{u.userEmail}</td>
                      <td className="px-3 py-4">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-3 py-4 font-semibold text-slate-800">{u.engagementScore}%</td>
                      <td className="px-3 py-4 text-slate-600">{u.quizzesAttempted}</td>
                      <td className="px-3 py-4">
                        <StatusBadge banned={u.isBanned} />
                      </td>
                      <td className="px-5 py-4 sm:px-6">
                        <div className="flex items-center justify-end gap-1.5">
                          <ActionIcon
                            label="View"
                            className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            onClick={() => setViewUser(u)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </ActionIcon>
                          <ActionIcon
                            label={u.isBanned ? "Restore" : "Ban"}
                            className="bg-sky-50 text-sky-700 hover:bg-sky-100"
                            onClick={() => handleBan(u)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </ActionIcon>
                          <ActionIcon
                            label="Delete"
                            className="bg-red-50 text-red-600 hover:bg-red-100"
                            onClick={() => handleDelete(u)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </ActionIcon>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-14 text-center text-slate-400">
                      {searchQuery
                        ? `No ${roleTab === "lecturer" ? "lecturers" : "students"} match your search.`
                        : roleTab === "lecturer"
                          ? "No lecturer accounts yet."
                          : "No students have signed up in the app yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs text-slate-500">
              Showing {from} to {to} of {usersPage?.total ?? 0} users
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .slice(0, 7)
                .map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                      p === page
                        ? "bg-[#033c35] text-white shadow-sm"
                        : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={Boolean(viewUser)} onOpenChange={(open) => !open && setViewUser(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User details</DialogTitle>
          </DialogHeader>
          {viewUser ? (
            <div className="space-y-3 pt-1 text-sm">
              <DetailRow label="Name" value={viewUser.userName ?? "—"} />
              <DetailRow label="Email" value={viewUser.userEmail ?? "—"} />
              <DetailRow
                label="Role"
                value={
                  viewUser.role === "lecturer"
                    ? "Lecturer"
                    : viewUser.role === "admin"
                      ? "Admin"
                      : "Student"
                }
              />
              <DetailRow label="Status" value={viewUser.isBanned ? "Banned" : "Active"} />
              <DetailRow label="Engagement" value={`${viewUser.engagementScore}%`} />
              <DetailRow label="Quizzes" value={String(viewUser.quizzesAttempted)} />
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => handleBan(viewUser)}
                >
                  {viewUser.isBanned ? (
                    <>
                      <ShieldCheck className="h-4 w-4" /> Restore
                    </>
                  ) : (
                    <>
                      <Ban className="h-4 w-4" /> Ban
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => handleDelete(viewUser)}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
  iconClass,
  badge,
}: {
  label: string;
  value: number;
  hint: string;
  icon: ReactNode;
  iconClass: string;
  badge?: string | null;
}) {
  return (
    <div className="admin-stat-card rounded-[1.1rem] border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-2">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconClass}`}>{icon}</div>
        {badge ? (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
            ↑ {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{value.toLocaleString()}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-800">{label}</p>
      <p className="text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function RoleBadge({ role }: { role?: string }) {
  if (role === "admin") {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
        Admin
      </span>
    );
  }
  if (role === "lecturer") {
    return (
      <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700">
        Lecturer
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">
      Student
    </span>
  );
}

function StatusBadge({ banned }: { banned: boolean }) {
  if (banned) {
    return (
      <span className="inline-flex rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
        Banned
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
      Active
    </span>
  );
}

function ActionIcon({
  children,
  label,
  className,
  onClick,
}: {
  children: ReactNode;
  label: string;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

function FilterSelect({
  icon,
  value,
  options,
  onChange,
  disabled,
}: {
  icon: ReactNode;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="relative inline-flex h-10 items-center">
      <span className="pointer-events-none absolute left-3 z-[1]">{icon}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 appearance-none rounded-full border border-slate-200 bg-white pl-8 pr-8 text-sm font-medium text-slate-600 outline-none disabled:opacity-70"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-50 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}
