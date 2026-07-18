import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { trpc } from "@/lib/trpc";
import { Megaphone } from "lucide-react";

export default function LecturerAnnouncements() {
  const { isAllowed } = useRoleGuard("lecturer");
  const { data: announcements, isLoading } = trpc.lecturer.announcements.list.useQuery(undefined, {
    enabled: isAllowed,
  });

  if (!isAllowed) return null;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-7 w-7 text-indigo-600" />
            Announcements
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Academic updates posted to your courses.
          </p>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : announcements?.length === 0 ? (
          <Card className="rounded-3xl">
            <CardContent className="py-12 text-center text-muted-foreground">
              No announcements yet. Post updates from a course page.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {announcements?.map((a) => (
              <Card key={a.id} className="rounded-2xl">
                <CardContent className="p-5">
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">
                    {a.courseTitle}
                  </p>
                  <h3 className="font-semibold text-lg mt-1">{a.title}</h3>
                  <p className="text-sm mt-2 whitespace-pre-wrap text-slate-700">{a.content}</p>
                  <p className="text-xs text-muted-foreground mt-3">
                    {new Date(a.createdAt).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
