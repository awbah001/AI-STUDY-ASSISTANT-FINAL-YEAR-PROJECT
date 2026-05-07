import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { Quiz } from "@shared/types";
import { motion } from "framer-motion";

interface QuizComponentProps {
  quiz: Quiz;
  onComplete?: () => void;
}

interface AnswerState {
  [questionId: number]: string;
}

export function QuizComponent({ quiz, onComplete }: QuizComponentProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<{ correct: number; total: number } | null>(null);

  const { data: quizWithQuestions, isLoading } = trpc.quizzes.get.useQuery(
    { quizId: quiz.id },
    { enabled: !!quiz.id }
  );

  const submitQuizMutation = trpc.quizzes.submitQuiz.useMutation({
    onSuccess: () => {
      toast.success("Quiz submitted successfully!");
      onComplete?.();
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

  if (!questions || questions.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">No questions found</p>
        </CardContent>
      </Card>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = answers[currentQuestion.id] || "";
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  const handleSelectAnswer = (value: string) => {
    setAnswers({
      ...answers,
      [currentQuestion.id]: value,
    });
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = async () => {
    // Calculate score
    let correctCount = 0;
    for (const question of questions) {
      const userAnswer = answers[question.id];
      if (userAnswer === question.correctAnswer) {
        correctCount++;
      }
    }

    const score = (correctCount / questions.length) * 100;
    setResults({ correct: correctCount, total: questions.length });
    setShowResults(true);

    // Submit quiz with score
    await submitQuizMutation.mutateAsync({
      quizId: quiz.id,
      score,
    });
  };

  if (showResults && results) {
    const percentage = (results.correct / results.total) * 100;
    const isPassed = percentage >= 70;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="text-center">
          <CardHeader>
            <CardTitle>Quiz Complete!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className={`text-6xl font-bold ${isPassed ? "text-emerald-600" : "text-orange-600"}`}>
                {percentage.toFixed(0)}%
              </div>
              <p className="text-muted-foreground">
                You got {results.correct} out of {results.total} questions correct
              </p>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-medium">
                {isPassed
                  ? "🎉 Great job! You passed the quiz!"
                  : "Keep practicing! Review the material and try again."}
              </p>
            </div>

            <Button onClick={onComplete} className="w-full">
              Back to Document
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium">Question {currentQuestionIndex + 1} of {questions.length}</span>
          <span className="text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Question */}
      <motion.div
        key={currentQuestion.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{currentQuestion.question}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={currentAnswer} onValueChange={handleSelectAnswer}>
              <div className="space-y-3">
                {currentQuestion.options.map((option, idx) => (
                  <div key={idx} className="flex items-center space-x-3 p-3 rounded-lg border border-input hover:bg-accent cursor-pointer transition-colors">
                    <RadioGroupItem value={option} id={`option-${idx}`} />
                    <Label htmlFor={`option-${idx}`} className="flex-1 cursor-pointer font-normal">
                      {option}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </CardContent>
        </Card>
      </motion.div>

      {/* Navigation */}
      <div className="flex gap-2 justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentQuestionIndex === 0}
        >
          Previous
        </Button>

        {currentQuestionIndex === questions.length - 1 ? (
          <Button
            onClick={handleSubmit}
            disabled={submitQuizMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 rounded-2xl"
          >
            {submitQuizMutation.isPending ? "Submitting..." : "Submit Quiz"}
          </Button>
        ) : (
          <Button onClick={handleNext}>
            Next
          </Button>
        )}
      </div>

      {/* Question Indicator */}
      <div className="flex gap-1 flex-wrap justify-center">
        {questions.map((q, idx) => (
          <button
            key={q.id}
            onClick={() => setCurrentQuestionIndex(idx)}
            className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
              idx === currentQuestionIndex
                ? "bg-primary text-primary-foreground"
                : answers[q.id]
                ? "bg-secondary text-secondary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {idx + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
