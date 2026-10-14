import type { ReactNode } from "react";
import { Link } from "wouter";
import {
  BookMarked,
  Building2,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  MessageSquareText,
  MoreVertical,
  Presentation,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiUrl } from "@/lib/apiBaseUrl";
import { AnimatedCard } from "@/components/motion/AnimatedCard";
import { AnimatedProgressRing } from "@/components/motion/AnimatedProgress";
import { AnimatedStatValue } from "@/components/motion/AnimatedStatValue";

export type Tone =
  | "green"
  | "blue"
  | "purple"
  | "orange"
  | "red"
  | "rose"
  | "slate";

export const COURSE_COVER = "/images/course-cover.jpg";

export function courseCoverSrc(url: string | null | undefined) {
  if (!url) return COURSE_COVER;
  return /^https?:\/\//i.test(url) ? url : apiUrl(url);
}

export function Tile({
  icon: Icon,
  tone,
  small,
}: {
  icon: LucideIcon;
  tone: Tone;
  small?: boolean;
}) {
  return (
    <span
      className={`sc-tile sc-tone-${tone}${small ? " sc-tile--sm" : ""}`}
      aria-hidden
    >
      <Icon />
    </span>
  );
}

export function CourseCard({
  icon,
  tone,
  title,
  subtitle,
  action,
  children,
}: {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AnimatedCard as="section" className="sc-card" tilt={false}>
      <header className="sc-card-head">
        <Tile icon={icon} tone={tone} />
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {action}
      </header>
      {children}
    </AnimatedCard>
  );
}

export function ViewAll({
  onClick,
  label = "View all",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button type="button" className="sc-btn sc-btn--outline" onClick={onClick}>
      {label}
    </button>
  );
}

export function CourseEmpty({
  icon: Icon,
  title,
  children,
  boxed,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  boxed?: boolean;
}) {
  return (
    <div className={`sc-empty${boxed ? " sc-empty--boxed" : ""}`}>
      <span className="sc-empty-icon" aria-hidden>
        <Icon />
      </span>
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className="sc-ring" role="img" aria-label={`Course progress ${pct}%`}>
      <AnimatedProgressRing value={pct} />
      <div className="sc-ring-label">
        <strong>{pct}%</strong>
        <small>Course progress</small>
      </div>
    </div>
  );
}

export function CourseHeader({
  course,
  counts,
}: {
  course:
    | {
        title: string;
        code: string;
        subject: string | null;
        description: string | null;
        coverImageUrl: string | null;
        lecturerName: string | null;
        progressPct: number;
      }
    | undefined;
  counts: { materials: number; quizzes: number; assignments: number };
}) {
  const stats: Array<{
    icon: LucideIcon;
    tone: Tone;
    value: number;
    label: string;
  }> = [
    {
      icon: FileText,
      tone: "green",
      value: counts.materials,
      label: "Materials",
    },
    {
      icon: MessageSquareText,
      tone: "purple",
      value: counts.quizzes,
      label: "Quizzes",
    },
    {
      icon: ClipboardList,
      tone: "orange",
      value: counts.assignments,
      label: "Assignments",
    },
  ];
  return (
    <AnimatedCard className="sc-head" tilt={false}>
      <img className="sc-cover" src={courseCoverSrc(course?.coverImageUrl)} alt="" />
      <div className="sc-head-copy">
        <p className="sc-eyebrow">Course</p>
        <h1 className="sc-title">{course?.title ?? "Course"}</h1>
        {course && (
          <div className="sc-meta">
            <span>
              <BookMarked /> {course.code}
            </span>
            {(course.subject || course.lecturerName) && (
              <>
                <span aria-hidden>·</span>
                <span>
                  <Building2 /> {course.subject || course.lecturerName}
                </span>
              </>
            )}
          </div>
        )}
        <p className="sc-desc">
          {course?.description?.trim() ||
            "Learn with lectures, materials, quizzes, and AI support from your lecturer."}
        </p>
      </div>
      <div className="sc-progress">
        <ProgressRing value={course?.progressPct ?? 0} />
        <ChevronRight className="sc-progress-arrow" aria-hidden />
        <div className="sc-stats">
          {stats.map(s => (
            <div className="sc-stat" key={s.label}>
              <Tile icon={s.icon} tone={s.tone} small />
              <strong><AnimatedStatValue value={s.value} /></strong>
              {s.label}
            </div>
          ))}
        </div>
      </div>
    </AnimatedCard>
  );
}

export function formatFileSize(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function materialLook(doc: {
  fileName: string;
  mimeType?: string | null;
  materialType?: string | null;
}): {
  icon: LucideIcon;
  tone: Tone;
} {
  const name = doc.fileName.toLowerCase();
  if (
    doc.materialType === "slides" ||
    doc.materialType === "pptx" ||
    /\.(pptx?|key)$/.test(name)
  )
    return { icon: Presentation, tone: "blue" };
  if (doc.mimeType?.includes("pdf") || name.endsWith(".pdf"))
    return { icon: FileText, tone: "red" };
  if (/\.docx?$/.test(name)) return { icon: FileText, tone: "blue" };
  return { icon: FileText, tone: "slate" };
}

export function MaterialTile({
  doc,
  delay = 0,
}: {
  delay?: number;
  doc: {
    id: number;
    title: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    mimeType?: string | null;
    materialType?: string | null;
  };
}) {
  const look = materialLook(doc);
  const href = /^https?:\/\//i.test(doc.fileUrl)
    ? doc.fileUrl
    : apiUrl(doc.fileUrl);
  return (
    <AnimatedCard as="article" className="sc-material" delay={delay}>
      <div className="sc-material-top">
        <Tile icon={look.icon} tone={look.tone} small />
        <Link href={`/document/${doc.id}`}>{doc.title}</Link>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="sc-kebab"
            aria-label={`More options for ${doc.title}`}
          >
            <MoreVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/document/${doc.id}`}>
                <Sparkles className="size-4" /> View notes &amp; ask AI
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={href} target="_blank" rel="noreferrer">
                <Download className="size-4" /> Open file
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="sc-material-body">
        <p title={doc.fileName}>{doc.fileName}</p>
        <p>{formatFileSize(doc.fileSize)}</p>
      </div>
    </AnimatedCard>
  );
}
