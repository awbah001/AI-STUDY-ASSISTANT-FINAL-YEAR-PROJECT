import DashboardLayout from "@/components/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { trpc } from "@/lib/trpc";
import { Users, Search, GraduationCap, Mail, Calendar } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

export default function LecturerStudents() {
  const { isAllowed } = useRoleGuard("lecturer");
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const { data: students, isLoading } = trpc.lecturer.students.listAll.useQuery(undefined, {
    enabled: isAllowed,
  });

  if (!isAllowed) return null;

  const filtered = (students ?? []).filter(
    (s) =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()) ||
      s.courseTitle?.toLowerCase().includes(search.toLowerCase())
  );

  // Group by student so we can show all enrolled courses per student
  const grouped = filtered.reduce<Record<number, { name: string | null; email: string | null; courses: { courseId: number; courseTitle: string | null; enrolledAt: Date | string }[] }>>(
    (acc, s) => {
      if (!acc[s.studentId]) {
        acc[s.studentId] = { name: s.name, email: s.email, courses: [] };
      }
      acc[s.studentId].courses.push({ courseId: s.courseId, courseTitle: s.courseTitle, enrolledAt: s.enrolledAt });
      return acc;
    },
    {}
  );

  const groupedList = Object.entries(grouped);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Students</h1>
          <p className="mt-1 text-sm text-slate-500">All students enrolled across your courses.</p>
        </div>

        {/* Search + count */}
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm px-6 py-4">
          <div className="flex items-center gap-3 mb-1">
            <Search className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-semibold text-slate-800">Find Students</span>
          </div>
          <p className="text-xs text-slate-500 mb-4">Search by name, email or course.</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search students..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl border-slate-200"
            />
          </div>
        </div>

        {/* Student cards */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : groupedList.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
            <Users className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-500">
              {search ? "No students match your search" : "No students enrolled yet"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Students join by entering an enrollment code from a course.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
                <Users className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                All Students ({groupedList.length})
              </p>
            </div>
            <div className="divide-y divide-slate-50">
              {groupedList.map(([studentIdStr, student]) => (
                <div key={studentIdStr} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                  {/* Avatar */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                    {student.name?.charAt(0).toUpperCase() ?? "?"}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{student.name}</p>
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                      <Mail className="h-3 w-3" />
                      {student.email}
                    </div>
                    {/* Enrolled courses */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {student.courses.map((c) => (
                        <button
                          key={c.courseId}
                          type="button"
                          onClick={() => setLocation(`/lecturer/courses/${c.courseId}`)}
                          className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                        >
                          <GraduationCap className="h-3 w-3" />
                          {c.courseTitle}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Enrolled date */}
                  <div className="shrink-0 text-right hidden sm:block">
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Calendar className="h-3 w-3" />
                      {new Date(student.courses[0].enrolledAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {student.courses.length} {student.courses.length === 1 ? "course" : "courses"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {/* Footer */}
            <div className="border-t border-slate-100 px-6 py-3">
              <p className="text-xs text-slate-500">
                Showing {groupedList.length} student{groupedList.length !== 1 ? "s" : ""}
                {search ? ` matching "${search}"` : ""}
              </p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
