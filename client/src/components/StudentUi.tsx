import type { ReactNode } from "react";
import { AnimatedProgressRing } from "./motion/AnimatedProgress";
import {
  BookOpen,
  CalendarDays,
  Bell,
  ClipboardList,
  Layers,
  TrendingUp,
  GraduationCap,
} from "lucide-react";

const icons = {
  courses: GraduationCap,
  library: BookOpen,
  planner: CalendarDays,
  flashcards: Layers,
  quizzes: ClipboardList,
  progress: TrendingUp,
  notifications: Bell,
  dashboard: GraduationCap,
};
export function StudentArt({ kind = "courses" }: { kind?: string }) {
  const Icon = icons[kind as keyof typeof icons] || GraduationCap;
  return (
    <div aria-hidden="true" className={`student-art student-art-${kind}`}>
      <div className="student-art-orbit" />
      <div className="student-art-picture" />
      <Icon className="student-art-fallback" />
    </div>
  );
}
export function StudentHero({
  title,
  description,
  kind,
  eyebrow = "Course-Specific AI / Student workspace",
  children,
}: {
  title: string;
  description?: string;
  kind?: string;
  eyebrow?: string;
  children?: ReactNode;
}) {
  const Icon = icons[kind as keyof typeof icons] || BookOpen;
  return (
    <header
      className={`student-hero ${kind ? `student-hero-${kind}` : "student-hero-plain"}`}
    >
      <div className="student-hero-copy">
        {kind && ["courses", "library", "planner"].includes(kind) && (
          <span aria-hidden="true" className="student-hero-leading">
            <Icon />
          </span>
        )}
        <p className="student-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="student-description">{description}</p>}
        {children}
      </div>
      {kind && <StudentArt kind={kind} />}
    </header>
  );
}
export function StudentRing({
  value,
  label,
}: {
  value: number;
  label?: string;
}) {
  return (
    <div
      className="student-ring"
      role="progressbar" aria-valuenow={Math.round(Math.min(100, Math.max(0, value)))} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Learning progress"}
    >
      <AnimatedProgressRing value={value} />
      <div>
        <strong>{Math.round(value)}%</strong>
        {label && <small>{label}</small>}
      </div>
    </div>
  );
}
