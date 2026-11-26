import { type ReactNode } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState } from "@/components/QueryState";

import { storagePut } from "@/lib/storage";
import { apiUrl } from "@/lib/apiBaseUrl";

import { AnimatedCard } from "@/components/motion/AnimatedCard";
import { AnimatedStatValue } from "@/components/motion/AnimatedStatValue";

import { BookOpen, Target, Flame, Clock, CalendarDays, Upload, Sparkles, BarChart3, ClipboardList, Plus, Search } from "lucide-react";

export const panel =
  "student-panel rounded-2xl border bg-card p-5 shadow-sm space-y-4";
export const grid = "grid gap-4 md:grid-cols-2 xl:grid-cols-3";
export const fail = (error: { message: string }) => toast.error(error.message);
export function studentHref(href: string) {
  return href.replace("/(tabs)/", "/student/");
}
export function fileHref(url: string) {
  return /^https?:\/\//i.test(url) ? url : apiUrl(url);
}
export function Box({ title, children }: { title: string; children: ReactNode }) {
  const Icon =
    title.includes("focus") ||
    title.includes("calendar") ||
    title === "Calendar"
      ? CalendarDays
      : title.includes("goals") || title.includes("revisit")
        ? Target
        : title.includes("tasks")
          ? ClipboardList
          : title.includes("AI") || title.includes("Quick")
            ? Sparkles
            : title.includes("progress") || title.includes("summary")
              ? BarChart3
              : title.includes("Join")
                ? Plus
                : title.includes("Upload")
                  ? Upload
                  : title.includes("Recent")
                    ? Clock
                    : title.includes("Filters")
                      ? Search
                      : BookOpen;
  return (
    <section className={panel}>
      <h2 className="student-panel-title">
        <span className="student-icon">
          <Icon />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
export function State({
  query,
}: {
  query: {
    isLoading: boolean;
    error: { message: string } | null;
    refetch: () => unknown;
  };
}) {
  if (query.isLoading)
    return <LoadingState />;
  if (query.error)
    return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  return null;
}
export function Go({
  href,
  children,
  tone = "primary",
}: {
  href: string;
  children: ReactNode;
  tone?: "primary" | "accent" | "neutral";
}) {
  return (
    <Link
      href={studentHref(href)}
      className={`student-go student-go--${tone} inline-flex items-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800`}
    >
      {children}
    </Link>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <EmptyState>{children}</EmptyState>;
}

export function Stats({
  data,
}: {
  data: {
    courses: number;
    quizAccuracy: number | null;
    streak: number;
    studyMinutes: number;
  };
}) {
  return (
    <div className="student-stats">
      {[
        [
          "Enrolled courses",
          data.courses,
          "Keep exploring new courses",
          BookOpen,
        ],
        [
          "Quiz accuracy",
          data.quizAccuracy === null ? "—" : `${data.quizAccuracy}%`,
          "Across your quiz attempts",
          Target,
        ],
        ["Day streak", data.streak, "Keep going!", Flame],
        ["Study minutes", data.studyMinutes, "Stay consistent", Clock],
      ].map(([label, value, hint, Icon]: any, index: number) => (
        <AnimatedCard as="section" className="student-panel student-stat" key={label} delay={index * .05}>
          <span className="student-icon">
            <Icon />
          </span>
          <div>
            <p>{label}</p>
            <strong><AnimatedStatValue value={value} /></strong>
            <small>{hint}</small>
          </div>
        </AnimatedCard>
      ))}
    </div>
  );
}

export async function upload(file: File) {
  const stored = await storagePut(
    `uploads/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
    await file.arrayBuffer(),
    file.type || "application/octet-stream"
  );
  return {
    fileUrl: stored.url,
    fileKey: stored.key,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  };
}
