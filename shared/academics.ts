export const SEMESTERS = ["First", "Second"] as const;
export type Semester = (typeof SEMESTERS)[number];

export const ACADEMIC_STATUSES = ["active", "completed"] as const;
export type AcademicStatus = (typeof ACADEMIC_STATUSES)[number];

export const MIN_PROGRAMME_YEARS = 1;
export const MAX_PROGRAMME_YEARS = 7;
export const DEFAULT_PROGRAMME_YEARS = 4;

const ACADEMIC_YEAR_RE = /^(\d{4})\s*\/\s*(\d{4})$/;

export type CatalogueProgramme = {
  id: number;
  name: string;
  durationYears: number;
  isActive: boolean;
};
export type CatalogueDepartment = { id: number; name: string; programmes: CatalogueProgramme[] };
export type CatalogueFaculty = { id: number; name: string; departments: CatalogueDepartment[] };

/** Levels a student can be at in a programme: year 1, year 2, and so on. */
export function levelsFor(durationYears: number): number[] {
  const years = Math.min(MAX_PROGRAMME_YEARS, Math.max(MIN_PROGRAMME_YEARS, Math.round(durationYears) || 1));
  return Array.from({ length: years }, (_, i) => i + 1);
}

/**
 * Years to offer for a course: up to the longest of its programmes, or of the whole catalogue
 * when none is chosen, and the standard four years when there are no programmes yet.
 */
export function yearsForProgrammes(faculties: CatalogueFaculty[], programmeIds: number[] = []): number[] {
  const all = faculties.flatMap(f => f.departments.flatMap(d => d.programmes));
  const chosen = programmeIds.length ? all.filter(p => programmeIds.includes(p.id)) : all;
  const longest = Math.max(0, ...chosen.map(p => p.durationYears));
  return levelsFor(longest || DEFAULT_PROGRAMME_YEARS);
}

export function levelLabel(level: number | string | null | undefined): string {
  const n = parseLevel(level);
  if (n) return `Year ${n}`;
  return typeof level === "string" && level.trim() ? level.trim() : "—";
}

/**
 * Reads "3", "Year 3" or "Level 3" as year 3. Older records stored 100, 200, ... for each year,
 * so "300" and "Level 300" also read as year 3.
 */
export function parseLevel(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isInteger(value)) return null;
    const year = value >= 100 && value % 100 === 0 ? value / 100 : value;
    return year >= MIN_PROGRAMME_YEARS && year <= MAX_PROGRAMME_YEARS ? year : null;
  }
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(?:(?:year|level)\s*)?(\d{1,3})$/i);
  return match ? parseLevel(Number(match[1])) : null;
}

export function isSemester(value: unknown): value is Semester {
  return (SEMESTERS as readonly unknown[]).includes(value);
}

export function parseAcademicYear(value: unknown): { start: number; end: number } | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(ACADEMIC_YEAR_RE);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  return end === start + 1 ? { start, end } : null;
}

export function formatAcademicYear(start: number) {
  return `${start}/${start + 1}`;
}

export function nextAcademicYear(value: string): string | null {
  const parsed = parseAcademicYear(value);
  return parsed ? formatAcademicYear(parsed.end) : null;
}

/** Choices for the student's academic year dropdown, centred on the institution's current year. */
export function academicYearOptions(current: string, now = new Date()): string[] {
  const start = parseAcademicYear(current)?.start ?? (now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1);
  return [start - 1, start, start + 1].map(formatAcademicYear);
}

export type Term = { academicYear: string; semester: string };

/** First semester moves to second; second semester starts the next academic year. */
export function nextTerm(term: Term): (Term & { newYear: boolean }) | null {
  const year = parseAcademicYear(term.academicYear);
  if (!year) return null;
  if (term.semester === "First") return { academicYear: formatAcademicYear(year.start), semester: "Second", newYear: false };
  return { academicYear: formatAcademicYear(year.end), semester: "First", newYear: true };
}

/** Moves a student up a year at the start of a new academic year, or marks the programme finished. */
export function promote(level: number, durationYears: number): { level: number; completed: boolean } {
  const finalLevel = levelsFor(durationYears).at(-1)!;
  return level >= finalLevel ? { level: finalLevel, completed: true } : { level: level + 1, completed: false };
}

export type CourseTags = { programmeIds: number[]; level: number | null; semester: string | null };

/** A course is suggested when it is tagged with the student's programme and its level and semester (if set) match. */
export function courseMatches(course: CourseTags, student: { programmeId: number; level: number; semester: string }) {
  return (
    course.programmeIds.includes(student.programmeId) &&
    (course.level === null || course.level === student.level) &&
    (course.semester === null || course.semester === student.semester)
  );
}

export function findProgramme(catalogue: CatalogueFaculty[], programmeId: number | null | undefined) {
  if (!programmeId) return null;
  for (const faculty of catalogue) {
    for (const department of faculty.departments) {
      const programme = department.programmes.find(p => p.id === programmeId);
      if (programme) return { faculty, department, programme };
    }
  }
  return null;
}
