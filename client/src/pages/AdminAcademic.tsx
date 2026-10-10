import { AdminHero } from "@/components/admin/AdminHero";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  FileText,
  GraduationCap,
  List,
  Plus,
  Tag,
  User,
  Users,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { FieldError } from "@/components/FieldError";
import { promptReason, useFieldErrors } from "@/lib/formValidation";
import { LIMITS, validateText } from "@shared/validation";

const DESC_MAX = 500;

export default function AdminAcademic() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.getAcademicPerformance.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const { data: lecturers } = trpc.admin.listUsers.useQuery(
    { page: 1, pageSize: 100, search: "", role: "lecturer", status: "active" },
    { enabled: user?.role === "admin" }
  );
  const { data: students } = trpc.admin.listUsers.useQuery(
    { page: 1, pageSize: 1, search: "", role: "user" },
    { enabled: user?.role === "admin" }
  );

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [lecturerId, setLecturerId] = useState("");
  const [reason, setReason] = useState("Assigned as module lecturer");
  const { errors, check, clear, reset: resetErrors } = useFieldErrors<"title" | "lecturerId" | "subject" | "reason" | "description">();

  const createCourse = trpc.admin.createCourse.useMutation({
    onSuccess: (course) => {
      toast.success(`Assigned ${course.title} (${course.code}) to the lecturer.`);
      setTitle("");
      setSubject("");
      setDescription("");
      setLecturerId("");
      setReason("Assigned as module lecturer");
      utils.admin.getAcademicPerformance.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const reassign = trpc.admin.assignLecturerToCourse.useMutation({
    onSuccess: () => {
      toast.success("Lecturer updated for this course.");
      utils.admin.getAcademicPerformance.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });


  if (!user || user.role !== "admin") return null;

  const lecturerOptions = lecturers?.items ?? [];

  const resetForm = () => {
    setTitle("");
    setSubject("");
    setDescription("");
    setLecturerId("");
    setReason("Assigned as module lecturer");
    resetErrors();
  };

  const submitCourse = () => {
    const ok = check({
      title: validateText(title, { label: "Course title", ...LIMITS.title }),
      lecturerId: lecturerId ? null : "Choose the lecturer who will teach this course.",
      subject: validateText(subject, { label: "Subject", required: false, max: 100 }),
      reason: validateText(reason, { label: "Reason", ...LIMITS.reason }),
      description: validateText(description, { label: "Description", required: false, max: DESC_MAX }),
    });
    if (!ok) return;
    createCourse.mutate({
      title: title.trim(),
      subject: subject.trim() || undefined,
      description: description.trim() || undefined,
      lecturerId: Number(lecturerId),
      reason: reason.trim(),
    });
  };

  return (
    <DashboardLayout>
      <main className="admin-content admin-academic mx-auto space-y-5">
        {/* Hero */}
        <AdminHero kind="academic" />

        {/* Course Assignment form */}
        <section className="rounded-[1.25rem] border border-slate-200/90 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <GraduationCap className="h-5 w-5" strokeWidth={1.7} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Course Assignment</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Fill in the details below to create and assign a course to a lecturer.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <IconField label="Course title" error={errors.title}>
              <BookOpen className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={title}
                maxLength={LIMITS.title.max}
                aria-invalid={Boolean(errors.title)}
                onChange={(e) => { setTitle(e.target.value); clear("title"); }}
                placeholder="Geographic Information Systems"
                className="h-11 rounded-xl border-slate-200 pl-10 focus-visible:ring-emerald-500"
              />
            </IconField>

            <IconField label="Lecturer" error={errors.lecturerId}>
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={lecturerId}
                aria-invalid={Boolean(errors.lecturerId)}
                onChange={(e) => { setLecturerId(e.target.value); clear("lecturerId"); }}
                className="h-11 w-full appearance-none rounded-xl border border-slate-200 aria-invalid:border-destructive bg-white pl-10 pr-8 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
              >
                <option value="">Select a lecturer</option>
                {lecturerOptions.map((lecturer) => (
                  <option key={lecturer.id} value={lecturer.id}>
                    {lecturer.name} ({lecturer.email})
                  </option>
                ))}
              </select>
            </IconField>

            <IconField label="Subject (optional)" error={errors.subject}>
              <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={subject}
                maxLength={100}
                aria-invalid={Boolean(errors.subject)}
                onChange={(e) => { setSubject(e.target.value); clear("subject"); }}
                placeholder="Computer Science"
                className="h-11 rounded-xl border-slate-200 pl-10 focus-visible:ring-emerald-500"
              />
            </IconField>

            <IconField label="Reason" error={errors.reason}>
              <List className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={reason}
                maxLength={LIMITS.reason.max}
                aria-invalid={Boolean(errors.reason)}
                onChange={(e) => { setReason(e.target.value); clear("reason"); }}
                placeholder="Assigned as module lecturer"
                className="h-11 rounded-xl border-slate-200 pl-10 focus-visible:ring-emerald-500"
              />
            </IconField>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Description (optional)</label>
              <div className="relative">
                <FileText className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <textarea
                  value={description}
                  maxLength={DESC_MAX}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Enter course description..."
                  className="min-h-[88px] w-full resize-y rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                />
                <span className="pointer-events-none absolute bottom-2.5 right-3 text-[11px] font-medium text-slate-400">
                  {description.length}/{DESC_MAX}
                </span>
              </div>
              <FieldError message={errors.description} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={createCourse.isPending}
              onClick={submitCourse}
              className="h-10 gap-2 rounded-full bg-[#033c35] px-4 text-sm font-semibold text-white hover:bg-[#045c50]"
            >
              <Plus className="h-4 w-4" />
              {createCourse.isPending ? "Assigning…" : "Create and assign course"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
              className="h-10 rounded-full border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Button>
          </div>

          {lecturerOptions.length === 0 ? (
            <p className="mt-4 text-sm text-amber-700">
              Create a lecturer account on Users first, then assign a course here.
            </p>
          ) : null}
        </section>

        {/* Status cards */}
        <section className="grid gap-3 sm:grid-cols-3">
          <StatusCard
            label="Total Courses"
            value={isLoading ? "—" : data?.courses.length ?? 0}
            hint="In the catalogue"
            icon={<BookOpen className="h-4 w-4" />}
            iconClass="bg-emerald-50 text-emerald-700"


            onOpen={() => document.getElementById("academic-courses")?.scrollIntoView({ behavior: "smooth" })}
          />
          <StatusCard
            label="Total Lecturers"
            value={lecturers?.total ?? 0}
            hint="Active lecturers"
            icon={<Users className="h-4 w-4" />}
            iconClass="bg-sky-50 text-sky-700"


            onOpen={() => setLocation("/admin/users")}
          />
          <StatusCard
            label="Total Students"
            value={students?.total ?? 0}
            hint="Across all courses"
            icon={<BarChart3 className="h-4 w-4" />}
            iconClass="bg-violet-50 text-violet-700"


            onOpen={() => setLocation("/admin/users")}
          />
        </section>

        {/* Keep operational tables below the matched design */}
        <section
          id="academic-courses"
          className="overflow-hidden rounded-[1.25rem] border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
        >
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <h2 className="text-base font-semibold text-slate-900">
              Course enrolment and lecturer assignment
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Reassign lecturers when module ownership changes.
            </p>
          </div>
          <Table
            heads={["Course", "Lecturer", "Enrolled", "Average quiz score", "Reassign"]}
            rows={(data?.courses ?? []).map((c) => [
              <>
                {c.code} — {c.title}
              </>,
              c.lecturerName ?? "Unassigned",
              c.enrolled,
              `${Math.round(c.averageScore)}%`,
              <select
                key={c.courseId}
                defaultValue={c.lecturerId ?? ""}
                className="max-w-[220px] rounded-lg border px-2 py-1 text-xs"
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (!next || next === c.lecturerId) return;
                  const note = promptReason("Reason for reassignment?");
                  if (!note) {
                    e.target.value = String(c.lecturerId ?? "");
                    return;
                  }
                  reassign.mutate({ courseId: c.courseId, lecturerId: next, reason: note });
                }}
              >
                {lecturerOptions.map((lecturer) => (
                  <option key={lecturer.id} value={lecturer.id}>
                    {lecturer.name}
                  </option>
                ))}
              </select>,
            ])}
            loading={isLoading}
          />
        </section>

        <section className="overflow-hidden rounded-[1.25rem] border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <h2 className="text-base font-semibold text-slate-900">Students requiring follow-up</h2>
          </div>
          <Table
            heads={["Student", "Last activity", "Quiz average", "Late submissions"]}
            rows={(data?.atRisk ?? []).map((s) => [
              <>
                <b>{s.name}</b>
                <br />
                <span className="text-xs text-slate-500">{s.email}</span>
              </>,
              s.lastActivity ? new Date(s.lastActivity).toLocaleDateString() : "No activity",
              `${Math.round(s.averageScore)}%`,
              s.overdue,
            ])}
            loading={isLoading}
          />
        </section>
      </main>
    </DashboardLayout>
  );
}

function IconField({ label, error, children }: { label: string; error?: string | null; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">{children}</div>
      <FieldError message={error} />
    </div>
  );
}

function StatusCard({
  label,
  value,
  hint,
  icon,
  iconClass,


  onOpen,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: ReactNode;
  iconClass: string;


  onOpen?: () => void;
}) {
  return (
    <div className="admin-academic-stat flex items-center gap-3 rounded-[1.1rem] border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      <button
        type="button"
        aria-label={`Open ${label}`}
        onClick={onOpen}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}


function Table({
  heads,
  rows,
  loading,
}: {
  heads: string[];
  rows: ReactNode[][];
  loading: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50/80 text-left text-slate-500">
          <tr>
            {heads.map((h) => (
              <th key={h} className="px-5 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td className="p-5" colSpan={heads.length}>
                <Skeleton className="h-5 w-40" />
              </td>
            </tr>
          ) : rows.length ? (
            rows.map((row, i) => (
              <tr key={i} className="border-t border-slate-50">
                {row.map((cell, j) => (
                  <td key={j} className="px-5 py-3">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className="p-5 text-slate-500" colSpan={heads.length}>
                No data yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
