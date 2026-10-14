import { getStudentPreferences } from "@/lib/studentPreferences";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import DashboardLayout from "@/components/DashboardLayout";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { trpc } from "@/lib/trpc";
import { storagePut } from "@/lib/storage";
import { apiUrl } from "@/lib/apiBaseUrl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AIChatBox } from "@/components/AIChatBox";
import { AddPlanToPlanner } from "@/components/AddPlanToPlanner";
import { DocumentChatBox } from "@/components/DocumentChatBox";
import { DocumentProcessingStatus } from "@/components/DocumentProcessingStatus";
import { AnimatedCard } from "@/components/motion/AnimatedCard";
import { AnimatedStatValue } from "@/components/motion/AnimatedStatValue";
import { AnimatedPage } from "@/components/motion/AnimatedPage";
import { documentPreviewKind, DOCUMENT_ACCEPT } from "@shared/documentPreview";
import { FlashcardComponent } from "@/components/FlashcardComponent";
import { QuizComponent } from "@/components/QuizComponent";
import { AcademicSetup } from "@/components/student/AcademicSetup";
import {
  LIMITS,
  titleFromFileName,
  validateCourseCode,
  validateFutureDate,
  validateNumber,
  validateText,
} from "@shared/validation";
import { FieldError } from "@/components/FieldError";
import { useFieldErrors } from "@/lib/formValidation";

import FlashcardReview from "./FlashcardReview";
import { MockExamLauncher, MockExamPage } from "./MockExam";
import { CourseDiscussion, DiscussionThread } from "@/components/CourseDiscussion";
import { AudioRecap } from "@/components/AudioRecap";
import { StudentHero, StudentRing } from "@/components/StudentUi";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  BookOpen,
  Target,
  Flame,
  Clock,
  CalendarDays,
  FileText,
  ArrowRight,
  Bell,
  Upload,
  Sparkles,
  BarChart3,
  ClipboardList,
  Mail,
  Plus,
  Search,
  Layers,
  Maximize2,
  Megaphone,
  Minimize2,
  ChevronRight,
  MessageSquareText,
  MessagesSquare,
} from "lucide-react";
import {
  courseCoverSrc,
  CourseCard,
  CourseEmpty,
  CourseHeader,
  MaterialTile,
  Tile,
  ViewAll,
} from "@/components/student/CoursePage";

const panel =
  "student-panel rounded-2xl border bg-card p-5 shadow-sm space-y-4";
const grid = "grid gap-4 md:grid-cols-2 xl:grid-cols-3";
const fail = (error: { message: string }) => toast.error(error.message);
export function studentHref(href: string) {
  return href.replace("/(tabs)/", "/student/");
}
function fileHref(url: string) {
  return /^https?:\/\//i.test(url) ? url : apiUrl(url);
}
function Box({ title, children }: { title: string; children: ReactNode }) {
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
function State({
  query,
}: {
  query: {
    isLoading: boolean;
    error: { message: string } | null;
    refetch: () => unknown;
  };
}) {
  if (query.isLoading)
    return (
      <p role="status" className="p-6 text-muted-foreground">
        Loading...
      </p>
    );
  if (query.error)
    return (
      <div role="alert" className={panel}>
        <p>{query.error.message}</p>
        <Button variant="outline" onClick={() => query.refetch()}>
          Try again
        </Button>
      </div>
    );
  return null;
}
function Go({
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
function Empty({ children }: { children: ReactNode }) {
  return <p className="py-4 text-muted-foreground">{children}</p>;
}

export default function StudentPortal() {
  const { loading, isAllowed } = useRoleGuard("user");
  if (loading || !isAllowed)
    return (
      <p className="p-8" role="status">
        Loading your workspace...
      </p>
    );
  return (
    <DashboardLayout>
      <StudentWorkspace />
    </DashboardLayout>
  );
}
function StudentWorkspace() {
  const [location] = useLocation();
  const { user } = useAuth();
  const onboarding = trpc.studentLearning.onboardingStatus.useQuery();
  if (!onboarding.data) return <State query={onboarding} />;
  if (!onboarding.data.completed) return <Onboarding />;
  const course = location.match(/^\/course\/(\d+)$/);
  const document = location.match(/^\/document\/(\d+)$/);
  const exam = location.match(/^\/exam\/(\d+)$/);
  const discussion = location.match(/^\/discussion\/(\d+)$/);
  const page = location.split("/")[2] || "dashboard";
  let content: ReactNode;
  let title: string;
  if (course) {
    title = "My course";
    content = <Course key={course[1]} id={Number(course[1])} />;
  } else if (exam) {
    title = "Mock exam";
    content = <MockExamPage key={exam[1]} id={Number(exam[1])} />;
  } else if (discussion) {
    title = "Course discussion";
    content = <DiscussionPage key={discussion[1]} id={Number(discussion[1])} />;
  } else if (document) {
    title = "Study workspace";
    content = <Document key={document[1]} id={Number(document[1])} />;
  } else {
    const pages: Record<string, [string, ReactNode]> = {
      dashboard: ["My learning", <Dashboard />],
      courses: ["My courses", <Courses />],
      library: ["My library", <Library />],
      documents: ["My library", <Library />],
      flashcards: ["Flashcards", <Library mode="flashcards" />],
      quizzes: ["Quizzes", <Quizzes />],
      askai: ["Ask AI", <AskAI />],
      planner: ["Study planner", <Planner />],
      progress: ["Learning progress", <Progress />],
      notifications: ["Notifications", <Notifications />],
    };
    [title, content] = pages[page] ?? ["My learning", <Dashboard />];
  }
  const descriptions: Record<string, string> = {
    courses:
      "Access your enrolled courses, materials, and announcements all in one place.",
    library:
      "Upload, organize, and access all your study materials in one place.",
    documents:
      "Upload, organize, and access all your study materials in one place.",
    planner:
      "Set goals, organize your tasks, and stay consistent with your learning journey.",
    flashcards:
      "Review key concepts, strengthen your memory, and prepare for quizzes and exams.",
    quizzes:
      "Test your knowledge, track your progress, and strengthen your understanding.",
    progress:
      "Track your performance, identify strengths, and focus on what to improve.",
    notifications:
      "Stay updated with important announcements, assignments, and activity from your courses.",
  };
  return (
    <AnimatedPage routeKey={location} className={`student-content student-page-${page}`}>
      {page !== "dashboard" && !course && (
        <StudentHero
          title={
            page === "courses"
              ? `Keep learning, ${user?.name || "student"}`
              : page === "planner"
                ? "Plan your success"
                : title
          }
          description={descriptions[page]}
          kind={!course && !document && page !== "askai" ? page : undefined}
          eyebrow={
            page === "courses"
              ? "My courses"
              : page === "library"
                ? "Learning resources"
                : page === "planner"
                  ? "Study planner"
                  : undefined
          }
        />
      )}
      {content}
    </AnimatedPage>
  );
}

function Onboarding() {
  const utils = trpc.useUtils();
  const query = trpc.studentLearning.onboardingStatus.useQuery();
  const catalogue = trpc.academics.catalogue.useQuery();
  if (!query.data) return <State query={query} />;
  if (!catalogue.data) return <State query={catalogue} />;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Complete your student profile</h1>
      <p>Enter your academic details to continue to your dashboard. All fields are required.</p>
      <AcademicSetup profile={query.data.profile} catalogue={catalogue.data} onDone={() => utils.invalidate()} />
    </div>
  );
}

function Dashboard() {
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
        title={`${d.student.name || "Student"} 👋`}
        description="Your learning journey continues. Stay consistent and keep making progress!"
      >
        <Go href={d.continueLearning?.href || "/student/courses"}>
          ▷ &nbsp; Continue learning
        </Go>
        <blockquote>
          A little progress
          <br />
          every day adds up
          <br />
          to big results.
        </blockquote>
      </StudentHero>
      <Stats data={d.progress} />
      <div className="student-dashboard-grid">
        <Box title="Today's focus">
          <Link className="student-view" href="/student/planner">
            View all →
          </Link>
          {d.today.map(t => (
            <div key={t.id} className="student-task">
              <span className="student-icon">
                <BookOpen />
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
                <div className="student-course-progress">
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
        <Box title="Quick actions">
          <div className="student-quick-actions">
            {[
              ["Ask AI", "Get study help", "askai"],
              ["Upload material", "Add notes or files", "library"],
              ["Plan your study", "Create a study plan", "planner"],
              ["View progress", "Check your progress", "progress"],
            ].map(([label, detail, href], i) => {
              const Icon = [Sparkles, Upload, CalendarDays, BarChart3][i];
              return (
                <Link key={href} href={`/student/${href}`}>
                  <span className="student-icon">
                    <Icon />
                  </span>
                  <div>
                    <h3>{label}</h3>
                    <small>{detail}</small>
                  </div>
                </Link>
              );
            })}
          </div>
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
function Stats({
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
function Courses() {
  const query = trpc.studentCourses.list.useQuery();
  const utils = trpc.useUtils();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const enroll = trpc.studentCourses.enroll.useMutation({
    onSuccess: async () => {
      setCode("");
      toast.success("Course joined");
      await utils.invalidate();
    },
    onError: fail,
  });
  return (
    <>
      <Box title="Join a course">
        <aside className="student-course-code-help">
          <strong>Where to find the course code?</strong>
          <p>
            Your lecturer will provide a course code, usually found in the
            course announcement or syllabus.
          </p>
        </aside>
        <p className="student-muted">
          Enter the course code provided by your lecturer to enroll in a new
          course.
        </p>
        <form
          className="flex flex-wrap gap-3"
          noValidate
          onSubmit={e => {
            e.preventDefault();
            const error = validateCourseCode(code);
            setCodeError(error);
            if (!error) enroll.mutate({ code: code.trim().toUpperCase() });
          }}
        >
          <div className="w-full max-w-xs space-y-1.5">
            <Input
              aria-label="Course code"
              placeholder="Enter your lecturer's course code"
              value={code}
              aria-invalid={Boolean(codeError)}
              onChange={e => {
                setCode(e.target.value.toUpperCase().replace(/\s+/g, ""));
                setCodeError(null);
              }}
              maxLength={10}
            />
            <FieldError message={codeError} />
          </div>
          <Button disabled={enroll.isPending}>Join course</Button>
        </form>
      </Box>
      <div className="student-toolbar">
        <span className="student-filter active">
          All courses ({query.data?.length ?? "—"})
        </span>
        <Input
          aria-label="Search my courses"
          placeholder="Search my courses..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <State query={query} />
      <div className="student-course-grid">
        {query.data
          ?.filter(c =>
            `${c.title} ${c.code} ${c.subject}`
              .toLowerCase()
              .includes(search.toLowerCase())
          )
          .map((c, index) => (
            <AnimatedCard as="article" className="student-panel student-course-card" key={c.id} delay={index * .05}>
              <div className="student-course-cover">
                <img src={courseCoverSrc(c.coverImageUrl)} alt="" />
                <span>Enrolled</span>
              </div>
              <div>
                <h2>
                  <Link href={`/course/${c.id}`} className="student-course-open">
                    {c.title}
                  </Link>
                </h2>
                <p>
                  {c.code} · {c.subject || c.lecturerName}
                </p>
                <p className="student-course-description">Course progress</p>
                <div className="student-course-progress">
                  <div>
                    <span style={{ width: `${c.progressPct}%` }} />
                  </div>
                  <small>{c.progressPct}%</small>
                </div>
                <div className="student-course-links">
                  <Link href={`/course/${c.id}?tab=materials`}>
                    <FileText />
                    Materials
                  </Link>
                  <Link href={`/course/${c.id}?tab=assignments`}>
                    <ClipboardList />
                    Assignments
                  </Link>
                  <Link href={`/course/${c.id}`}>
                    <Megaphone />
                    Announcements
                  </Link>
                </div>
              </div>
            </AnimatedCard>
          ))}
      </div>
      {query.data?.length === 0 && (
        <Empty>You haven't joined a course yet.</Empty>
      )}
    </>
  );
}
function Course({ id }: { id: number }) {
  const courses = trpc.studentCourses.list.useQuery();
  const materials = trpc.studentCourses.materials.useQuery({ courseId: id });
  const announcements = trpc.studentCourses.announcements.useQuery({
    courseId: id,
  });
  const assignments = trpc.studentCourses.assignments.useQuery({
    courseId: id,
  });
  const quizzes = trpc.studentCourses.quizzes.useQuery({ courseId: id });
  const activity = trpc.studentLearning.recordActivity.useMutation();
  const [tab, setTab] = useState<CourseTab>(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    return COURSE_TABS.find(([key]) => key === requested)?.[0] ?? "overview";
  });
  const [openQuiz, setOpenQuiz] = useState<number | null>(null);
  const [allNews, setAllNews] = useState(false);
  useEffect(() => {
    activity.mutate({ type: "COURSE_OPENED", courseId: id });
  }, [id]);
  const course = courses.data?.find(c => c.id === id);
  const docTitle = new Map(materials.data?.map(d => [d.id, d.title]));
  const quizDetail = (q: { documentId: number | null; score: string | number | null; completedAt: Date | null }) =>
    [docTitle.get(q.documentId ?? 0) ?? course?.title, q.completedAt && q.score !== null ? `Last score ${Math.round(Number(q.score))}%` : null]
      .filter(Boolean)
      .join(" · ");
  const go = (next: CourseTab) => {
    setTab(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const materialsCard = (all: boolean) => (
    <CourseCard
      icon={BookOpen}
      tone="green"
      title="Course materials"
      subtitle="Access lecture notes, slides, and additional resources."
      action={!all && <ViewAll onClick={() => go("materials")} />}
    >
      <State query={materials} />
      {materials.data?.length === 0 ? (
        <CourseEmpty icon={FileText} title="No materials yet">
          Your lecturer hasn't published any materials for this course yet.
        </CourseEmpty>
      ) : (
        <div className={`sc-materials${all ? " sc-materials--wide" : ""}`}>
          {(all ? materials.data : materials.data?.slice(0, 3))?.map((d, index) => (
            <MaterialTile key={d.id} doc={d} delay={index * .05} />
          ))}
        </div>
      )}
    </CourseCard>
  );
  const quizzesCard = (all: boolean) => (
    <CourseCard
      icon={MessageSquareText}
      tone="purple"
      title="Course quizzes"
      subtitle="Test your understanding and track your performance."
      action={!all && <ViewAll onClick={() => go("quizzes")} />}
    >
      <State query={quizzes} />
      {quizzes.data?.length === 0 ? (
        <CourseEmpty icon={MessageSquareText} title="No quizzes yet">
          Your lecturer hasn't published any quizzes for this course yet.
        </CourseEmpty>
      ) : (
        <div className="sc-list">
          {(all ? quizzes.data : quizzes.data?.slice(0, 2))?.map(q => (
            <CourseQuiz
              key={q.id}
              id={q.id}
              title={q.title}
              detail={quizDetail(q)}
              open={all && openQuiz === q.id}
              onToggle={() => {
                if (!all) go("quizzes");
                setOpenQuiz(all && openQuiz === q.id ? null : q.id);
              }}
            />
          ))}
        </div>
      )}
    </CourseCard>
  );
  const discussionCard = (all: boolean) => (
    <CourseCard
      icon={MessagesSquare}
      tone="green"
      title="Course discussion"
      subtitle="Ask questions, help classmates, and discuss course topics."
      action={!all && <ViewAll onClick={() => go("discussion")} />}
    >
      <CourseDiscussion courseId={id} limit={all ? undefined : 3} />
    </CourseCard>
  );
  if (courses.data && !course)
    return (
      <div className="sc-page">
        <section className="sc-card flex flex-col items-center gap-3">
          <CourseEmpty icon={BookOpen} title="You're not enrolled in this course">
            Join it with the enrolment code from your lecturer, then it will appear in My courses.
          </CourseEmpty>
          <Link href="/student/courses" className="sc-btn sc-btn--solid">
            Go to My courses
          </Link>
        </section>
      </div>
    );
  return (
    <div className="sc-page">
      <CourseHeader
        course={course}
        counts={{
          materials: materials.data?.length ?? 0,
          quizzes: quizzes.data?.length ?? 0,
          assignments: assignments.data?.length ?? 0,
        }}
      />
      <div className="sc-tabs" role="tablist" aria-label="Course sections">
        {COURSE_TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`course-tab-${key}`}
            aria-controls="course-tab-panel"
            aria-selected={tab === key}
            tabIndex={tab === key ? 0 : -1}
            className="sc-tab"
            onClick={() => setTab(key)}
            onKeyDown={event => {
              const index = COURSE_TABS.findIndex(([value]) => value === key);
              const next = event.key === "ArrowRight" ? (index + 1) % COURSE_TABS.length
                : event.key === "ArrowLeft" ? (index + COURSE_TABS.length - 1) % COURSE_TABS.length
                : event.key === "Home" ? 0 : event.key === "End" ? COURSE_TABS.length - 1 : -1;
              if (next < 0) return;
              event.preventDefault();
              setTab(COURSE_TABS[next][0]);
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div id="course-tab-panel" role="tabpanel" aria-labelledby={`course-tab-${tab}`}>
      <AnimatedPage routeKey={tab}>
      {tab === "overview" && (
        <>
          <div className="sc-grid">
            {materialsCard(false)}
            <CourseCard
              icon={Megaphone}
              tone="green"
              title="Announcements"
              subtitle="Stay updated with important course information."
              action={
                (announcements.data?.length ?? 0) > 2 && (
                  <ViewAll onClick={() => setAllNews(!allNews)} label={allNews ? "Show less" : "View all"} />
                )
              }
            >
              <State query={announcements} />
              {announcements.data?.length === 0 ? (
                <CourseEmpty icon={Megaphone} title="No announcements yet">
                  Your lecturer hasn't posted any announcements for this course yet. Check back later.
                </CourseEmpty>
              ) : (
                <div className="sc-list">
                  {(allNews ? announcements.data : announcements.data?.slice(0, 2))?.map(a => (
                    <article key={a.id} className="sc-row items-start">
                      <Tile icon={Megaphone} tone="green" small />
                      <div>
                        <h3>{a.title}</h3>
                        <p className="!whitespace-pre-wrap !line-clamp-3">{a.content}</p>
                        <p>{new Date(a.createdAt).toLocaleDateString()}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </CourseCard>
            <CourseCard
              icon={FileText}
              tone="blue"
              title="Assignments"
              subtitle="View and submit your course assignments."
              action={<ViewAll onClick={() => go("assignments")} />}
            >
              <State query={assignments} />
              {assignments.data?.length === 0 ? (
                <CourseEmpty icon={FileText} title="No assignments yet">
                  Your lecturer hasn't added any assignments for this course yet.
                </CourseEmpty>
              ) : (
                <div className="sc-list">
                  {assignments.data?.slice(0, 2).map(a => (
                    <div key={a.id} className="sc-row">
                      <Tile icon={ClipboardList} tone="blue" />
                      <div>
                        <h3>{a.title}</h3>
                        <p>{a.dueDate ? `Due ${new Date(a.dueDate).toLocaleString()}` : "No deadline"}</p>
                      </div>
                      <button type="button" className="sc-btn sc-btn--outline" onClick={() => go("assignments")}>
                        Open <ArrowRight />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CourseCard>
            {quizzesCard(false)}
          </div>
          <MockExamLauncher courseId={id} onMore={() => go("exam")} />
          {discussionCard(false)}
        </>
      )}
      {tab === "materials" && materialsCard(true)}
      {tab === "quizzes" && quizzesCard(true)}
      {tab === "assignments" && (
        <CourseCard
          icon={FileText}
          tone="blue"
          title="Assignments"
          subtitle="View and submit your course assignments."
        >
          <State query={assignments} />
          {assignments.data?.length === 0 ? (
            <CourseEmpty icon={FileText} title="No assignments yet">
              Your lecturer hasn't added any assignments for this course yet.
            </CourseEmpty>
          ) : (
            assignments.data?.map(a => <Assignment key={a.id} assignment={a} courseId={id} />)
          )}
        </CourseCard>
      )}
      {tab === "exam" && <MockExamLauncher courseId={id} />}
      {tab === "discussion" && discussionCard(true)}
      </AnimatedPage>
      </div>
    </div>
  );
}

type CourseTab = "overview" | "materials" | "quizzes" | "assignments" | "exam" | "discussion";
const COURSE_TABS: Array<[CourseTab, string]> = [
  ["overview", "Overview"],
  ["materials", "Materials"],
  ["quizzes", "Quizzes"],
  ["assignments", "Assignments"],
  ["exam", "Mock exam"],
  ["discussion", "Discussion"],
];

function CourseQuiz({
  id,
  title,
  detail,
  open,
  onToggle,
}: {
  id: number;
  title: string;
  detail: string;
  open: boolean;
  onToggle: () => void;
}) {
  const query = trpc.quizzes.get.useQuery({ quizId: id }, { enabled: open });
  const utils = trpc.useUtils();
  return (
    <div className="space-y-4">
      <div className="sc-row">
        <Tile icon={ClipboardList} tone="rose" />
        <div>
          <h3>{/^quiz\b/i.test(title) ? title : `Quiz: ${title}`}</h3>
          {detail && <p>{detail}</p>}
        </div>
        <button type="button" className="sc-btn sc-btn--rose" onClick={onToggle}>
          {open ? "Close quiz" : "Take quiz"} <ChevronRight />
        </button>
      </div>
      {open && (
        <>
          <State query={query} />
          {query.data && (
            <QuizComponent
              quiz={query.data}
              onComplete={() => {
                void utils.progress.invalidate();
                void utils.studentCourses.invalidate();
                void utils.studentLearning.dashboard.invalidate();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
function DiscussionPage({ id }: { id: number }) {
  const [, navigate] = useLocation();
  const thread = trpc.discussions.get.useQuery({ threadId: id });
  return (
    <DiscussionThread
      threadId={id}
      onBack={() => navigate(thread.data ? `/course/${thread.data.courseId}` : "/student/courses")}
    />
  );
}
async function upload(file: File) {
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
function Assignment({
  assignment: a,
  courseId,
}: {
  assignment: {
    id: number;
    title: string;
    description: string | null;
    dueDate: Date | null;
  };
  courseId: number;
}) {
  const query = trpc.assignments.mySubmission.useQuery({ assignmentId: a.id });
  const utils = trpc.useUtils();
  const submit = trpc.assignments.submit.useMutation();
  const [busy, setBusy] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  return (
    <article className="space-y-3 rounded-xl border p-4">
      <h3 className="font-semibold">{a.title}</h3>
      <p className="whitespace-pre-wrap">{a.description}</p>
      <p className="text-sm">
        {a.dueDate
          ? `Due ${new Date(a.dueDate).toLocaleString()}`
          : "No deadline"}
      </p>
      <State query={query} />
      {query.data && (
        <div className="rounded-lg bg-emerald-50 p-3 text-emerald-950">
          <p>
            Status: {query.data.status}{" "}
            {query.data.grade !== null ? ` · Grade: ${query.data.grade}` : ""}
          </p>
          <p>{query.data.feedback}</p>
          <p className="whitespace-pre-wrap">{query.data.note}</p>
          {query.data.fileUrl && (
            <a
              className="underline"
              href={fileHref(query.data.fileUrl)}
              target="_blank"
              rel="noreferrer"
            >
              {query.data.fileName || "Submitted file"}
            </a>
          )}
        </div>
      )}
      <form
        className="space-y-3"
        onSubmit={async e => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          const file = data.get("file") as File;
          const note = String(data.get("note") || "").trim();
          const error =
            !note && !file?.size && !query.data?.fileUrl
              ? "Add a note or attach a file before submitting."
              : validateText(note, { label: "Note", required: false, max: LIMITS.description });
          setNoteError(error);
          if (error) return;
          setBusy(true);
          try {
            const attachment = file?.size
              ? await upload(file)
              : query.data?.fileUrl
                ? {
                    fileUrl: query.data.fileUrl,
                    fileKey: query.data.fileKey || undefined,
                    fileName: query.data.fileName || undefined,
                    fileSize: query.data.fileSize || undefined,
                    mimeType: query.data.mimeType || undefined,
                  }
                : {};
            await submit.mutateAsync({
              assignmentId: a.id,
              courseId,
              note,
              ...attachment,
            });
            await utils.invalidate();
            toast.success("Assignment submitted");
            form.reset();
          } catch (error) {
            fail(error as Error);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Textarea
          name="note"
          aria-label="Submission note"
          placeholder="Write your answer or submission note"
          maxLength={LIMITS.description}
          aria-invalid={Boolean(noteError)}
          onChange={() => setNoteError(null)}
        />
        <FieldError message={noteError} />
        <Input name="file" aria-label="Assignment attachment" type="file" onChange={() => setNoteError(null)} />
        <Button disabled={busy || query.isLoading || !!query.error}>
          {busy
            ? "Submitting..."
            : query.data
              ? "Resubmit assignment"
              : "Submit assignment"}
        </Button>
      </form>
    </article>
  );
}

function Library({ mode }: { mode?: "flashcards" }) {
  const query = trpc.documents.list.useQuery(undefined, { refetchInterval: query => query.state.data?.some(d => d.processingStatus === "pending" || d.processingStatus === "processing") ? 2500 : false });
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState("All materials");
  const { errors: uploadErrors, check: checkUpload, clear: clearUpload } = useFieldErrors<"title" | "file">();
  const create = trpc.documents.createOwn.useMutation();
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const visibleDocuments = query.data?.filter(
    d =>
      `${d.title} ${d.fileName}`.toLowerCase().includes(search.toLowerCase()) &&
      (category === "All materials" ||
        (category === "Slides"
          ? /\.pptx?$/i
          : category === "Notes"
            ? /\.txt$/i
            : category === "Images"
              ? /\.(png|jpe?g|webp)$/i
              : /\.(pdf|docx?)$/i
        ).test(d.fileName))
  );
  return (
    <>
      {mode && <FlashcardReview />}
      {!mode && (
        <Box title="Upload study material">
          <p className="student-muted">
            Add your notes, slides, or any learning resources.
          </p>
          <form
            className="flex flex-wrap gap-3"
            onSubmit={async e => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const file = form.get("file") as File;
              const title = String(form.get("title") || "");
              const ok = checkUpload({
                title: validateText(title, { label: "Title", required: false, ...LIMITS.title }),
                file: file?.size ? null : "Choose a file to upload.",
              });
              if (!ok) return;
              setBusy(true);
              try {
                const doc = await create.mutateAsync({
                  title: title.trim() || titleFromFileName(file.name),
                  ...(await upload(file)),
                });
                await utils.documents.list.invalidate();
                navigate(`/document/${doc.id}`);
              } catch (error) {
                fail(error as Error);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="w-full max-w-xs space-y-1.5">
              <Input
                name="title"
                aria-label="Document title"
                placeholder="Document title (optional)"
                maxLength={LIMITS.title.max}
                aria-invalid={Boolean(uploadErrors.title)}
                onChange={() => clearUpload("title")}
              />
              <FieldError message={uploadErrors.title} />
            </div>
            <div className="w-full max-w-xs space-y-1.5">
              <Input
                name="file"
                aria-label="Study material file"
                type="file"
                accept={DOCUMENT_ACCEPT}
                aria-invalid={Boolean(uploadErrors.file)}
                onChange={() => clearUpload("file")}
              />
              <FieldError message={uploadErrors.file} />
            </div>
            <Button disabled={busy}>
              {busy ? "Uploading..." : "Upload document"}
            </Button>
          </form>
        </Box>
      )}
      <div className="student-toolbar">
        {!mode && (
          <div className="student-tabs">
            {["All materials", "Documents", "Slides", "Notes", "Images"].map(
              type => (
                <button
                  key={type}
                  className={category === type ? "active" : ""}
                  onClick={() => setCategory(type)}
                >
                  {type}
                </button>
              )
            )}
          </div>
        )}
        <Input
          aria-label="Search documents"
          placeholder="Search your study materials..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <State query={query} />
      <div className={`${grid} student-material-grid`}>
        {visibleDocuments?.map(d => (
          <Box title={d.title} key={d.id}>
            <p className="text-sm text-muted-foreground">{d.fileName}</p>
            <DocumentProcessingStatus doc={d} />
            <div className="student-material-meta">
              <span>
                <CalendarDays />
                {new Date(d.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span>
                <FileText />
                {d.fileSize
                  ? `${(d.fileSize / 1048576).toFixed(1)} MB`
                  : "Size unavailable"}
              </span>
            </div>
            <Go href={`/document/${d.id}${mode ? "?tab=flashcards" : ""}`} tone="accent">
              {mode ? "Review flashcards" : "Open workspace"}
            </Go>
          </Box>
        ))}
      </div>
      {query.data && !visibleDocuments?.length && (
        <Empty>
          No materials found. Upload a document or join a course to get started.
        </Empty>
      )}
    </>
  );
}
function Notes({
  doc,
}: {
  doc: {
    id: number;
    title: string;
    fileName: string;
    fileUrl: string;
    mimeType?: string | null;
    extractedText?: string | null;
  };
}) {
  const url = fileHref(doc.fileUrl);
  const kind = documentPreviewKind(doc);
  const preview = trpc.documents.preview.useQuery({ id: doc.id }, {
    enabled: kind !== "pdf" && kind !== "image",
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const text = doc.extractedText?.trim();
  const sectionRef = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === sectionRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void sectionRef.current?.requestFullscreen?.().catch(() => window.open(url, "_blank", "noreferrer"));
  };
  return (
    <section
      ref={sectionRef}
      className={`student-panel flex min-h-0 flex-col gap-3 border bg-card p-4 shadow-sm ${
        fullscreen ? "h-screen rounded-none" : "h-[calc(100dvh-10rem)] min-h-[560px] rounded-2xl"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold">Notes</h3>
          <p className="truncate text-xs text-muted-foreground">
            {doc.fileName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="default" size="sm" onClick={toggleFullscreen}>
            {fullscreen ? <Minimize2 /> : <Maximize2 />}
            {fullscreen ? "Exit full screen" : "Full screen"}
          </Button>
          <Button asChild variant="neutral" size="sm">
            <a href={url} target="_blank" rel="noreferrer">
              Open in new tab
            </a>
          </Button>
          <Button asChild variant="accent" size="sm">
            <a href={url} download={doc.fileName}>
              Download
            </a>
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {kind === "pdf" ? (
          <iframe
            title={doc.title}
            src={`${url}#view=FitH&navpanes=0`}
            className="h-full w-full rounded-xl border bg-white"
          />
        ) : kind === "image" ? (
          <div className="flex h-full items-center justify-center overflow-auto rounded-xl border bg-white">
            <img src={url} alt={doc.title} className="max-h-full max-w-full" />
          </div>
        ) : preview.data?.html ? (
          <iframe
            title={doc.title}
            srcDoc={preview.data.html}
            sandbox=""
            className="h-full w-full rounded-xl border bg-white"
          />
        ) : preview.isLoading ? (
          <Empty>Preparing document preview…</Empty>
        ) : text ? (
          <article className="mx-auto h-full max-w-4xl overflow-y-auto whitespace-pre-wrap rounded-xl border bg-white p-6 text-[15px] leading-8 text-slate-800">
            {text}
          </article>
        ) : (
          <div className="space-y-3 py-4 text-muted-foreground">
            <p>{preview.error?.message ?? "A preview is unavailable for this document."}</p>
            <Button variant="outline" size="sm" onClick={() => void preview.refetch()}>Retry preview</Button>
            <p>You can also download the original using the button above.</p>
          </div>
        )}
      </div>
    </section>
  );
}
function Document({ id }: { id: number }) {
  const query = trpc.documents.get.useQuery({ id }, { refetchInterval: query => ["pending", "processing"].includes(query.state.data?.processingStatus ?? "") ? 2500 : false });
  const sourceId = new URLSearchParams(window.location.search).get("source") ?? "";
  const source = trpc.documents.source.useQuery({ id, source: sourceId }, { enabled: /^[a-f0-9]{24}$/.test(sourceId), retry: false });
  const [tab, setTab] = useState(
    () => new URLSearchParams(window.location.search).get("tab") || "notes"
  );
  const activity = trpc.studentLearning.recordActivity.useMutation();
  useEffect(() => {
    if (query.data)
      activity.mutate({ type: "DOCUMENT_OPENED", documentId: id });
  }, [id, query.data?.id]);
  if (!query.data) return <State query={query} />;
  const doc = query.data;
  return (
    <>
      {doc.courseId ? (
        <Go href={`/course/${doc.courseId}`} tone="neutral">Back to course</Go>
      ) : (
        <Go href="/student/library" tone="neutral">Back to library</Go>
      )}
      <h2 className="text-2xl font-semibold">{doc.title}</h2>
      <DocumentProcessingStatus doc={doc} />
      {sourceId && <aside className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <h3 className="font-semibold">Source excerpt</h3>
        {source.data ? <blockquote className="mt-2 whitespace-pre-wrap">{source.data.excerpt}</blockquote> : <p>{source.error?.message ?? "Loading source excerpt…"}</p>}
      </aside>}
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Study tools"
      >
        {["notes", "chat", "summary", "flashcards", "quizzes"].map(t => (
          <Button
            key={t}
            role="tab"
            aria-selected={t === tab}
            variant={t === tab ? "default" : "outline"}
            onClick={() => setTab(t)}
          >
            {t === "notes"
              ? "View notes"
              : t === "chat"
                ? "Ask about document"
                : t[0].toUpperCase() + t.slice(1)}
          </Button>
        ))}
      </div>
      {tab === "notes" && <Notes doc={doc} />}
      {tab === "chat" && <DocumentChatBox documentId={id} height="70vh" />}
      {tab === "summary" && <Summary id={id} />}
      {tab === "flashcards" && <Cards id={id} />}
      {tab === "quizzes" && <DocumentQuizzes id={id} />}
    </>
  );
}
function Summary({ id }: { id: number }) {
  const utils = trpc.useUtils();
  const query = trpc.summary.get.useQuery({ documentId: id });
  const generate = trpc.summary.generate.useMutation({
    onSuccess: () => {
      void query.refetch();
      void utils.audioRecap.get.invalidate({ documentId: id });
    },
    onError: fail,
  });
  return (
    <>
      <AudioRecap documentId={id} />
      <Box title="Document summary">
        <Button
          disabled={generate.isPending}
          onClick={() => generate.mutate({ documentId: id })}
        >
          {generate.isPending ? "Generating..." : "Generate summary"}
        </Button>
        <State query={query} />
        {query.data ? (
          <Streamdown>{query.data.summary}</Streamdown>
        ) : (
          <Empty>Generate a summary to review the key ideas.</Empty>
        )}
      </Box>
    </>
  );
}
function Cards({ id }: { id: number }) {
  const { user } = useAuth();
  const count = getStudentPreferences(user?.id).flashcardCount;
  const query = trpc.flashcards.list.useQuery({ documentId: id });
  const utils = trpc.useUtils();
  const generate = trpc.flashcards.generate.useMutation({
    onSuccess: () => query.refetch(),
    onError: fail,
  });
  return (
    <>
      <FlashcardReview documentId={id} />
      <Button
        disabled={generate.isPending}
        onClick={() => generate.mutate({ documentId: id, count })}
      >
        {generate.isPending ? "Generating..." : `Generate ${count} flashcards`}
      </Button>
      <State query={query} />
      <div className={grid}>
        {query.data?.map(card => (
          <FlashcardComponent
            key={card.id}
            card={card}
            documentId={id}
            onReviewMarked={() => {
              void utils.studentLearning.dashboard.invalidate();
              void utils.progress.invalidate();
            }}
          />
        ))}
      </div>
      {query.data?.length === 0 && (
        <Empty>
          Generate flashcards from this document to start practicing.
        </Empty>
      )}
    </>
  );
}
function QuizEntry({
  id,
  title,
  detail,
}: {
  id: number;
  title: string;
  detail?: string;
}) {
  const [open, setOpen] = useState(false);
  const query = trpc.quizzes.get.useQuery({ quizId: id }, { enabled: open });
  const utils = trpc.useUtils();
  return (
    <div className="student-quiz-entry space-y-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="student-icon">
          <ClipboardList />
        </span>
        <div className="flex-1">
          <h3 className="font-semibold">{title}</h3>
          {detail && <p className="student-muted">{detail}</p>}
        </div>
        <Button variant="outline" onClick={() => setOpen(!open)}>
          {open ? "Close quiz" : "Take quiz"}
        </Button>
      </div>
      {open && (
        <>
          <State query={query} />
          {query.data && (
            <QuizComponent
              quiz={query.data}
              onComplete={() => {
                void utils.progress.invalidate();
                void utils.studentCourses.invalidate();
                void utils.studentLearning.dashboard.invalidate();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
function DocumentQuizzes({ id }: { id: number }) {
  const { user } = useAuth();
  const count = getStudentPreferences(user?.id).quizLength;
  const query = trpc.quizzes.list.useQuery({ documentId: id });
  const generate = trpc.quizzes.generate.useMutation({
    onSuccess: () => query.refetch(),
    onError: fail,
  });
  return (
    <div className="space-y-4">
      <Button
        disabled={generate.isPending}
        onClick={() =>
          generate.mutate({ documentId: id, questionCount: count })
        }
      >
        {generate.isPending ? "Generating..." : "Generate practice quiz"}
      </Button>
      <State query={query} />
      {query.data?.map(q => (
        <QuizEntry key={q.id} id={q.id} title={q.title} />
      ))}
      {query.data?.length === 0 && (
        <Empty>No quizzes yet. Generate one to test your understanding.</Empty>
      )}
    </div>
  );
}
function Quizzes() {
  const query = trpc.studentCourses.allQuizzes.useQuery();
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState("");
  const [status, setStatus] = useState("All quizzes");
  const completed = query.data?.filter(q => q.completedAt) || [];
  const scores = completed.filter(q => q.score !== null);
  const average = scores.length
    ? Math.round(scores.reduce((sum, q) => sum + q.score!, 0) / scores.length)
    : null;
  return (
    <>
      <div className="student-stats">
        {[
          [
            "Total quizzes",
            query.data?.length ?? "—",
            "Across your courses",
            ClipboardList,
          ],
          [
            "Completed",
            query.data ? completed.length : "—",
            "Keep going!",
            Target,
          ],
          [
            "Average score",
            average === null ? "—" : `${average}%`,
            "Latest completed attempts",
            BarChart3,
          ],
          [
            "Not attempted",
            query.data ? query.data.length - completed.length : "—",
            "Ready when you are",
            Clock,
          ],
        ].map(([label, value, hint, Icon]: any) => (
          <section className="student-panel student-stat" key={label}>
            <span className="student-icon">
              <Icon />
            </span>
            <div>
              <p>{label}</p>
              <strong>{value}</strong>
              <small>{hint}</small>
            </div>
          </section>
        ))}
      </div>
      <div className="student-toolbar">
        <div className="student-tabs">
          {["All quizzes", "Completed", "Not attempted"].map(tab => (
            <button
              key={tab}
              className={tab === status ? "active" : ""}
              onClick={() => setStatus(tab)}
            >
              {tab} (
              {query.data
                ? tab === "All quizzes"
                  ? query.data.length
                  : tab === "Completed"
                    ? completed.length
                    : query.data.length - completed.length
                : "—"}
              )
            </button>
          ))}
        </div>
        <Input
          aria-label="Search quizzes"
          placeholder="Search quizzes by course name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          aria-label="Filter quiz course"
          value={course}
          onChange={e => setCourse(e.target.value)}
        >
          <option value="">All courses</option>
          {Array.from(new Set(query.data?.map(q => q.courseTitle))).map(c => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <State query={query} />
      <div className="student-quiz-list">
        {query.data
          ?.filter(
            q =>
              (status === "All quizzes" ||
                (status === "Completed" ? !!q.completedAt : !q.completedAt)) &&
              (!course || q.courseTitle === course) &&
              `${q.title} ${q.courseTitle}`
                .toLowerCase()
                .includes(search.toLowerCase())
          )
          .map(q => (
            <QuizEntry
              key={q.id}
              id={q.id}
              title={q.title}
              detail={`${q.courseTitle} · ${q.totalQuestions} questions · ${q.completedAt ? `Completed${q.score !== null ? ` · ${q.score}%` : ""}` : "Not attempted"}`}
            />
          ))}
        {query.data?.length === 0 && <Empty>No course quizzes yet.</Empty>}
      </div>
      <MockExamLauncher />
      <div className="student-practice">
        <span className="student-icon">
          <BookOpen />
        </span>
        <div>
          <h2>Practice from your materials</h2>
          <p>
            Upload a document and let AI generate or revisit practice questions
            from your study materials.
          </p>
        </div>
        <Go href="/student/library" tone="accent">Choose a document</Go>
      </div>
    </>
  );
}
function AskAI() {
  const query = trpc.generalChat.history.useQuery();
  const utils = trpc.useUtils();
  const [pending, setPending] = useState("");
  const send = trpc.chat.send.useMutation({
    onSuccess: async () => {
      await utils.generalChat.history.invalidate();
      setPending("");
    },
    onError: error => {
      setPending("");
      fail(error);
    },
  });
  const clear = trpc.generalChat.clear.useMutation({
    onSuccess: () => utils.generalChat.history.invalidate(),
    onError: fail,
  });
  const documents = trpc.documents.list.useQuery();
  const [docId, setDocId] = useState(
    () => Number(new URLSearchParams(window.location.search).get("doc")) || 0
  );
  const selected = documents.data?.find(d => d.id === docId);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex flex-wrap items-center gap-2 text-sm font-medium">
          Chat about
          <select
            className="h-9 min-w-[14rem] max-w-full rounded-lg border bg-background px-3 text-sm"
            value={selected ? selected.id : 0}
            onChange={e => setDocId(Number(e.target.value))}
            disabled={documents.isLoading}
          >
            <option value={0}>General study help</option>
            {documents.data?.map(d => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </label>
        {selected && (
          <Go href={`/document/${selected.id}?tab=notes`} tone="neutral">
            View notes
          </Go>
        )}
        {!selected && (
          <Button
            variant="outline"
            disabled={clear.isPending || send.isPending || !query.data?.length}
            onClick={() => {
              if (window.confirm("Clear your AI conversation history?"))
                clear.mutate();
            }}
          >
            Clear conversation
          </Button>
        )}
      </div>
      {selected ? (
        <DocumentChatBox
          key={selected.id}
          documentId={selected.id}
          height="70vh"
        />
      ) : (
        <>
          <State query={query} />
          <AIChatBox
            height="65vh"
            messages={[
              ...(query.data || [])
                .slice()
                .sort((a, b) => a.id - b.id)
                .map(m => ({
                  role: m.role as "user" | "assistant",
                  content: m.content,
                })),
              ...(pending ? [{ role: "user" as const, content: pending }] : []),
            ]}
            isLoading={query.isLoading || send.isPending || clear.isPending}
            isGenerating={send.isPending}
            onSendMessage={message => {
              if (send.isPending) return;
              setPending(message);
              send.mutate({ documentId: 0, message });
            }}
            renderMessageActions={message => <AddPlanToPlanner content={message.content} />}
            emptyStateMessage="Your study companion is ready. Ask for an explanation or help planning your learning."
            suggestedPrompts={[
              "Help me plan my study week",
              "How can I study more effectively?",
            ]}
          />
        </>
      )}
    </>
  );
}
function Progress() {
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
function Notifications() {
  const preferences = trpc.admin.settings.preferences.useQuery();
  const query = trpc.notifications.list.useQuery();
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState("All");
  const refresh = () => utils.notifications.invalidate();
  const read = trpc.notifications.markRead.useMutation({
    onSuccess: refresh,
    onError: fail,
  });
  const all = trpc.notifications.markAllRead.useMutation({
    onSuccess: refresh,
    onError: fail,
  });
  const category = (data: Record<string, unknown> | null) => {
    const type = String(data?.type || "").toLowerCase();
    return type.includes("assignment")
      ? "Assignments"
      : type.includes("quiz")
        ? "Quizzes"
        : type.includes("announcement")
          ? "Announcements"
          : "System";
  };
  const tabs = ["All", "Assignments", "Quizzes", "Announcements", "System"];
  const visible = query.data?.filter(
    n =>
      preferences.data?.notifications?.[
        `student.${category(n.data).toLowerCase()}`
      ] !== false
  );
  const count = (tab: string) =>
    visible?.filter(n => tab === "All" || category(n.data) === tab).length ?? 0;
  return (
    <div className="student-notifications-grid">
      <section className="student-panel student-inbox">
        <div className="student-tabs">
          {tabs.map((tab, i) => {
            const Icon = [Bell, FileText, ClipboardList, Megaphone, Sparkles][
              i
            ];
            return (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={tab === filter ? "active" : ""}
              >
                <Icon />
                {tab}
                <span>{count(tab)}</span>
              </button>
            );
          })}
        </div>
        <State query={query} />
        {visible
          ?.filter(n => filter === "All" || category(n.data) === filter)
          .map(n => (
            <article
              key={n.id}
              className={`student-notification ${n.isRead ? "is-read" : ""}`}
            >
              <span className="student-icon">
                <Bell />
              </span>
              <div>
                <h3>{n.title}</h3>
                <p>{n.body}</p>
                <small>{new Date(n.createdAt).toLocaleString()}</small>
                {typeof n.data?.link === "string" && n.data.link.startsWith("/") && (
                  <Link
                    className="mt-1 inline-block text-sm font-semibold text-[var(--burgundy)] hover:underline"
                    href={n.data.link}
                    onClick={() => !n.isRead && read.mutate({ notificationId: n.id })}
                  >
                    Open →
                  </Link>
                )}
              </div>
              <span className="student-badge">
                {n.data?.type === "ai_coach" ? "AI coach" : category(n.data)}
              </span>
              {!n.isRead && (
                <button
                  className="student-unread"
                  aria-label={`Mark ${n.title} as read`}
                  disabled={read.isPending}
                  onClick={() => read.mutate({ notificationId: n.id })}
                />
              )}
            </article>
          ))}
        {query.data && !count(filter) && (
          <Empty>No notifications in this category.</Empty>
        )}
      </section>
      <aside className="space-y-4">
        <Box title="Notification summary">
          <p className="student-muted">
            A quick overview of your notifications.
          </p>
          <div className="student-summary-grid">
            {tabs.slice(0, 4).map(tab => (
              <button key={tab} onClick={() => setFilter(tab)}>
                <strong>{count(tab)}</strong>
                <span>{tab === "All" ? "Total" : tab}</span>
              </button>
            ))}
          </div>
        </Box>
        <Box title="Filters">
          <p className="student-muted">Show specific types of notifications.</p>
          {tabs.map(tab => (
            <button
              className={`student-filter-row ${filter === tab ? "active" : ""}`}
              key={tab}
              onClick={() => setFilter(tab)}
            >
              {tab === "All" ? "All notifications" : tab}
              <span>{count(tab)} →</span>
            </button>
          ))}
          <Button
            variant="outline"
            disabled={all.isPending || !query.data?.some(n => !n.isRead)}
            onClick={() => all.mutate()}
          >
            Mark all as read
          </Button>
        </Box>
      </aside>
    </div>
  );
}

function Planner() {
  const query = trpc.planner.today.useQuery();
  const utils = trpc.useUtils();
  const { errors, check, clear } = useFieldErrors<
    "minutes" | "cards" | "quizzes" | "eventTitle" | "eventDate" | "eventNotes" | "planMessage"
  >();
  const [month, setMonth] = useState(() =>
    new Date().toISOString().slice(0, 7)
  );
  const [year, m] = month.split("-").map(Number);
  const calendar = trpc.planner.calendar.useQuery({
    from: new Date(year, m - 1, 1).getTime(),
    to: new Date(year, m, 0, 23, 59, 59).getTime(),
  });
  const refresh = () => utils.planner.invalidate();
  const goal = trpc.planner.updateGoal.useMutation({
    onSuccess: () => {
      void refresh();
      toast.success("Goals saved");
    },
    onError: fail,
  });
  const create = trpc.planner.createEvent.useMutation({
    onSuccess: refresh,
    onError: fail,
  });
  const remove = trpc.planner.deleteEvent.useMutation({
    onSuccess: refresh,
    onError: fail,
  });
  const generate = trpc.planner.generatePlan.useMutation({
    onSuccess: result => {
      void refresh();
      toast.success(`${result.created} study events added`);
    },
    onError: fail,
  });
  return (
    <div className="student-planner-grid">
      <State query={query} />
      {query.data && (
        <Box title="Daily study goals">
          <p>
            {query.data.completedMinutes} minutes studied today ·{" "}
            {query.data.completedQuizzes} quizzes completed ·{" "}
            {query.data.dueFlashcards} flashcards due
          </p>
          <form
            key={JSON.stringify(query.data.goal)}
            className="flex flex-wrap items-end gap-4"
            onSubmit={e => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const ok = check({
                minutes: validateNumber(String(f.get("minutes") ?? ""), { label: "Study minutes", min: 5, max: 480, integer: true }),
                cards: validateNumber(String(f.get("cards") ?? ""), { label: "Flashcards", min: 1, max: 100, integer: true }),
                quizzes: validateNumber(String(f.get("quizzes") ?? ""), { label: "Quizzes", min: 1, max: 20, integer: true }),
              });
              if (!ok) return;
              goal.mutate({
                dailyStudyMinutes: Number(f.get("minutes")),
                dailyFlashcards: Number(f.get("cards")),
                dailyQuizzes: Number(f.get("quizzes")),
              });
            }}
            noValidate
          >
            {[
              [
                "minutes",
                "Study minutes",
                5,
                480,
                query.data.goal.dailyStudyMinutes,
              ],
              ["cards", "Flashcards", 1, 100, query.data.goal.dailyFlashcards],
              ["quizzes", "Quizzes", 1, 20, query.data.goal.dailyQuizzes],
            ].map(([name, label, min, max, value]) => {
              const key = name as "minutes" | "cards" | "quizzes";
              return (
                <label key={key} className="space-y-1.5">
                  {label}
                  <Input
                    name={key}
                    className="mt-2 w-32"
                    type="number"
                    inputMode="numeric"
                    min={Number(min)}
                    max={Number(max)}
                    defaultValue={value}
                    aria-invalid={Boolean(errors[key])}
                    onChange={() => clear(key)}
                  />
                  <FieldError message={errors[key]} className="max-w-40" />
                </label>
              );
            })}
            <Button variant="accent" disabled={goal.isPending}>Save goals</Button>
          </form>
        </Box>
      )}
      {query.data && (
        <Box title="Today's progress">
          <div className="student-today-rings">
            <div>
              <StudentRing
                value={
                  (query.data.completedMinutes /
                    query.data.goal.dailyStudyMinutes) *
                  100
                }
              />
              <h3>Study minutes</h3>
              <p>
                {query.data.completedMinutes} /{" "}
                {query.data.goal.dailyStudyMinutes} min
              </p>
            </div>
            <div>
              <StudentRing
                value={
                  (query.data.completedQuizzes / query.data.goal.dailyQuizzes) *
                  100
                }
              />
              <h3>Quizzes</h3>
              <p>
                {query.data.completedQuizzes} / {query.data.goal.dailyQuizzes}{" "}
                quizzes
              </p>
            </div>
            <div>
              <span className="student-icon">
                <Layers />
              </span>
              <h3>Flashcards due</h3>
              <p>{query.data.dueFlashcards} cards</p>
            </div>
          </div>
        </Box>
      )}
      <Box title="Today's tasks">
        {query.data?.tasks.map(t => (
          <div key={t.id} className="flex flex-wrap justify-between gap-3">
            <div>
              <p className="font-medium">{t.title}</p>
              <p className="text-sm text-muted-foreground">{t.detail}</p>
            </div>
            <Go href={t.href}>Start</Go>
          </div>
        ))}
        {query.data?.tasks.length === 0 && (
          <Empty>No pending tasks. Add a study session below.</Empty>
        )}
      </Box>
      <div className="student-planner-forms">
        <Box title="Add to your calendar">
          <form
            className="space-y-3"
            onSubmit={async e => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              const title = String(f.get("title") ?? "");
              const date = String(f.get("date") ?? "");
              const notes = String(f.get("notes") ?? "");
              const ok = check({
                eventTitle: validateText(title, { label: "Event title", min: 2, max: 160 }),
                eventDate: validateFutureDate(date, { label: "Date and time", required: true }),
                eventNotes: validateText(notes, { label: "Notes", required: false, max: 500 }),
              });
              if (!ok) return;
              try {
                await create.mutateAsync({
                  title: title.trim(),
                  type: String(f.get("type")) as "study",
                  startsAt: new Date(date).getTime(),
                  notes: notes.trim(),
                  reminderMinutes: 30,
                });
                form.reset();
                toast.success("Event added");
              } catch {}
            }}
          >
            <Input
              aria-label="Event title"
              name="title"
              placeholder="Event title"
              maxLength={160}
              aria-invalid={Boolean(errors.eventTitle)}
              onChange={() => clear("eventTitle")}
            />
            <FieldError message={errors.eventTitle} />
            <select
              aria-label="Event type"
              name="type"
              className="w-full rounded-lg border bg-background p-2"
            >
              {["study", "exam", "test", "quiz", "other"].map(t => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <Input
              aria-label="Event date and time"
              name="date"
              type="datetime-local"
              aria-invalid={Boolean(errors.eventDate)}
              onChange={() => clear("eventDate")}
            />
            <FieldError message={errors.eventDate} />
            <Textarea
              aria-label="Event notes"
              name="notes"
              placeholder="Notes (optional)"
              maxLength={500}
              aria-invalid={Boolean(errors.eventNotes)}
              onChange={() => clear("eventNotes")}
            />
            <FieldError message={errors.eventNotes} />
            <Button variant="accent" disabled={create.isPending}>Add event</Button>
          </form>
        </Box>
        <Box title="Plan with AI">
          <p className="student-muted">
            Get a personalized study plan based on your goals, upcoming
            deadlines, and learning style.
          </p>
          <form
            className="space-y-3"
            onSubmit={e => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const message = String(f.get("message") ?? "");
              const ok = check({
                planMessage: validateText(message, { label: "Your request", min: 8, max: 500 }),
              });
              if (ok) generate.mutate({ message: message.trim() });
            }}
          >
            <Textarea
              aria-label="Study plan request"
              name="message"
              placeholder="Plan three revision sessions for my biology exam next Friday..."
              maxLength={500}
              aria-invalid={Boolean(errors.planMessage)}
              onChange={() => clear("planMessage")}
            />
            <FieldError message={errors.planMessage} />
            <Button disabled={generate.isPending}>
              {generate.isPending ? "Planning..." : "Generate study plan"}
            </Button>
          </form>
        </Box>
      </div>
      <Box title="Calendar">
        <Input
          aria-label="Calendar month"
          className="max-w-xs"
          type="month"
          required
          value={month}
          onChange={e => {
            if (e.target.value) setMonth(e.target.value);
          }}
        />
        <State query={calendar} />
        {calendar.data?.events.map(event => (
          <div
            key={event.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b pb-3"
          >
            <div>
              <p className="font-semibold">{event.title}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(event.startsAt).toLocaleString()} · {event.type}
              </p>
              <p>{event.notes}</p>
            </div>
            <Button
              variant="outline"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm(`Delete ${event.title}?`))
                  remove.mutate({ id: event.id });
              }}
            >
              Delete
            </Button>
          </div>
        ))}
        {calendar.data?.events.length === 0 && (
          <Empty>No events this month.</Empty>
        )}
      </Box>
    </div>
  );
}
