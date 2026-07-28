import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { GraduationCap, BookOpen } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function StudentCourses() {
  const [, setLocation] = useLocation();
  const [code, setCode] = useState("");
  const utils = trpc.useUtils();

  const { data: courses, isLoading } = trpc.studentCourses.list.useQuery();
  const enroll = trpc.studentCourses.enroll.useMutation({
    onSuccess: (r) => {
      toast[r.success ? "success" : "error"](r.message);
      if (r.success) {
        utils.studentCourses.list.invalidate();
        setCode("");
      }
    },
  });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-emerald-600" />
            My courses
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Join courses with an enrollment code from your lecturer.
          </p>
        </div>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-lg">Join a course</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              placeholder="Enter 6-character code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="rounded-2xl font-mono uppercase"
              maxLength={6}
            />
            <Button
              className="rounded-2xl bg-emerald-500/15 border border-emerald-400/50 text-emerald-700 hover:bg-emerald-500/25"
              disabled={code.length < 4 || enroll.isPending}
              onClick={() => enroll.mutate({ code })}
            >
              Enroll
            </Button>
          </CardContent>
        </Card>

        {isLoading ? (
          <p className="text-muted-foreground">Loading courses...</p>
        ) : courses?.length === 0 ? (
          <Card className="rounded-3xl border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">
              You are not enrolled in any courses yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {(courses ?? []).map((course) => (
              <Card
                key={course.id}
                className="rounded-3xl hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setLocation(`/courses/${course.id}`)}
              >
                <CardContent className="p-5 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-lg">{course.title}</h3>
                    {course.subject ? (
                      <p className="text-sm text-emerald-600 font-medium">{course.subject}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground mt-1">
                      Lecturer: {course.lecturerName} · Enrolled{" "}
                      {new Date(course.enrolledAt).toLocaleDateString()}
                    </p>
                  </div>
                  <BookOpen className="h-5 w-5 text-emerald-600 shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
