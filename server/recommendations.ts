export type WeakTopic = {
  topic: string;
  courseId: number | null;
  courseTitle: string | null;
  documentId: number | null;
  misses: number;
  attempts: number;
  lastScore: number | null;
};

export type Recommendation = {
  title: string;
  reason: string;
  action: string;
  href: string;
  courseId: number | null;
  documentId: number | null;
};

export type ContinueLearning = {
  courseId: number | null;
  courseTitle: string;
  documentId: number | null;
  documentTitle: string | null;
  progressPct: number;
  href: string;
} | null;

export function documentProgressPct(input: {
  flashcardsReviewed: number;
  quizzesAttempted: number;
  totalStudyTimeMinutes: number;
}): number {
  const reviews = input.flashcardsReviewed || 0;
  const quizzes = input.quizzesAttempted || 0;
  const studyMins = input.totalStudyTimeMinutes || 0;
  if (reviews === 0 && quizzes === 0 && studyMins === 0) return 0;
  const score =
    Math.min(reviews / 10, 1) * 50 +
    Math.min(quizzes / 1, 1) * 30 +
    Math.min(studyMins / 30, 1) * 20;
  return Math.max(5, Math.round(score));
}

export function derivePersona(input: {
  quizAttempts: number;
  overdueCount: number;
  weakCount: number;
  quizAccuracy: number | null;
  streak: number;
}): "new" | "behind" | "strong" | "active" {
  if (input.quizAttempts === 0 && input.streak === 0 && input.overdueCount === 0) return "new";
  if (input.overdueCount > 0 || input.weakCount >= 2) return "behind";
  if ((input.quizAccuracy ?? 0) >= 80 && input.streak >= 3) return "strong";
  return "active";
}

export function pickRecommendation(input: {
  overdue: Array<{ title: string; courseId: number; href: string; dueDate?: Date | null }>;
  weakTopics: WeakTopic[];
  continueLearning: ContinueLearning;
  enrolledCount: number;
}): Recommendation {
  const overdue = input.overdue[0];
  if (overdue) {
    return {
      title: overdue.title,
      reason: "This work is overdue and should be completed first.",
      action: "Open assignment",
      href: overdue.href,
      courseId: overdue.courseId,
      documentId: null,
    };
  }
  const weak = input.weakTopics[0];
  if (weak) {
    const href = weak.documentId ? `/document/${weak.documentId}` : weak.courseId ? `/course/${weak.courseId}` : "/(tabs)/courses";
    return {
      title: `Review ${weak.topic}`,
      reason: `Recent quiz answers missed this topic ${weak.misses} time${weak.misses === 1 ? "" : "s"}.`,
      action: "Review topic",
      href,
      courseId: weak.courseId,
      documentId: weak.documentId,
    };
  }
  if (input.continueLearning) {
    return {
      title: `Continue ${input.continueLearning.courseTitle}`,
      reason: "Pick up where you left off in your last study session.",
      action: "Continue",
      href: input.continueLearning.href,
      courseId: input.continueLearning.courseId,
      documentId: input.continueLearning.documentId,
    };
  }
  if (input.enrolledCount === 0) {
    return {
      title: "Join your first course",
      reason: "You need at least one enrolled course before the assistant can recommend materials.",
      href: "/(tabs)/courses",
      action: "Browse courses",
      courseId: null,
      documentId: null,
    };
  }
  return {
    title: "Start a learning session",
    reason: "Open a course material and ask the AI assistant to explain the first topic.",
    action: "Open courses",
    href: "/(tabs)/courses",
    courseId: null,
    documentId: null,
  };
}

export function buildInsights(input: {
  weekSessions: number;
  quizDelta: number | null;
  weakTopics: WeakTopic[];
  daysSinceCourse: number | null;
  courseTitle: string | null;
  dueSoonTitle: string | null;
  dueSoonDays: number | null;
}): string[] {
  const out: string[] = [];
  if (input.weekSessions > 0) {
    out.push(`You completed ${input.weekSessions} study session${input.weekSessions === 1 ? "" : "s"} this week.`);
  }
  if (input.quizDelta !== null && input.quizDelta !== 0) {
    const verb = input.quizDelta > 0 ? "improved" : "dropped";
    out.push(`Your latest quiz score ${verb} by ${Math.abs(Math.round(input.quizDelta))} points.`);
  }
  if (input.weakTopics[0]) {
    out.push(`You frequently miss questions on ${input.weakTopics[0].topic}.`);
  }
  if (input.daysSinceCourse !== null && input.daysSinceCourse >= 6 && input.courseTitle) {
    out.push(`You have not opened ${input.courseTitle} in ${input.daysSinceCourse} days.`);
  }
  if (input.dueSoonTitle && input.dueSoonDays !== null && input.dueSoonDays >= 0 && input.dueSoonDays <= 2) {
    out.push(`You have “${input.dueSoonTitle}” due in ${input.dueSoonDays === 0 ? "less than a day" : `${input.dueSoonDays} day${input.dueSoonDays === 1 ? "" : "s"}`}.`);
  }
  return out.slice(0, 4);
}
