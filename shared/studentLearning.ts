import { z } from "zod";

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

export const ONBOARDING_STEPS = [
  "welcome",
  "academic",
  "courses",
  "preferences",
  "ai",
  "done",
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const ACADEMIC_PROFILE_FIELDS = [
  { key: "studentNumber", label: "Student ID", maxLength: 80 },
  { key: "faculty", label: "Faculty", maxLength: 120 },
  { key: "department", label: "Department", maxLength: 120 },
  { key: "programme", label: "Programme", maxLength: 120 },
  { key: "academicLevel", label: "Level", maxLength: 80 },
  { key: "semester", label: "Semester", maxLength: 40 },
  { key: "academicYear", label: "Academic year", maxLength: 40 },
] as const;

const requiredField = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max);

export const academicProfileSchema = z.object({
  studentNumber: requiredField("Student ID", 80),
  faculty: requiredField("Faculty", 120),
  department: requiredField("Department", 120),
  programme: requiredField("Programme", 120),
  academicLevel: requiredField("Level", 80),
  semester: requiredField("Semester", 40),
  academicYear: requiredField("Academic year", 40),
});
export type AcademicProfile = z.infer<typeof academicProfileSchema>;
