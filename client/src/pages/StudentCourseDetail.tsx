import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, FileText, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRoute, useLocation } from "wouter";

export default function StudentCourseDetail() {
  const [, params] = useRoute("/courses/:id");
  const [, setLocation] = useLocation();
  const courseId = Number(params?.id);

  const { data: courses } = trpc.studentCourses.list.useQuery();
  const course = courses?.find((c) => c.id === courseId);
  const { data: materials } = trpc.studentCourses.materials.useQuery(
    { courseId },
    { enabled: !Number.isNaN(courseId) }
  );
  const { data: announcements } = trpc.studentCourses.announcements.useQuery(
    { courseId },
    { enabled: !Number.isNaN(courseId) }
  );

  if (Number.isNaN(courseId)) return null;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <Button variant="ghost" className="gap-2 -ml-2" onClick={() => setLocation("/courses")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6">
          <h1 className="text-2xl font-bold">{course?.title ?? "Course"}</h1>
          {course?.subject ? <p className="text-emerald-600 font-medium">{course.subject}</p> : null}
          <p className="text-sm text-muted-foreground mt-1">Lecturer: {course?.lecturerName}</p>
        </div>

        <section className="space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" /> Course materials
          </h2>
          {materials?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No materials available yet.</p>
          ) : (
            materials?.map((doc) => (
              <Card
                key={doc.id}
                className="rounded-2xl cursor-pointer hover:shadow-md"
                onClick={() => setLocation(`/document/${doc.id}`)}
              >
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">{doc.materialType} · {doc.fileName}</p>
                  </div>
                  <span className="text-xs text-emerald-600 font-medium">Open →</span>
                </CardContent>
              </Card>
            ))
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-emerald-600" /> Announcements
          </h2>
          {announcements?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No announcements.</p>
          ) : (
            announcements?.map((a) => (
              <Card key={a.id} className="rounded-2xl">
                <CardContent className="p-4">
                  <p className="font-semibold">{a.title}</p>
                  <p className="text-sm mt-2 whitespace-pre-wrap">{a.content}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(a.createdAt).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
