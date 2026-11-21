import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { Quiz } from "@shared/types";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/_core/hooks/useAuth";
import { PracticeMistakes } from "@/components/PracticeMistakes";
import { MessageSquareText, ListChecks } from "lucide-react";
import { AppIcon } from "@/components/icons/AppIcon";

interface QuizComponentProps {
  quiz: Quiz;
  onComplete?: () => void;
}

interface AnswerState {
  [questionId: string]: string;
}

export function QuizComponent({ quiz, onComplete }: QuizComponentProps) {
  const { user } = useAuth();
  const reduced = useReducedMotion();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [showResults, setShowResults] = useState(false);
  const [serverScore, setServerScore] = useState<number | null>(null);
  const [successIconFailed, setSuccessIconFailed] = useState(false);

  const { data: quizWithQuestions, isLoading, refetch } = trpc.quizzes.get.useQuery(
    { quizId: quiz.id },
    { enabled: !!quiz.id }
  );

  const submitQuizMutation = trpc.quizzes.submitQuiz.useMutation({
    onSuccess: async (updatedQuiz) => {
      // Server computes the real score (handles essay grading)
      const score = typeof updatedQuiz.score === "string"
        ? parseFloat(updatedQuiz.score)
        : (updatedQuiz.score ?? 0);
      setServerScore(Math.round(score));
      // Refetch to get essayFeedback on each question
      await refetch();
      toast.success("Quiz submitted!");
      setShowResults(true);
      onComplete?.();
    },
    onError: (error) => {
      toast.error(error.message ?? "Could not submit quiz. Please try again.");
    },
  });

  const questions = quizWithQuestions?.questions ?? [];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Loading quiz...</p>
        </CardContent>
      </Card>
    );
  }

  if (!questions.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">No questions found.</p>
        </CardContent>
      </Card>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = answers[currentQuestion.id] || "";
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const isEssay = (currentQuestion as { questionType?: string }).questionType === "essay";

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1)
      setCurrentQuestionIndex(currentQuestionIndex + 1);
  };
  const handlePrevious = () => {
    if (currentQuestionIndex > 0)
      setCurrentQuestionIndex(currentQuestionIndex - 1);
  };

  const handleSubmit = async () => {
    // For essay quizzes the server always overrides the score, so send 0 as placeholder.
    // For all-MCQ quizzes we compute client-side so it still works without the server recompute.
    const mcqCorrect = questions.filter(
      q => (q as { questionType?: string }).questionType !== "essay" && answers[q.id] === q.correctAnswer
    ).length;
    const mcqTotal = questions.filter(
      q => (q as { questionType?: string }).questionType !== "essay"
    ).length;
    const clientScore = mcqTotal > 0 ? Math.round((mcqCorrect / questions.length) * 100) : 0;

    try {
      await submitQuizMutation.mutateAsync({
        quizId: quiz.id,
        score: clientScore,
        answers,
      });
    } catch {
      // error handled by onError
    }
  };

  // ── Results screen ────────────────────────────────────────────────────────
  if (showResults) {
    const displayScore = serverScore ?? 0;
    const isPassed = displayScore >= 70;
    const mcqCorrect = questions.filter(
      q => (q as { questionType?: string }).questionType !== "essay" && q.userAnswer === q.correctAnswer
    ).length;
    const mcqTotal = questions.filter(
      q => (q as { questionType?: string }).questionType !== "essay"
    ).length;
    const essayQuestions = questions.filter(
      q => (q as { questionType?: string }).questionType === "essay"
    );

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduced ? 0 : 0.3 }}
        className="space-y-4"
      >
        {/* Score card */}
        <Card className="text-center">
          <CardHeader>
            <CardTitle>Quiz Complete!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              {isPassed && (
                <div className="quiz-achievement-icon mx-auto mb-1 flex flex-col items-center" role="img" aria-label="Quiz passed">
                  {reduced || successIconFailed ? (
                    <AppIcon name="Check" className="quiz-static-success" size={48} mode="static" />
                  ) : (
                    <img className="quiz-lordicon" src="/icons/lordicon-check.gif" onError={() => setSuccessIconFailed(true)} alt="" width="48" height="48" loading="lazy" />
                  )}
                  <a className="text-[10px] text-muted-foreground underline-offset-2 hover:underline" href="https://lordicon.com/icons/system/solid/37-check" target="_blank" rel="noreferrer">Animation by Lordicon</a>
                </div>
              )}
              <div className={`text-6xl font-bold ${isPassed ? "text-emerald-600" : "text-orange-600"}`}>
                {displayScore}%
              </div>
              <p className="text-muted-foreground text-sm">
                {mcqTotal > 0 && `${mcqCorrect}/${mcqTotal} MCQ correct`}
                {mcqTotal > 0 && essayQuestions.length > 0 && " · "}
                {essayQuestions.length > 0 && `${essayQuestions.length} essay question${essayQuestions.length > 1 ? "s" : ""} AI-graded`}
              </p>
            </div>
            <div className={`p-4 rounded-xl text-sm font-medium ${isPassed ? "bg-emerald-50 text-emerald-800" : "bg-orange-50 text-orange-800"}`}>
              {isPassed ? "🎉 Great job! You passed the quiz!" : "Keep practising! Review the material and try again."}
            </div>

            {user?.role === "user" && mcqTotal > 0 && (
              <PracticeMistakes
                source={{ kind: "quiz", quizId: quiz.id, answers }}
                mistakes={mcqTotal - mcqCorrect}
              />
            )}

            <Button
              className="w-full"
              onClick={() => {
                setCurrentQuestionIndex(0);
                setAnswers({});
                setShowResults(false);
                setServerScore(null);
                onComplete?.();
              }}
            >
              Try again
            </Button>
          </CardContent>
        </Card>

        {/* Essay feedback cards */}
        {essayQuestions.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
              Essay feedback
            </h3>
            {essayQuestions.map((q, i) => {
              const fb = q as { questionType?: string; essayFeedback?: string | null; userAnswer?: string | null; isCorrect?: boolean | null };
              return (
                <Card key={q.id}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold leading-snug flex-1">
                        Essay {i + 1}: {q.question}
                      </p>
                      {fb.isCorrect !== null && fb.isCorrect !== undefined && (
                        <Badge variant={fb.isCorrect ? "default" : "secondary"} className="shrink-0">
                          {fb.isCorrect ? "Pass" : "Needs work"}
                        </Badge>
                      )}
                    </div>

                    {fb.userAnswer && (
                      <div className="rounded-lg bg-muted/60 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Your answer</p>
                        <p className="text-sm whitespace-pre-wrap">{fb.userAnswer}</p>
                      </div>
                    )}

                    {fb.essayFeedback ? (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 mb-1">AI feedback</p>
                        <p className="text-sm text-emerald-900">{fb.essayFeedback}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">AI feedback processing…</p>
                    )}

                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Model answer</p>
                      <p className="text-sm text-slate-700">{q.correctAnswer}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </motion.div>
    );
  }

  // ── Question screen ───────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium">
            Question {currentQuestionIndex + 1} of {questions.length}
          </span>
          <span className="text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Question card */}
      <motion.div
        key={currentQuestion.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.3 }}
      >
        <Card>
          <CardHeader className="pb-3">
            {/* Question type badge */}
            <div className="flex items-center gap-2 mb-2">
              {isEssay ? (
                <Badge variant="outline" className="gap-1 border-violet-300 text-violet-700 bg-violet-50">
                  <MessageSquareText className="h-3 w-3" /> Essay
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 border-emerald-300 text-emerald-700 bg-emerald-50">
                  <ListChecks className="h-3 w-3" /> MCQ
                </Badge>
              )}
            </div>
            <CardTitle className="text-lg leading-snug">{currentQuestion.question}</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {isEssay ? (
              /* Essay text input */
              <div className="space-y-2">
                <Textarea
                  placeholder="Write your answer here…"
                  value={currentAnswer}
                  onChange={e => setAnswers({ ...answers, [currentQuestion.id]: e.target.value })}
                  className="min-h-[160px] resize-y text-sm leading-relaxed"
                  aria-label={`Essay answer for question ${currentQuestionIndex + 1}`}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {currentAnswer.trim().split(/\s+/).filter(Boolean).length} words
                  {" · "}Your answer will be graded by AI when you submit.
                </p>
              </div>
            ) : (
              /* MCQ radio options */
              <RadioGroup
                value={currentAnswer}
                onValueChange={v => setAnswers({ ...answers, [currentQuestion.id]: v })}
              >
                <div className="space-y-3">
                  {currentQuestion.options?.map((option, idx) => (
                    <motion.div
                      key={idx}
                      className="quiz-answer flex items-center space-x-3 p-3 rounded-lg border border-input hover:bg-accent cursor-pointer transition-colors"
                      data-selected={currentAnswer === option}
                      animate={{ scale: currentAnswer === option ? 1.008 : 1 }}
                      transition={{ duration: reduced ? 0 : 0.18 }}
                    >
                      <RadioGroupItem value={option} id={`quiz-${quiz.id}-option-${idx}`} />
                      <Label
                        htmlFor={`quiz-${quiz.id}-option-${idx}`}
                        className="flex-1 cursor-pointer font-normal"
                      >
                        {option}
                      </Label>
                    </motion.div>
                  ))}
                </div>
              </RadioGroup>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Navigation */}
      <div className="flex gap-2 justify-between">
        <Button variant="outline" onClick={handlePrevious} disabled={currentQuestionIndex === 0}>
          Previous
        </Button>

        {currentQuestionIndex === questions.length - 1 ? (
          <Button
            onClick={handleSubmit}
            disabled={
              submitQuizMutation.isPending ||
              questions.some(q => !answers[q.id]?.trim())
            }
            className="bg-emerald-500/15 border border-emerald-400/50 text-emerald-700 hover:bg-emerald-500/25 rounded-2xl"
          >
            {submitQuizMutation.isPending ? "Grading…" : "Submit Quiz"}
          </Button>
        ) : (
          <Button onClick={handleNext}>Next</Button>
        )}
      </div>

      {/* Question dot navigator */}
      <div className="flex gap-1 flex-wrap justify-center">
        {questions.map((q, idx) => {
          const qType = (q as { questionType?: string }).questionType;
          return (
            <button
              key={q.id}
              title={`Question ${idx + 1} — ${qType === "essay" ? "Essay" : "MCQ"}`}
              onClick={() => setCurrentQuestionIndex(idx)}
              className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                idx === currentQuestionIndex
                  ? "bg-primary text-primary-foreground"
                  : answers[q.id]?.trim()
                    ? qType === "essay"
                      ? "bg-violet-200 text-violet-800"
                      : "bg-secondary text-secondary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
