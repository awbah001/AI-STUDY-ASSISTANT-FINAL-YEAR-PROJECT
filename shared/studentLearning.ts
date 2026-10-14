import { z } from "zod";
import { isSemester, parseAcademicYear } from "./academics";

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

const PROGRAMME_TEXT_FIELDS = [
  ["faculty", "Faculty"],
  ["department", "Department"],
  ["programme", "Programme"],
] as const;

/**
 * Profile setup. When the admin has set up programmes the student picks one (programmeId)
 * and the faculty, department and programme names come from it; otherwise they are typed.
 */
export const academicProfileSchema = z
  .object({
    studentNumber: requiredField("Student ID", 80),
    programmeId: z.number().int().positive().optional(),
    faculty: z.string().trim().max(120).default(""),
    department: z.string().trim().max(120).default(""),
    programme: z.string().trim().max(120).default(""),
    academicLevel: requiredField("Level", 80),
    semester: requiredField("Semester", 40).refine(isSemester, "Choose the first or second semester."),
    academicYear: requiredField("Academic year", 40).refine(
      value => parseAcademicYear(value) !== null,
      "Choose an academic year like 2025/2026."
    ),
    courseIds: z.array(z.number().int().positive()).max(40).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.programmeId) return;
    for (const [key, label] of PROGRAMME_TEXT_FIELDS) {
      if (!value[key]) ctx.addIssue({ code: "custom", path: [key], message: `${label} is required` });
    }
  });
export type AcademicProfile = z.input<typeof academicProfileSchema>;

/** Semester and academic year are the only academic details a student can change after setup. */
export const studentTermSchema = z.object({
  semester: z.string().refine(isSemester, "Choose the first or second semester."),
  academicYear: z.string().trim().refine(value => parseAcademicYear(value) !== null, "Choose an academic year like 2025/2026."),
});
