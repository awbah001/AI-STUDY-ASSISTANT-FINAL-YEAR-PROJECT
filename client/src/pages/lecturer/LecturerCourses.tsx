import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { trpc } from "@/lib/trpc";
import { BookMarked, Plus, Copy } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function LecturerCourses() {
  const { isAllowed } = useRoleGuard("lecturer");
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  const utils = trpc.useUtils();
  const { data: courses, isLoading } = trpc.lecturer.courses.list.useQuery(undefined, {
    enabled: isAllowed,
  });

  const createCourse = trpc.lecturer.courses.create.useMutation({
    onSuccess: () => {
      toast.success("Course created");
      utils.lecturer.courses.list.invalidate();
      utils.lecturer.dashboardStats.invalidate();
      setOpen(false);
      setTitle("");
      setSubject("");
      setDescription("");
    },
    onError: (e) => toast.error(e.message),
  });

  if (!isAllowed) return null;

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Enrollment code copied");
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookMarked className="h-7 w-7 text-indigo-600" />
              My courses
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Create and manage subjects. Share enrollment codes with students.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 gap-2">
                <Plus className="h-4 w-4" /> New course
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl">
              <DialogHeader>
                <DialogTitle>Create course</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Course title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Introduction to AI" />
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Computer Science" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                </div>
                <Button
                  className="w-full rounded-2xl bg-indigo-600"
                  disabled={!title.trim() || createCourse.isPending}
                  onClick={() => createCourse.mutate({ title, subject: subject || undefined, description: description || undefined })}
                >
                  {createCourse.isPending ? "Creating..." : "Create course"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading courses...</p>
        ) : courses?.length === 0 ? (
          <Card className="rounded-3xl border-dashed">
            <CardContent className="py-16 text-center text-muted-foreground">
              No courses yet. Create your first course to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {courses?.map((course) => (
              <Card
                key={course.id}
                className="rounded-3xl hover:shadow-md transition-shadow cursor-pointer border-slate-200"
                onClick={() => setLocation(`/lecturer/courses/${course.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{course.title}</CardTitle>
                    <Badge variant={course.isActive ? "default" : "secondary"}>
                      {course.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {course.subject ? (
                    <p className="text-sm text-indigo-600 font-medium">{course.subject}</p>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-3">
                  {course.description ? (
                    <p className="text-sm text-muted-foreground line-clamp-2">{course.description}</p>
                  ) : null}
                  <div
                    className="flex items-center justify-between rounded-2xl bg-indigo-50 px-3 py-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-xs font-medium text-indigo-800">Code: {course.code}</span>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => copyCode(course.code)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
