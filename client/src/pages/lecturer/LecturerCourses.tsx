import DashboardLayout from "@/components/DashboardLayout";
import { LecturerHero, LecturerStats } from "@/components/lecturer/LecturerUi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookMarked, Copy, Pencil, Archive, ArchiveRestore, Users, Search, BookOpen, FileText,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { FieldError } from "@/components/FieldError";
import { useFieldErrors } from "@/lib/formValidation";
import { LIMITS, validateText } from "@shared/validation";

const SUBJECT_MAX = 100;

export default function LecturerCourses() {
  const { isAllowed } = useRoleGuard("lecturer");
  const [, setLocation] = useLocation();
  const [editCourse, setEditCourse] = useState<any>(null);
  const [listTab, setListTab] = useState<"active" | "archived">("active");

  const [search, setSearch] = useState("");
  const { data: students } = trpc.lecturer.students.listAll.useQuery(undefined, { enabled: isAllowed });
  const { data: stats } = trpc.lecturer.dashboardStats.useQuery(undefined, { enabled: isAllowed });

  // Edit form
  const [editTitle, setEditTitle] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const utils = trpc.useUtils();
  const { data: courses, isLoading } = trpc.lecturer.courses.list.useQuery(undefined, { enabled: isAllowed });

  const updateCourse = trpc.lecturer.courses.update.useMutation({
    onSuccess: (_data, vars) => {
      toast.success(
        typeof vars.isActive === "boolean"
          ? vars.isActive ? "Course restored" : "Course archived"
          : "Course updated"
      );
      utils.lecturer.courses.list.invalidate();
      setEditCourse(null);
    },
    onError: (e) => toast.error(e.message),
  });

  if (!isAllowed) return null;

  const openEdit = (course: any) => {
    setEditCourse(course);
    setEditTitle(course.title);
    setEditSubject(course.subject ?? "");
    setEditDescription(course.description ?? "");
  };

  const copyCode = async (code: string) => {
    try { await navigator.clipboard.writeText(code); toast.success("Enrollment code copied"); }
    catch { toast.error("Could not copy the code. Please select and copy it manually."); }
  };

  return (
    <DashboardLayout>
      <div className="lecturer-content lecturer-courses mx-auto space-y-6">

        <LecturerHero
          eyebrow="Teaching workspace"
          title="My Courses"
          description="Courses assigned to you by an administrator. Archive a course to stop new enrollments; enrolled students keep access."
          icon={BookMarked}
        />

        <LecturerStats items={[
          { label: "Total Courses", value: courses?.length ?? "\u2014", hint: "Assigned to you", icon: BookMarked },
          { label: "Active Courses", value: courses ? courses.filter(c => c.isActive).length : "\u2014", hint: "Open for enrollment", icon: BookOpen },
          { label: "Enrolled Students", value: stats?.studentCount ?? "\u2014", hint: "Across your courses", icon: Users },
          { label: "Course Materials", value: stats?.documentCount ?? "\u2014", hint: "Uploaded documents", icon: FileText },
        ]}/>
        <div className="lecturer-filterbar"><label className="lecturer-search"><Search/><Input aria-label="Search courses" placeholder="Search your courses..." value={search} onChange={e => setSearch(e.target.value)}/></label></div>
        {/* Edit dialog */}
        <Dialog open={!!editCourse} onOpenChange={(o) => { if (!o) setEditCourse(null); }}>
          <DialogContent className="rounded-2xl sm:max-w-md">
            <DialogHeader><DialogTitle>Edit Course</DialogTitle></DialogHeader>
            <CourseForm
              title={editTitle} setTitle={setEditTitle}
              subject={editSubject} setSubject={setEditSubject}
              description={editDescription} setDescription={setEditDescription}
              onSubmit={() => updateCourse.mutate({
                courseId: editCourse.id,
                title: editTitle.trim(),
                subject: editSubject.trim() || undefined,
                description: editDescription.trim() || undefined,
              })}
              pending={updateCourse.isPending}
              label="Save changes"
            />
          </DialogContent>
        </Dialog>

        {(() => {
          const visible = (courses ?? []).filter((c) => (listTab === "active" ? c.isActive : !c.isActive) && [c.title, c.subject, c.code].some(value => value?.toLowerCase().includes(search.toLowerCase())));
          const activeCount = (courses ?? []).filter((c) => c.isActive).length;
          const archivedCount = (courses ?? []).length - activeCount;
          return (
        <>
        {courses && courses.length > 0 ? (
          <Tabs value={listTab} onValueChange={(v) => setListTab(v as "active" | "archived")}>
            <TabsList className="rounded-xl">
              <TabsTrigger value="active" className="rounded-lg">Active ({activeCount})</TabsTrigger>
              <TabsTrigger value="archived" className="rounded-lg">Archived ({archivedCount})</TabsTrigger>
            </TabsList>
          </Tabs>
        ) : null}

        {/* Course list */}
        {isLoading ? (
          <div className="lecturer-course-grid">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
        ) : !courses || courses.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
            <BookMarked className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-500">No courses assigned yet</p>
            <p className="text-xs text-slate-400 mt-1">An administrator must create a course and assign it to you.</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
            <Archive className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-500">
              {listTab === "archived" ? "No archived courses" : "No active courses"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {listTab === "archived"
                ? "Archive a course when it is no longer taking new students."
                : "Restore a course from the Archived tab to make it active again."}
            </p>
          </div>
        ) : (
          <div className="lecturer-course-grid">
            {visible.map((course, idx) => {
              const accents = [
                { top: "border-t-emerald-500", wash: "from-emerald-50/70", code: "bg-emerald-50 text-emerald-800", label: "text-emerald-500", subject: "text-emerald-700" },
                { top: "border-t-sky-500", wash: "from-sky-50/70", code: "bg-sky-50 text-sky-800", label: "text-sky-500", subject: "text-sky-700" },
                { top: "border-t-violet-500", wash: "from-violet-50/70", code: "bg-violet-50 text-violet-800", label: "text-violet-500", subject: "text-violet-700" },
                { top: "border-t-amber-500", wash: "from-amber-50/70", code: "bg-amber-50 text-amber-800", label: "text-amber-500", subject: "text-amber-700" },
              ][idx % 4];
              return (
              <div
                key={course.id}
                className={`lecturer-course-card group cursor-pointer overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-b ${accents.wash} to-white shadow-sm transition-all hover:shadow-md border-t-4 ${accents.top}`}
                tabIndex={0}
                onKeyDown={e => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setLocation(`/lecturer/courses/${course.id}`); } }}
                onClick={() => setLocation(`/lecturer/courses/${course.id}`)}
              >
                <div className="lecturer-course-cover" aria-hidden="true"><BookOpen/></div>
                <div className="p-5">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-bold text-slate-900">{course.title}</h3>
                      {course.subject && (
                        <p className={`mt-0.5 text-sm font-medium ${accents.subject}`}>{course.subject}</p>
                      )}
                    </div>
                    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${course.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {course.isActive ? "Active" : "Archived"}
                    </span>
                  </div>
                  {course.description && (
                    <p className="mb-3 line-clamp-2 text-sm text-slate-500">{course.description}</p>
                  )}

                  <p className="lecturer-course-meta"><Users/>{students ? students.filter(s => s.courseId === course.id).length : "\u2014"} enrolled students</p>
                  {/* Enrollment code */}
                  <div
                    className={`mb-4 flex items-center justify-between rounded-xl px-3 py-2 ${accents.code}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div>
                      <p className={`text-[10px] font-semibold uppercase tracking-wider ${accents.label}`}>Enrollment code</p>
                      <p className="font-mono font-bold tracking-widest">{course.code}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 opacity-70 hover:opacity-100" onClick={() => copyCode(course.code)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 rounded-xl border-slate-200 gap-1.5 text-xs font-semibold"
                      onClick={() => openEdit(course)}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 rounded-xl border-slate-200 gap-1.5 text-xs font-semibold"
                      onClick={() => {
                        if (course.isActive) {
                          if (!confirm(`Archive "${course.title}"? Students will not be able to join with the enrollment code. Students already enrolled keep access.`)) return;
                        }
                        updateCourse.mutate({ courseId: course.id, isActive: !course.isActive });
                      }}
                      disabled={updateCourse.isPending}
                    >
                      {course.isActive
                        ? <><Archive className="h-3.5 w-3.5" /> Archive</>
                        : <><ArchiveRestore className="h-3.5 w-3.5 text-emerald-600" /> Restore</>}
                    </Button>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        )}
        </>
          );
        })()}
      </div>
    </DashboardLayout>
  );
}

function CourseForm({ title, setTitle, subject, setSubject, description, setDescription, onSubmit, pending, label }: any) {
  const { errors, check, clear } = useFieldErrors<"title" | "subject" | "description">();
  const submit = () => {
    const ok = check({
      title: validateText(title, { label: "Course title", ...LIMITS.title }),
      subject: validateText(subject, { label: "Subject", required: false, max: SUBJECT_MAX }),
      description: validateText(description, { label: "Description", required: false, max: LIMITS.description }),
    });
    if (ok) onSubmit();
  };
  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <Label>Course title</Label>
        <Input value={title} maxLength={LIMITS.title.max} aria-invalid={Boolean(errors.title)} onChange={(e: any) => { setTitle(e.target.value); clear("title"); }} placeholder="Introduction to AI" className="rounded-xl" />
        <FieldError message={errors.title} />
      </div>
      <div className="space-y-1.5">
        <Label>Subject <span className="text-slate-400 text-xs">(optional)</span></Label>
        <Input value={subject} maxLength={SUBJECT_MAX} aria-invalid={Boolean(errors.subject)} onChange={(e: any) => { setSubject(e.target.value); clear("subject"); }} placeholder="Computer Science" className="rounded-xl" />
        <FieldError message={errors.subject} />
      </div>
      <div className="space-y-1.5">
        <Label>Description <span className="text-slate-400 text-xs">(optional)</span></Label>
        <Textarea value={description} maxLength={LIMITS.description} aria-invalid={Boolean(errors.description)} onChange={(e: any) => { setDescription(e.target.value); clear("description"); }} rows={3} className="rounded-xl" />
        <FieldError message={errors.description} />
      </div>
      <Button
        className="w-full rounded-xl bg-emerald-500/15 border border-emerald-400/50 text-emerald-700 hover:bg-emerald-500/25 hover:text-emerald-800"
        disabled={pending}
        onClick={submit}
      >
        {pending ? "Saving..." : label}
      </Button>
    </div>
  );
}
