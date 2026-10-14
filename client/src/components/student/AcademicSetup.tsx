import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/FieldError";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import {
  SEMESTERS,
  findProgramme,
  isSemester,
  levelLabel,
  levelsFor,
  parseLevel,
} from "@shared/academics";
import { academicProfileSchema } from "@shared/studentLearning";

type Catalogue = RouterOutputs["academics"]["catalogue"];
type Profile = RouterOutputs["studentLearning"]["onboardingStatus"]["profile"];

export const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive";

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
      <FieldError message={error} />
    </label>
  );
}

/** Profile setup: programme from the admin's lists (typed only when none exist yet) and matching courses. */
export function AcademicSetup({ profile, catalogue, onDone }: { profile: Profile; catalogue: Catalogue; onDone: () => Promise<unknown> }) {
  const listed = catalogue.faculties.length > 0;
  const initial = findProgramme(catalogue.faculties, profile.programmeId);
  const [studentNumber, setStudentNumber] = useState(profile.studentNumber ?? "");
  const [facultyId, setFacultyId] = useState(initial?.faculty.id ?? 0);
  const [departmentId, setDepartmentId] = useState(initial?.department.id ?? 0);
  const [programmeId, setProgrammeId] = useState(initial?.programme.id ?? 0);
  const [text, setText] = useState({ faculty: profile.faculty ?? "", department: profile.department ?? "", programme: profile.programme ?? "" });
  const [level, setLevel] = useState(profile.academicLevel ?? "");
  const [semester, setSemester] = useState(isSemester(profile.semester) ? profile.semester : catalogue.term.semester);
  const [academicYear, setAcademicYear] = useState(
    profile.academicYear && catalogue.yearOptions.includes(profile.academicYear) ? profile.academicYear : catalogue.term.academicYear
  );
  const [picked, setPicked] = useState<Set<number> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const complete = trpc.studentLearning.completeProfileSetup.useMutation();

  const faculty = catalogue.faculties.find(f => f.id === facultyId);
  const department = faculty?.departments.find(d => d.id === departmentId);
  const programme = department?.programmes.find(p => p.id === programmeId);
  const levels = programme ? levelsFor(programme.durationYears) : [];
  const levelNumber = parseLevel(level);
  const yearOptions = catalogue.yearOptions.includes(catalogue.term.academicYear)
    ? catalogue.yearOptions
    : [catalogue.term.academicYear, ...catalogue.yearOptions];

  const ready = listed && Boolean(programme) && Boolean(levelNumber) && isSemester(semester);
  const suggestions = trpc.academics.suggestedCourses.useQuery(
    { programmeId, level: levelNumber ?? 1, semester: isSemester(semester) ? semester : "First" },
    { enabled: ready }
  );
  const suggested = useMemo(() => (ready ? suggestions.data ?? [] : []), [ready, suggestions.data]);
  useEffect(() => setPicked(null), [programmeId, level, semester]);
  const chosen = picked ?? new Set(suggested.map(c => c.id));

  const clear = (key: string) => setErrors(({ [key]: _, ...rest }) => rest);
  const pickProgramme = (next: { facultyId?: number; departmentId?: number; programmeId?: number }) => {
    if (next.facultyId !== undefined) {
      setFacultyId(next.facultyId);
      setDepartmentId(0);
      setProgrammeId(0);
    }
    if (next.departmentId !== undefined) {
      setDepartmentId(next.departmentId);
      setProgrammeId(0);
    }
    if (next.programmeId !== undefined) setProgrammeId(next.programmeId);
    if (next.programmeId || next.departmentId !== undefined || next.facultyId !== undefined) {
      const durationYears = catalogue.faculties
        .flatMap(f => f.departments)
        .flatMap(d => d.programmes)
        .find(p => p.id === next.programmeId)?.durationYears;
      if (!durationYears || !levelsFor(durationYears).includes(parseLevel(level) ?? 0)) setLevel("");
    }
    clear("programmeId");
  };

  const submit = async () => {
    const payload = {
      studentNumber,
      ...(listed ? { programmeId: programmeId || undefined } : text),
      academicLevel: level,
      semester,
      academicYear,
      courseIds: [...chosen],
    };
    const result = academicProfileSchema.safeParse(payload);
    const next: Record<string, string> = {};
    if (listed && !programmeId) next.programmeId = "Choose your programme.";
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !next[key]) next[key] = issue.message;
      }
    }
    setErrors(next);
    if (!result.success || Object.keys(next).length) return;
    try {
      const saved = await complete.mutateAsync(result.data);
      if (saved.enrolled.length) toast.success(`Enrolled in ${saved.enrolled.length} course${saved.enrolled.length === 1 ? "" : "s"}.`);
      await onDone();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const busy = complete.isPending;
  return (
    <form
      className="student-panel space-y-5 rounded-2xl border bg-card p-5 shadow-sm"
      noValidate
      onSubmit={e => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Student ID" error={errors.studentNumber}>
          <Input
            value={studentNumber}
            maxLength={80}
            disabled={busy}
            aria-invalid={Boolean(errors.studentNumber)}
            onChange={e => {
              setStudentNumber(e.target.value);
              clear("studentNumber");
            }}
          />
        </Field>
        {listed ? (
          <>
            <Field label="Faculty">
              <select className={selectClass} value={facultyId} disabled={busy} onChange={e => pickProgramme({ facultyId: Number(e.target.value) })}>
                <option value={0}>Choose your faculty</option>
                {catalogue.faculties.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Department">
              <select
                className={selectClass}
                value={departmentId}
                disabled={busy || !faculty}
                onChange={e => pickProgramme({ departmentId: Number(e.target.value) })}
              >
                <option value={0}>{faculty ? "Choose your department" : "Choose a faculty first"}</option>
                {faculty?.departments.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Programme" error={errors.programmeId}>
              <select
                className={selectClass}
                value={programmeId}
                disabled={busy || !department}
                aria-invalid={Boolean(errors.programmeId)}
                onChange={e => pickProgramme({ programmeId: Number(e.target.value) })}
              >
                <option value={0}>{department ? "Choose your programme" : "Choose a department first"}</option>
                {department?.programmes.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Year" error={errors.academicLevel}>
              <select
                className={selectClass}
                value={levelNumber ?? ""}
                disabled={busy || !programme}
                aria-invalid={Boolean(errors.academicLevel)}
                onChange={e => {
                  setLevel(e.target.value);
                  clear("academicLevel");
                }}
              >
                <option value="">{programme ? "Choose your level" : "Choose a programme first"}</option>
                {levels.map(l => (
                  <option key={l} value={l}>
                    {levelLabel(l)}
                  </option>
                ))}
              </select>
            </Field>
          </>
        ) : (
          (["faculty", "department", "programme"] as const).map(key => (
            <Field key={key} label={key[0].toUpperCase() + key.slice(1)} error={errors[key]}>
              <Input
                value={text[key]}
                maxLength={120}
                disabled={busy}
                aria-invalid={Boolean(errors[key])}
                onChange={e => {
                  setText(t => ({ ...t, [key]: e.target.value }));
                  clear(key);
                }}
              />
            </Field>
          ))
        )}
        {!listed && (
          <Field label="Year" error={errors.academicLevel}>
            <Input
              value={level}
              maxLength={80}
              placeholder="e.g. 300"
              disabled={busy}
              aria-invalid={Boolean(errors.academicLevel)}
              onChange={e => {
                setLevel(e.target.value);
                clear("academicLevel");
              }}
            />
          </Field>
        )}
        <Field label="Semester" error={errors.semester}>
          <select className={selectClass} value={semester} disabled={busy} onChange={e => setSemester(e.target.value)}>
            {SEMESTERS.map(s => (
              <option key={s} value={s}>
                {s} semester
              </option>
            ))}
          </select>
        </Field>
        <Field label="Academic year" error={errors.academicYear}>
          <select className={selectClass} value={academicYear} disabled={busy} onChange={e => setAcademicYear(e.target.value)}>
            {yearOptions.map(y => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {ready && (
        <section className="space-y-2 rounded-xl border bg-muted/30 p-4">
          <h2 className="font-semibold">Courses for your programme</h2>
          {suggestions.isLoading ? (
            <p className="text-sm text-muted-foreground">Finding your courses…</p>
          ) : suggested.length ? (
            <>
              <p className="text-sm text-muted-foreground">
                These match {levelLabel(levelNumber)}, {semester} semester. Untick any you don't take; you can join others later with a course code.
              </p>
              <ul className="space-y-1.5">
                {suggested.map(course => (
                  <li key={course.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-emerald-700"
                        checked={chosen.has(course.id)}
                        disabled={busy}
                        onChange={e => {
                          const next = new Set(chosen);
                          if (e.target.checked) next.add(course.id);
                          else next.delete(course.id);
                          setPicked(next);
                        }}
                      />
                      <span className="font-medium">{course.code}</span> {course.title}
                    </label>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No courses are listed for this programme and year yet. You can join courses later with a course code.
            </p>
          )}
        </section>
      )}

      {listed && (
        <p className="text-xs text-muted-foreground">
          Your programme and year can only be changed by an administrator after you save, so check them carefully.
        </p>
      )}
      <Button disabled={busy}>{busy ? "Saving..." : "Save and continue"}</Button>
    </form>
  );
}
