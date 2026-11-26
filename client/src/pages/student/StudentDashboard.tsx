import { Link } from "wouter";

import { trpc } from "@/lib/trpc";

import { StudentHero } from "@/components/StudentUi";
import { DashboardHeading, DashboardShortcuts } from "@/components/DashboardOverview";

import { BookOpen } from "lucide-react";
import { AppIcon } from "@/components/icons/AppIcon";

import { courseCoverSrc } from "@/components/student/CoursePage";

import { Box, State, Go, Empty, Stats, grid, upload } from "./workspaceShared";
export default function Dashboard() {
  const query = trpc.studentLearning.dashboard.useQuery();
  const courses = trpc.studentCourses.list.useQuery();
  if (!query.data) return <State query={query} />;
  const d = query.data;
  const hour = new Date().getHours();
  return (
    <>
      <StudentHero
        kind="dashboard"
        eyebrow={
          hour < 12
            ? "Good morning,"
            : hour < 18
              ? "Good afternoon,"
              : "Good evening,"
        }
        title={d.student.name || "Student"}
        description="Your learning journey continues. Stay consistent and keep making progress!"
      >
        <Go href={d.continueLearning?.href || "/student/courses"}>
          <AppIcon name="ChevronRight" size={16} /> Continue learning
        </Go>
        <blockquote>
          A little progress
          <br />
          every day adds up
          <br />
          to big results.
        </blockquote>
      </StudentHero>
      <DashboardHeading title="Make room for progress" description="Your learning activity, next steps, and useful shortcuts in one place." />
      <Stats data={d.progress} />
      <DashboardShortcuts items={[
        { title: "Ask AI", description: "A fresh way to understand", href: "/student/askai", icon: "Sparkles" },
        { title: "Upload material", description: "Turn your notes into knowledge", href: "/student/library", icon: "Upload" },
        { title: "Plan your study", description: "Make time for your next goal", href: "/student/planner", icon: "CalendarDays" },
        { title: "View progress", description: "See how far you've come", href: "/student/progress", icon: "BarChart3" },
      ]} />
      <div className="student-dashboard-grid">
        <Box title="Today's focus">
          <Link className="student-view" href="/student/planner">
            View all →
          </Link>
          {d.today.map(t => (
            <div key={t.id} className="student-task">
              <span className="student-icon">
                <BookOpen aria-hidden="true" />
              </span>
              <div>
                <h3>{t.title}</h3>
                <p>{t.detail}</p>
              </div>
              <Go href={t.href}>Open</Go>
            </div>
          ))}
          {!d.today.length && (
            <Empty>
              Join a course or upload a document to start your study plan.
            </Empty>
          )}
        </Box>
        <Box title="Recent courses">
          <Link className="student-view" href="/student/courses">
            View all →
          </Link>
          <State query={courses} />
          {courses.data?.slice(0, 2).map(c => (
            <Link
              className="student-recent-course"
              key={c.id}
              href={`/course/${c.id}`}
            >
              <span className="student-course-thumb">
                <img src={courseCoverSrc(c.coverImageUrl)} alt="" />
              </span>
              <div>
                <h3>{c.title}</h3>
                <div className="student-course-progress" role="progressbar" aria-label={`${c.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.progressPct}>
                  <div>
                    <span style={{ width: `${c.progressPct}%` }} />
                  </div>
                  <small>{c.progressPct}%</small>
                </div>
              </div>
            </Link>
          ))}
          {courses.data?.length === 0 && (
            <Empty>Your enrolled courses will appear here.</Empty>
          )}
        </Box>
      </div>
      {d.upcoming.length > 0 && (
        <Box title="Upcoming assignments">
          {d.upcoming.map(a => (
            <div className="student-task" key={a.id}>
              <div>
                <h3>{a.title}</h3>
                <p>
                  {a.courseTitle} · {a.status}
                  {a.dueDate
                    ? ` · ${new Date(a.dueDate).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
              <Go href={a.href} tone="accent">View course</Go>
            </div>
          ))}
        </Box>
      )}
    </>
  );
}
