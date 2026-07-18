import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { trpc } from "@/lib/trpc";
import { BarChart3 } from "lucide-react";
import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function LecturerAnalytics() {
  const { isAllowed } = useRoleGuard("lecturer");
  const [courseId, setCourseId] = useState<string>("");

  const { data: courses } = trpc.lecturer.courses.list.useQuery(undefined, { enabled: isAllowed });
  const { data: engagement } = trpc.lecturer.analytics.engagement.useQuery(undefined, {
    enabled: isAllowed,
  });
  const selectedId = courseId ? Number(courseId) : courses?.[0]?.id;
  const { data: performance } = trpc.lecturer.analytics.coursePerformance.useQuery(
    { courseId: selectedId! },
    { enabled: isAllowed && !!selectedId }
  );

  if (!isAllowed) return null;

  const chartData =
    performance?.map((p) => ({
      name: p.name?.split(" ")[0] ?? "Student",
      engagement: p.engagementScore,
      quizzes: p.quizzesAttempted,
      score: p.avgQuizScore,
    })) ?? [];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-indigo-600" />
            Student analytics
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track participation, quiz performance, and engagement.
          </p>
        </div>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Engagement by course</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {engagement && engagement.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={engagement}>
                  <CartesianGrid strokeDasharray="4 6" vertical={false} />
                  <XAxis dataKey="courseTitle" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avgEngagement" fill="#6366f1" radius={[6, 6, 0, 0]} name="Avg engagement" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-16">No engagement data yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>Student performance</CardTitle>
            <Select
              value={courseId || String(courses?.[0]?.id ?? "")}
              onValueChange={setCourseId}
            >
              <SelectTrigger className="w-full sm:w-[240px] rounded-2xl">
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                {courses?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="h-[300px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="4 6" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="engagement" fill="#8b5cf6" name="Engagement" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="score" fill="#06b6d4" name="Avg quiz %" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-16">
                Enroll students and assign activities to see performance charts.
              </p>
            )}
          </CardContent>
        </Card>

        {performance && performance.length > 0 ? (
          <div className="overflow-x-auto rounded-3xl border">
            <table className="w-full text-sm">
              <thead className="bg-indigo-50">
                <tr>
                  <th className="text-left p-3 font-semibold">Student</th>
                  <th className="text-left p-3 font-semibold">Engagement</th>
                  <th className="text-left p-3 font-semibold">Quizzes</th>
                  <th className="text-left p-3 font-semibold">Avg score</th>
                  <th className="text-left p-3 font-semibold">Study min</th>
                  <th className="text-left p-3 font-semibold">Chat</th>
                </tr>
              </thead>
              <tbody>
                {performance.map((p) => (
                  <tr key={p.studentId} className="border-t">
                    <td className="p-3">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.email}</div>
                    </td>
                    <td className="p-3">{p.engagementScore}</td>
                    <td className="p-3">{p.quizzesAttempted}</td>
                    <td className="p-3">{p.avgQuizScore}%</td>
                    <td className="p-3">{p.studyMinutes}</td>
                    <td className="p-3">{p.chatCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
