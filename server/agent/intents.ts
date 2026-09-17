export const LEARNING_INTENTS = [
  "qa",
  "study_session",
  "quiz",
  "flashcards",
  "summary",
  "progress",
  "assignment",
  "calendar",
  "general",
] as const;

export type LearningIntent = (typeof LEARNING_INTENTS)[number];

export function classifyLearningIntent(message: string): LearningIntent {
  const text = message.trim();
  if (!text) return "general";
  const lower = text.toLowerCase();

  if (
    /\b(assignment|rubric|what do i (need to |have to )?(do|submit)|brief)\b/.test(lower)
  ) {
    return "assignment";
  }
  if (
    /\b(timetable|calendar|exam (prep|plan|schedule)|study timetable|revision timetable)\b/.test(lower) ||
    /\b(create|make|build|generate|set up|add)\b.{0,50}\b(plan|timetable|schedule)\b.{0,40}\b(exam|test|quiz)\b/.test(lower) ||
    /\b(exam|test|quiz)\b.{0,40}\b(timetable|schedule|calendar|remind)\b/.test(lower) ||
    /\bremind me\b/.test(lower) ||
    /\bplan (for|my) (upcoming )?(exam|test|quiz)\b/.test(lower)
  ) {
    return "calendar";
  }
  if (
    /\b(flash ?cards?|anki|spaced repetition)\b/.test(lower) &&
    /\b(creat|generat|make|add|from)\b/.test(lower)
  ) {
    return "flashcards";
  }
  if (
    /\b(quiz|quizzes|mcqs?|practice questions?|test me)\b/.test(lower) ||
    /\bgenerat(e|ing)\b.{0,40}\b(question|quiz)/.test(lower) ||
    /\b\d+\s+questions?\b/.test(lower)
  ) {
    return "quiz";
  }
  if (/\b(summar(y|ise|ize)|key points|overview of (this|the) (doc|lecture|material))\b/.test(lower)) {
    return "summary";
  }
  if (
    /\b(what should i (revise|study)|revise today|revision|weak (area|topic)|my progress)\b/.test(lower)
  ) {
    return "progress";
  }
  if (
    /\b(prepare for|exam tomorrow|study session|help me study|walk me through|guided study)\b/.test(lower)
  ) {
    return "study_session";
  }
  if (
    /\b(explain|what is|how does|using my|from (my |the )?(course|lecture|material|csc|notes))\b/.test(
      lower
    )
  ) {
    return "qa";
  }
  return "general";
}

export function requestedCount(message: string, fallback: number, min: number, max: number): number {
  const match = message.match(/\b(\d{1,2})\b/);
  if (!match) return fallback;
  const n = Number(match[1]);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
