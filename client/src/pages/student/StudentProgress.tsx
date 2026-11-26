import { Link } from "wouter";

import { trpc } from "@/lib/trpc";

import { StudentRing } from "@/components/StudentUi";

import { BookOpen, ArrowRight } from "lucide-react";

import { Box, State, Go, Empty, Stats, grid } from "./workspaceShared";
export default function Progress() {
  const courses = trpc.studentCourses.list.useQuery();
  const query = trpc.studentLearning.dashboard.useQuery();
  if (!query.data) return <State query={query} />;
  const d = query.data;
  return (
    <>
      <Stats data={d.progress} />
      <div className="student-progress-grid">
        <Box title="Overall learning progress">
          <div className="student-progress-body">
            <StudentRing value={d.progress.completedPct} label="Complete" />
            <div>
              <h3>Learning activity</h3>
              <p>
                {d.progress.quizAttempts} quiz attempts ·{" "}
                {d.progress.completedPct}% learning progress
              </p>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-emerald-600"
                  style={{ width: `${d.progress.completedPct}%` }}
                />
              </div>
              <p className="student-muted">
                Complete more quizzes and review materials to improve your
                progress.
              </p>
            </div>
          </div>
        </Box>
        <Box title="Progress by course">
          <Link className="student-view" href="/student/courses">
            View all →
          </Link>
          <State query={courses} />
          {courses.data?.map(c => (
            <Link
              className="student-progress-course"
              href={`/course/${c.id}`}
              key={c.id}
            >
              <span className="student-icon">
                <BookOpen />
              </span>
              <div>
                <h3>{c.title}</h3>
                <div className="student-course-progress">
                  <div>
                    <span style={{ width: `${c.progressPct}%` }} />
                  </div>
                  <small>{c.progressPct}%</small>
                </div>
              </div>
              <ArrowRight />
            </Link>
          ))}
          {courses.data?.length === 0 && (
            <Empty>Join a course to start tracking your learning.</Empty>
          )}
        </Box>
      </div>
      <Box title="Topics to revisit">
        {d.weakTopics.map((t, i) => (
          <div
            key={i}
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <div>
              <p className="font-semibold">{t.topic}</p>
              <p className="text-sm text-muted-foreground">
                {t.misses} missed questions out of {t.attempts}
              </p>
            </div>
            {t.documentId && (
              <Go href={`/document/${t.documentId}`} tone="accent">Review topic</Go>
            )}
          </div>
        ))}
        {!d.weakTopics.length && (
          <Empty>
            Complete quizzes to discover which topics need more practice.
          </Empty>
        )}
      </Box>
    </>
  );
}
