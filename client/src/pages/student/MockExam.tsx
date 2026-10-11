import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { CheckCircle2, Clock, FileText, GraduationCap, History, Timer, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StudentRing } from "@/components/StudentUi";
import { PracticeMistakes } from "@/components/PracticeMistakes";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { trpc } from "@/lib/trpc";
import {
  EXAM_ANSWER_MAX,
  EXAM_MINUTE_CHOICES,
  EXAM_QUESTION_CHOICES,
  formatCountdown,
  scoreBand,
  topicBreakdown,
} from "@shared/studentFeatures";

const panel = "student-panel rounded-2xl border bg-card p-5 shadow-sm space-y-4";
const fail = (error: { message: string }) => toast.error(error.message);

function Choice<T extends number>({
  label,
  value,
  options,
  unit,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  unit: string;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="student-tabs" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === value}
            className={option === value ? "active" : ""}
            onClick={() => onChange(option)}
          >
            {option} {unit}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Start a timed exam built from a course's materials, and see past attempts. */
export function MockExamLauncher({ courseId }: { courseId?: number }) {
  const [, navigate] = useLocation();
  const courses = trpc.studentCourses.list.useQuery(undefined, { enabled: !courseId });
  const history = trpc.exams.list.useQuery(courseId ? { courseId } : undefined);
  const [selectedCourse, setSelectedCourse] = useState<number | "">(courseId ?? "");
  const [questions, setQuestions] = useState<number>(EXAM_QUESTION_CHOICES[1]);
  const [minutes, setMinutes] = useState<number>(EXAM_MINUTE_CHOICES[1]);
  const [courseError, setCourseError] = useState<string | null>(null);
  const create = trpc.exams.create.useMutation({
    onSuccess: ({ id }) => navigate(`/exam/${id}`),
    onError: fail,
  });

  return (
    <section className={panel}>
      <h2 className="student-panel-title">
        <span className="student-icon">
          <GraduationCap />
        </span>
        Mock exam
      </h2>
      <p className="student-muted">
        A timed exam written from your course materials, with multiple-choice and short written answers. Answers are
        marked when you hand in, and your mistakes can become a practice set.
      </p>
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!selectedCourse) {
            setCourseError("Choose a course for the exam.");
            return;
          }
          create.mutate({ courseId: Number(selectedCourse), questionCount: questions, durationMinutes: minutes });
        }}
      >
        {!courseId && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="exam-course">
              Course
            </label>
            <select
              id="exam-course"
              className="h-10 w-full max-w-sm rounded-md border bg-background px-3 text-sm"
              value={selectedCourse}
              aria-invalid={Boolean(courseError)}
              onChange={(e) => {
                setSelectedCourse(e.target.value ? Number(e.target.value) : "");
                setCourseError(null);
              }}
            >
              <option value="">Select a course</option>
              {courses.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            {courseError && (
              <p role="alert" className="text-sm text-red-600">
                {courseError}
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-6">
          <Choice label="Questions" value={questions} options={EXAM_QUESTION_CHOICES} unit="questions" onChange={setQuestions} />
          <Choice label="Time limit" value={minutes} options={EXAM_MINUTE_CHOICES} unit="min" onChange={setMinutes} />
        </div>
        <Button disabled={create.isPending}>
          <Timer className="size-4" />
          {create.isPending ? "Writing your exam (this can take a minute)..." : "Start mock exam"}
        </Button>
      </form>
      {!!history.data?.length && (
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <History className="size-4" /> Previous attempts
          </h3>
          <ul className="divide-y rounded-xl border">
            {history.data.slice(0, 6).map((exam) => (
              <li key={exam.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{courseId ? exam.title : exam.courseTitle}</p>
                  <p className="student-muted">
                    {new Date(exam.startedAt).toLocaleDateString()} · {exam.questionCount} questions ·{" "}
                    {exam.durationMinutes} min
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {exam.status === "submitted" ? (
                    <strong>{Math.round(exam.scorePercent ?? 0)}%</strong>
                  ) : (
                    <span className="student-muted">{exam.timedOut ? "Time up" : "In progress"}</span>
                  )}
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/exam/${exam.id}`}>
                      {exam.status === "submitted" ? "Review" : exam.timedOut ? "See result" : "Continue"}
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function MockExamPage({ id }: { id: number }) {
  const query = trpc.exams.get.useQuery({ examId: id });
  if (query.isLoading) return <p role="status" className="p-6 text-muted-foreground">Loading exam...</p>;
  if (!query.data) {
    return (
      <div role="alert" className={panel}>
        <p>{query.error?.message ?? "Exam not found."}</p>
        <Button asChild variant="outline">
          <Link href="/student/quizzes">Back to quizzes</Link>
        </Button>
      </div>
    );
  }
  return query.data.status === "submitted" ? (
    <ExamResults exam={query.data} />
  ) : (
    <ExamSitting exam={query.data} onSubmitted={() => query.refetch()} />
  );
}

type Exam = inferRouterOutputs<AppRouter>["exams"]["get"];

function ExamSitting({ exam, onSubmitted }: { exam: Exam; onSubmitted: () => void }) {
  const utils = trpc.useUtils();
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(exam.questions.map((q) => [String(q.id), q.userAnswer ?? ""]))
  );
  const endsAt = useMemo(() => Date.now() + exam.remainingSeconds * 1000, [exam.id]);
  const [remaining, setRemaining] = useState(exam.remainingSeconds);
  const dirty = useRef(false);
  const submitted = useRef(false);
  const save = trpc.exams.saveAnswers.useMutation();
  const submit = trpc.exams.submit.useMutation({
    onSuccess: (result) => {
      utils.exams.get.setData({ examId: exam.id }, result);
      void utils.exams.list.invalidate();
      void utils.progress.invalidate();
      void utils.studentLearning.dashboard.invalidate();
      onSubmitted();
    },
    onError: (error) => {
      submitted.current = false;
      fail(error);
    },
  });

  const handIn = () => {
    if (submitted.current) return;
    submitted.current = true;
    submit.mutate({ examId: exam.id, answers });
  };

  useEffect(() => {
    const tick = setInterval(() => setRemaining(Math.max(0, Math.round((endsAt - Date.now()) / 1000))), 1000);
    return () => clearInterval(tick);
  }, [endsAt]);

  useEffect(() => {
    if (remaining <= 0) {
      if (!submitted.current) toast.info("Time is up. Your exam has been handed in.");
      handIn();
    }
  }, [remaining]);

  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(() => {
      dirty.current = false;
      save.mutate({ examId: exam.id, answers });
    }, 2500);
    return () => clearTimeout(timer);
  }, [answers]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (!submitted.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const setAnswer = (questionId: number, value: string) => {
    dirty.current = true;
    setAnswers((prev) => ({ ...prev, [String(questionId)]: value.slice(0, EXAM_ANSWER_MAX) }));
  };
  const answered = exam.questions.filter((q) => answers[String(q.id)]?.trim()).length;
  const lowTime = remaining <= 60;

  return (
    <div className="space-y-4">
      <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card/95 p-4 shadow-sm backdrop-blur">
        <div>
          <h2 className="text-lg font-semibold">{exam.title}</h2>
          <p className="student-muted text-sm">
            {answered} of {exam.questions.length} answered · {exam.totalMarks ?? exam.questions.reduce((s, q) => s + q.marks, 0)} marks
            {save.isPending ? " · Saving..." : save.data?.saved ? " · Saved" : ""}
          </p>
        </div>
        <div
          className={`flex items-center gap-2 rounded-full px-4 py-2 font-mono text-lg font-semibold ${
            lowTime ? "bg-red-100 text-red-700" : "bg-emerald-50 text-emerald-800"
          }`}
          role="timer"
          aria-live={lowTime ? "assertive" : "off"}
          aria-label={`Time remaining ${formatCountdown(remaining)}`}
        >
          <Clock className="size-5" /> {formatCountdown(remaining)}
        </div>
      </div>

      {exam.questions.map((q, index) => (
        <section key={q.id} className={panel} aria-labelledby={`exam-q-${q.id}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 id={`exam-q-${q.id}`} className="font-semibold">
              {index + 1}. {q.question}
            </h3>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
              {q.marks} mark{q.marks === 1 ? "" : "s"}
            </span>
          </div>
          {q.type === "mcq" ? (
            <div className="space-y-2" role="radiogroup" aria-labelledby={`exam-q-${q.id}`}>
              {q.options.map((option, i) => {
                const checked = answers[String(q.id)] === option;
                return (
                  <label
                    key={i}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                      checked ? "border-emerald-500 bg-emerald-50" : "hover:bg-accent"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`exam-${q.id}`}
                      checked={checked}
                      onChange={() => setAnswer(q.id, option)}
                      className="accent-emerald-600"
                    />
                    {option}
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1">
              <Textarea
                aria-label={`Answer to question ${index + 1}`}
                placeholder="Write your answer in a few sentences."
                rows={5}
                maxLength={EXAM_ANSWER_MAX}
                value={answers[String(q.id)] ?? ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
              />
              <p className="text-right text-xs text-muted-foreground">
                {(answers[String(q.id)] ?? "").length}/{EXAM_ANSWER_MAX}
              </p>
            </div>
          )}
        </section>
      ))}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {answered < exam.questions.length && (
          <p className="student-muted text-sm">
            {exam.questions.length - answered} question{exam.questions.length - answered === 1 ? "" : "s"} unanswered
          </p>
        )}
        <Button
          disabled={submit.isPending}
          onClick={() => {
            const missing = exam.questions.length - answered;
            if (missing && !window.confirm(`You have ${missing} unanswered question${missing === 1 ? "" : "s"}. Hand in anyway?`)) return;
            handIn();
          }}
        >
          {submit.isPending ? "Marking your answers..." : "Hand in exam"}
        </Button>
      </div>
    </div>
  );
}

function ExamResults({ exam }: { exam: Exam }) {
  const percent = exam.scorePercent ?? 0;
  const band = scoreBand(percent);
  const topics = topicBreakdown(exam.questions);
  const mistakes = exam.questions.filter((q) => (q.awardedMarks ?? 0) < q.marks).length;

  return (
    <div className="space-y-4">
      <Button asChild variant="outline" size="sm">
        <Link href={`/course/${exam.courseId}`}>Back to {exam.courseTitle}</Link>
      </Button>
      <section className={`${panel} flex flex-wrap items-center gap-6`}>
        <StudentRing value={percent} label="score" />
        <div className="min-w-[14rem] flex-1 space-y-2">
          <h2 className="text-2xl font-semibold">{exam.title}</h2>
          <p className={band.tone === "good" ? "text-emerald-700" : band.tone === "ok" ? "text-amber-700" : "text-red-700"}>
            <strong>{band.label}</strong> · {exam.earnedMarks ?? 0} of {exam.totalMarks ?? 0} marks
          </p>
          <PracticeMistakes source={{ kind: "exam", examId: exam.id }} mistakes={exam.practiceCreatedAt ? 0 : mistakes} />
          {exam.practiceCreatedAt && (
            <p className="student-muted text-sm">
              Your practice set from this exam is in your{" "}
              <Link className="underline" href="/student/flashcards">flashcards</Link> and{" "}
              <Link className="underline" href="/student/planner">planner</Link>.
            </p>
          )}
        </div>
      </section>

      {topics.length > 1 && (
        <section className={panel}>
          <h3 className="font-semibold">By topic</h3>
          <ul className="space-y-3">
            {topics.map((t) => (
              <li key={t.topic} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{t.topic}</span>
                  <span className="text-muted-foreground">
                    {t.earned}/{t.total} marks
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${t.percent >= 70 ? "bg-emerald-500" : t.percent >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${Math.max(4, t.percent)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {exam.questions.map((q, index) => {
        const full = (q.awardedMarks ?? 0) >= q.marks;
        const none = (q.awardedMarks ?? 0) === 0;
        return (
          <section key={q.id} className={panel}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="flex gap-2 font-semibold">
                {full ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-label="Correct" />
                ) : (
                  <XCircle className={`mt-0.5 size-5 shrink-0 ${none ? "text-red-600" : "text-amber-600"}`} aria-label={none ? "Incorrect" : "Partly correct"} />
                )}
                {index + 1}. {q.question}
              </h3>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                {q.awardedMarks ?? 0}/{q.marks}
              </span>
            </div>
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="font-medium text-muted-foreground">Your answer</dt>
                <dd className="whitespace-pre-wrap">{q.userAnswer?.trim() || "No answer"}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">{q.type === "mcq" ? "Correct answer" : "Model answer"}</dt>
                <dd className="whitespace-pre-wrap">{q.correctAnswer}</dd>
              </div>
              {q.type === "short" && q.keyPoints.length > 0 && (
                <div>
                  <dt className="font-medium text-muted-foreground">Key points</dt>
                  <dd>
                    <ul className="list-disc pl-5">
                      {q.keyPoints.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
              {(q.feedback || q.explanation) && (
                <div className="rounded-lg bg-muted/60 p-3">{q.feedback || q.explanation}</div>
              )}
              {q.documentTitle && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="size-3.5" />
                  {q.documentId ? (
                    <Link className="underline" href={`/document/${q.documentId}`}>
                      {q.documentTitle}
                    </Link>
                  ) : (
                    q.documentTitle
                  )}
                </div>
              )}
            </dl>
          </section>
        );
      })}
    </div>
  );
}
