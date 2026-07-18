import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { trpc } from "@/lib/trpc";
import { Users } from "lucide-react";

export default function LecturerStudents() {
  const { isAllowed } = useRoleGuard("lecturer");
  const { data: students, isLoading } = trpc.lecturer.students.listAll.useQuery(undefined, {
    enabled: isAllowed,
  });

  if (!isAllowed) return null;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-7 w-7 text-indigo-600" />
            Enrolled students
          </h1>
          <p className="text-muted-foreground text-sm mt-1">All students across your courses.</p>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : students?.length === 0 ? (
          <Card className="rounded-3xl">
            <CardContent className="py-12 text-center text-muted-foreground">
              No students enrolled yet. Add students from a course page.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {students?.map((s, i) => (
              <Card key={`${s.studentId}-${s.courseId}-${i}`} className="rounded-2xl">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-sm text-muted-foreground">{s.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-indigo-700">{s.courseTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      Enrolled {new Date(s.enrolledAt).toLocaleDateString()}
                    </p>
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
