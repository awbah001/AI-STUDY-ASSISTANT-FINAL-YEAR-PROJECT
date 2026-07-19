import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { trpc } from "@/lib/trpc";
import {
  BookMarked, Plus, Copy, Users, FileText,
  Pencil, Trash2, ToggleLeft, ToggleRight,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function LecturerCourses() {
  const { isAllowed } = useRoleGuard("lecturer");
  const [, setLocation] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<any>(null);

  // Create form
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  // Edit form
  const [editTitle, setEditTitle] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const utils = trpc.useUtils();
  const { data: courses, isLoading } = trpc.lecturer.courses.list.useQuery(undefined, { enabled: isAllowed });

  const createCourse = trpc.lecturer.courses.create.useMutation({
    onSuccess: () => {
      toast.success("Course created");
      utils.lecturer.courses.list.invalidate();
      utils.lecturer.dashboardStats.invalidate();
      setCreateOpen(false);
      setTitle(""); setSubject(""); setDescription("");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateCourse = trpc.lecturer.courses.update.useMutation({
    onSuccess: () => {
      toast.success("Course updated");
      utils.lecturer.courses.list.invalidate();
      setEditCourse(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteCourse = trpc.lecturer.courses.delete.useMutation({
    onSuccess: () => {
      toast.success("Course deleted");
      utils.lecturer.courses.list.invalidate();
      utils.lecturer.dashboardStats.invalidate();
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

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Enrollment code copied");
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Courses</h1>
            <p className="mt-1 text-sm text-slate-500">Create and manage subjects. Share enrollment codes with students.</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                <Plus className="h-4 w-4" /> New course
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl sm:max-w-md">
              <DialogHeader><DialogTitle>Create Course</DialogTitle></DialogHeader>
              <CourseForm
                title={title} setTitle={setTitle}
                subject={subject} setSubject={setSubject}
                description={description} setDescription={setDescription}
                onSubmit={() => createCourse.mutate({ title, subject: subject || undefined, description: description || undefined })}
                pending={createCourse.isPending}
                label="Create course"
              />
            </DialogContent>
          </Dialog>
        </div>

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
                title: editTitle,
                subject: editSubject || undefined,
                description: editDescription || undefined,
              })}
              pending={updateCourse.isPending}
              label="Save changes"
            />
          </DialogContent>
        </Dialog>

        {/* Course list */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
        ) : !courses || courses.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
            <BookMarked className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-500">No courses yet</p>
            <p className="text-xs text-slate-400 mt-1">Create your first course to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {courses.map((course) => (
              <div
                key={course.id}
                className="group rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all overflow-hidden cursor-pointer border-t-4 border-t-indigo-500"
                onClick={() => setLocation(`/lecturer/courses/${course.id}`)}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 truncate">{course.title}</h3>
                      {course.subject && (
                        <p className="text-sm text-indigo-600 font-medium mt-0.5">{course.subject}</p>
                      )}
                    </div>
                    <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${course.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {course.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {course.description && (
                    <p className="text-sm text-slate-500 line-clamp-2 mb-3">{course.description}</p>
                  )}

                  {/* Enrollment code */}
                  <div
                    className="flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2 mb-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400">Enrollment code</p>
                      <p className="font-mono font-bold text-indigo-800 tracking-widest">{course.code}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-indigo-500 hover:text-indigo-700" onClick={() => copyCode(course.code)}>
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
                      onClick={() => updateCourse.mutate({ courseId: course.id, isActive: !course.isActive })}
                      disabled={updateCourse.isPending}
                    >
                      {course.isActive
                        ? <><ToggleRight className="h-3.5 w-3.5 text-emerald-600" /> Deactivate</>
                        : <><ToggleLeft className="h-3.5 w-3.5" /> Activate</>}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl border-red-100 text-red-500 hover:bg-red-50 gap-1.5 text-xs"
                      onClick={() => {
                        if (confirm(`Delete "${course.title}"? This also removes all materials and enrollments.`)) {
                          deleteCourse.mutate({ courseId: course.id });
                        }
                      }}
                      disabled={deleteCourse.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function CourseForm({ title, setTitle, subject, setSubject, description, setDescription, onSubmit, pending, label }: any) {
  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <Label>Course title</Label>
        <Input value={title} onChange={(e: any) => setTitle(e.target.value)} placeholder="Introduction to AI" className="rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label>Subject <span className="text-slate-400 text-xs">(optional)</span></Label>
        <Input value={subject} onChange={(e: any) => setSubject(e.target.value)} placeholder="Computer Science" className="rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label>Description <span className="text-slate-400 text-xs">(optional)</span></Label>
        <Textarea value={description} onChange={(e: any) => setDescription(e.target.value)} rows={3} className="rounded-xl" />
      </div>
      <Button
        className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
        disabled={!title.trim() || pending}
        onClick={onSubmit}
      >
        {pending ? "Saving..." : label}
      </Button>
    </div>
  );
}
