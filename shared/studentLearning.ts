export const LEARN_MODES = [
  { id: "read", label: "Read explanations" },
  { id: "practice", label: "Practice with questions" },
  { id: "flashcards", label: "Use flashcards" },
  { id: "ai", label: "Ask the AI tutor" },
  { id: "summarize", label: "Summarize topics" },
  { id: "planner", label: "Follow structured study sessions" },
] as const;

export const FOCUS_GOALS = [
  { id: "difficult", label: "Understanding difficult topics" },
  { id: "exams", label: "Preparing for exams" },
  { id: "assignments", label: "Completing assignments" },
  { id: "revise", label: "Revising course materials" },
  { id: "habits", label: "Building consistent study habits" },
] as const;

export const ONBOARDING_STEPS = ["welcome", "academic", "courses", "preferences", "ai", "done"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
