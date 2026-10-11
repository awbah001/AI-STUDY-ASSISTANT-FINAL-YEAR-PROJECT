import { Link } from "wouter";
import { toast } from "sonner";
import { CalendarDays, Layers, RotateCcw, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

type Source = { kind: "quiz"; quizId: number; answers: Record<string, string> } | { kind: "exam"; examId: number };

function when(ms: number | null) {
  return ms
    ? new Date(ms).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "";
}

/** Turns wrong answers into flashcards, a retry quiz and two planner sessions. */
export function PracticeMistakes({ source, mistakes }: { source: Source; mistakes: number }) {
  const utils = trpc.useUtils();
  const onSuccess = () => {
    void utils.flashcards.invalidate();
    void utils.quizzes.invalidate();
    void utils.planner.invalidate();
    void utils.studentLearning.dashboard.invalidate();
  };
  const onError = (error: { message: string }) => toast.error(error.message);
  const fromQuiz = trpc.practice.fromQuiz.useMutation({ onSuccess, onError });
  const fromExam = trpc.practice.fromExam.useMutation({ onSuccess, onError });
  const mutation = source.kind === "quiz" ? fromQuiz : fromExam;
  const result = mutation.data;

  if (mistakes === 0) return null;

  if (result?.alreadyCreated) {
    return (
      <div className="practice-card rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left text-sm text-emerald-950">
        Your practice set for this exam is already in your{" "}
        <Link className="font-semibold underline" href="/student/flashcards">flashcards</Link> and{" "}
        <Link className="font-semibold underline" href="/student/planner">planner</Link>.
      </div>
    );
  }

  if (result) {
    return (
      <div className="practice-card space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left text-sm text-emerald-950" role="status">
        <p className="flex items-center gap-2 font-semibold">
          <Target className="size-4" /> Practice set ready
        </p>
        <ul className="space-y-2">
          <li className="flex items-start gap-2">
            <Layers className="mt-0.5 size-4 shrink-0" />
            <span>
              {result.flashcardsCreated
                ? `${result.flashcardsCreated} flashcard${result.flashcardsCreated === 1 ? "" : "s"} added to your review queue.`
                : "These questions are already in your flashcards."}{" "}
              <Link className="font-semibold underline" href="/student/flashcards">Review now</Link>
            </span>
          </li>
          {result.retryQuizzes.map((quiz) => (
            <li key={quiz.id} className="flex items-start gap-2">
              <RotateCcw className="mt-0.5 size-4 shrink-0" />
              <span>
                {quiz.title} ({quiz.questions} question{quiz.questions === 1 ? "" : "s"}).{" "}
                <Link className="font-semibold underline" href={`/document/${quiz.documentId}?tab=quizzes`}>Open quiz</Link>
              </span>
            </li>
          ))}
          {result.reviewAt && (
            <li className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 size-4 shrink-0" />
              <span>
                Review planned for {when(result.reviewAt)} and a re-quiz for {when(result.requizAt)}.{" "}
                <Link className="font-semibold underline" href="/student/planner">See planner</Link>
              </span>
            </li>
          )}
        </ul>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={mutation.isPending}
      onClick={() =>
        source.kind === "quiz"
          ? fromQuiz.mutate({ quizId: source.quizId, answers: source.answers })
          : fromExam.mutate({ examId: source.examId })
      }
    >
      <Target className="size-4" />
      {mutation.isPending
        ? "Building your practice set..."
        : `Practise my ${mistakes} mistake${mistakes === 1 ? "" : "s"}`}
    </Button>
  );
}
