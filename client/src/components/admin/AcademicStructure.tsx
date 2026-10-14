import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CalendarClock, GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldError } from "@/components/FieldError";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import {
  DEFAULT_PROGRAMME_YEARS,
  MAX_PROGRAMME_YEARS,
  MIN_PROGRAMME_YEARS,
  SEMESTERS,
  levelLabel,
  levelsFor,
  parseLevel,
  yearsForProgrammes,
  type CatalogueFaculty,
  type CourseTags,
} from "@shared/academics";
import { LIMITS, validateText } from "@shared/validation";

const sectionClass = "rounded-[1.25rem] border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]";
const smallSelect = "h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700";
const YEARS = Array.from({ length: MAX_PROGRAMME_YEARS - MIN_PROGRAMME_YEARS + 1 }, (_, i) => MIN_PROGRAMME_YEARS + i);
function useCatalogueActions() {
  const utils = trpc.useUtils();
  const refresh = () => {
    void utils.academics.invalidate();
    void utils.admin.listUsers.invalidate();
  };
  const onError = (error: { message: string }) => toast.error(error.message);
  return {
    saveFaculty: trpc.academics.admin.saveFaculty.useMutation({ onSuccess: refresh, onError }),
    saveDepartment: trpc.academics.admin.saveDepartment.useMutation({ onSuccess: refresh, onError }),
    saveProgramme: trpc.academics.admin.saveProgramme.useMutation({ onSuccess: refresh, onError }),
    remove: trpc.academics.admin.deleteItem.useMutation({ onSuccess: refresh, onError }),
  };
}

function InlineAdd({ placeholder, onAdd, children }: { placeholder: string; onAdd: (name: string) => Promise<unknown>; children?: ReactNode }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-1"
      onSubmit={async e => {
        e.preventDefault();
        const problem = validateText(name, { label: "Name", min: 2, max: 120 });
        setError(problem);
        if (problem) return;
        setBusy(true);
        try {
          await onAdd(name.trim());
          setName("");
        } catch {
          // The mutation's onError already shows the message.
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={name}
          maxLength={120}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          onChange={e => {
            setName(e.target.value);
            setError(null);
          }}
          className="h-8 min-w-0 flex-1 rounded-lg text-xs"
        />
        {children}
        <Button type="submit" size="sm" variant="outline" disabled={busy} className="h-8 gap-1 rounded-lg text-xs">
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
      <FieldError message={error} />
    </form>
  );
}

function renamed(current: string, what: string) {
  const next = window.prompt(`New name for this ${what}`, current)?.trim();
  if (!next || next === current) return null;
  const problem = validateText(next, { label: "Name", min: 2, max: 120 });
  if (problem) {
    toast.error(problem);
    return null;
  }
  return next;
}

function IconButton({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`rounded-md p-1 text-slate-400 hover:bg-slate-100 ${danger ? "hover:text-red-600" : "hover:text-slate-700"}`}
    >
      {children}
    </button>
  );
}

/** Faculties, their departments and programmes, which students choose from in profile setup. */
export function ProgrammeCatalogue() {
  const catalogue = trpc.academics.admin.catalogue.useQuery();
  const actions = useCatalogueActions();
  const [years, setYears] = useState<Record<number, number>>({});
  const faculties = catalogue.data?.faculties ?? [];
  const counts = catalogue.data?.studentCounts ?? {};
  const confirmDelete = (kind: "faculty" | "department" | "programme", id: number, name: string) => {
    if (window.confirm(`Delete ${name}? This cannot be undone.`)) actions.remove.mutate({ kind, id });
  };

  return (
    <section className={sectionClass}>
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <GraduationCap className="h-5 w-5" strokeWidth={1.7} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Faculties and programmes</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Students pick their programme from these lists when they set up their profile. Turn a programme off to stop new students choosing it.
          </p>
        </div>
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        {catalogue.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : !faculties.length ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-slate-500">
            No faculties yet. Until you add programmes, students type their faculty, department and programme by hand.
          </p>
        ) : null}
        {faculties.map((faculty: CatalogueFaculty) => (
          <div key={faculty.id} className="rounded-xl border border-slate-200">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
              <p className="font-semibold text-slate-900">{faculty.name}</p>
              <div className="flex items-center gap-1">
                <IconButton
                  label={`Rename ${faculty.name}`}
                  onClick={() => {
                    const name = renamed(faculty.name, "faculty");
                    if (name) actions.saveFaculty.mutate({ id: faculty.id, name });
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton label={`Delete ${faculty.name}`} danger onClick={() => confirmDelete("faculty", faculty.id, faculty.name)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
              </div>
            </div>
            <div className="space-y-3 p-4">
              {faculty.departments.map(department => (
                <div key={department.id} className="space-y-2 rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{department.name}</p>
                    <div className="flex items-center gap-1">
                      <IconButton
                        label={`Rename ${department.name}`}
                        onClick={() => {
                          const name = renamed(department.name, "department");
                          if (name) actions.saveDepartment.mutate({ id: department.id, facultyId: faculty.id, name });
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton label={`Delete ${department.name}`} danger onClick={() => confirmDelete("department", department.id, department.name)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>
                  </div>
                  {department.programmes.map(programme => {
                    const save = (patch: Partial<{ name: string; durationYears: number; isActive: boolean }>) =>
                      actions.saveProgramme.mutate({
                        id: programme.id,
                        departmentId: department.id,
                        name: programme.name,
                        durationYears: programme.durationYears,
                        isActive: programme.isActive,
                        ...patch,
                      });
                    const students = counts[programme.id] ?? 0;
                    return (
                      <div key={programme.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <span className={`min-w-0 flex-1 font-medium ${programme.isActive ? "text-slate-900" : "text-slate-400 line-through"}`}>
                          {programme.name}
                        </span>
                        <span className="text-xs text-slate-500">
                          {students} student{students === 1 ? "" : "s"}
                        </span>
                        <select
                          aria-label={`Length of ${programme.name}`}
                          className={smallSelect}
                          value={programme.durationYears}
                          onChange={e => save({ durationYears: Number(e.target.value) })}
                        >
                          {YEARS.map(y => (
                            <option key={y} value={y}>
                              {y} year{y === 1 ? "" : "s"}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            className="accent-emerald-700"
                            checked={programme.isActive}
                            onChange={e => save({ isActive: e.target.checked })}
                          />
                          Open to new students
                        </label>
                        <IconButton
                          label={`Rename ${programme.name}`}
                          onClick={() => {
                            const name = renamed(programme.name, "programme");
                            if (name) save({ name });
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton label={`Delete ${programme.name}`} danger onClick={() => confirmDelete("programme", programme.id, programme.name)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </IconButton>
                      </div>
                    );
                  })}
                  <InlineAdd
                    placeholder={`New programme in ${department.name}, e.g. BSc Computer Science`}
                    onAdd={name =>
                      actions.saveProgramme.mutateAsync({
                        departmentId: department.id,
                        name,
                        durationYears: years[department.id] ?? DEFAULT_PROGRAMME_YEARS,
                        isActive: true,
                      })
                    }
                  >
                    <select
                      aria-label="Programme length"
                      className={smallSelect}
                      value={years[department.id] ?? DEFAULT_PROGRAMME_YEARS}
                      onChange={e => setYears(v => ({ ...v, [department.id]: Number(e.target.value) }))}
                    >
                      {YEARS.map(y => (
                        <option key={y} value={y}>
                          {y} year{y === 1 ? "" : "s"}
                        </option>
                      ))}
                    </select>
                  </InlineAdd>
                </div>
              ))}
              <InlineAdd
                placeholder={`New department in ${faculty.name}`}
                onAdd={name => actions.saveDepartment.mutateAsync({ facultyId: faculty.id, name })}
              />
            </div>
          </div>
        ))}
        <InlineAdd placeholder="New faculty, e.g. Technology & Engineering" onAdd={name => actions.saveFaculty.mutateAsync({ name })} />
      </div>
    </section>
  );
}

/** The institution's current semester, and the action that moves everyone to the next one. */
export function AcademicTermCard() {
  const utils = trpc.useUtils();
  const catalogue = trpc.academics.admin.catalogue.useQuery();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const preview = trpc.academics.admin.previewNewTerm.useQuery(undefined, { enabled: open, retry: false });
  const start = trpc.academics.admin.startNewTerm.useMutation({
    onSuccess: summary => {
      toast.success(`Started ${summary.next.semester} semester ${summary.next.academicYear}.`);
      setOpen(false);
      setReason("");
      void utils.academics.invalidate();
      void utils.admin.listUsers.invalidate();
      void utils.admin.settings.get.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const term = catalogue.data?.term;
  const p = preview.data;

  return (
    <section className={`${sectionClass} flex flex-wrap items-center gap-4 p-5 sm:p-6`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
        <CalendarClock className="h-5 w-5" strokeWidth={1.7} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current term</p>
        <p className="text-lg font-semibold text-slate-900">
          {term ? `${term.semester} semester · ${term.academicYear}` : "—"}
        </p>
        <p className="text-xs text-slate-500">Students' semester and year move forward together when you start a new semester.</p>
      </div>
      <Button onClick={() => setOpen(true)} className="h-10 rounded-full bg-[#033c35] px-4 text-sm font-semibold text-white hover:bg-[#045c50]">
        Start new semester
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Start a new semester</DialogTitle>
            <DialogDescription>Check what will change before you confirm. This can't be undone automatically.</DialogDescription>
          </DialogHeader>
          {preview.isLoading ? (
            <p className="text-sm text-slate-500">Working out the changes…</p>
          ) : preview.error ? (
            <p className="text-sm text-red-600">{preview.error.message}</p>
          ) : p ? (
            <div className="space-y-3 text-sm">
              <p>
                <b>
                  {p.current.semester} {p.current.academicYear}
                </b>{" "}
                →{" "}
                <b>
                  {p.next.semester} {p.next.academicYear}
                </b>
                {p.next.newYear ? " (new academic year)" : ""}
              </p>
              <ul className="space-y-1 rounded-xl bg-slate-50 p-3">
                <li>{p.students} active student{p.students === 1 ? "" : "s"} move to the new semester.</li>
                {p.next.newYear && (
                  <>
                    <li>{p.promoted} move up a year.</li>
                    <li>{p.completed} finish their programme and are marked Completed.</li>
                    {p.notPromoted > 0 && (
                      <li className="text-amber-700">
                        {p.notPromoted} can't be promoted automatically because their programme or level wasn't picked from the list. Set them in Users.
                      </li>
                    )}
                  </>
                )}
              </ul>
              <label className="block space-y-1.5">
                <span className="font-medium">Reason</span>
                <Input
                  value={reason}
                  maxLength={LIMITS.reason.max}
                  placeholder="e.g. Second semester begins"
                  aria-invalid={Boolean(error)}
                  onChange={e => {
                    setReason(e.target.value);
                    setError(null);
                  }}
                />
                <FieldError message={error} />
              </label>
              <Button
                disabled={start.isPending}
                onClick={() => {
                  const problem = validateText(reason, { label: "Reason", ...LIMITS.reason });
                  setError(problem);
                  if (!problem) start.mutate({ expected: p.current, reason: reason.trim() });
                }}
                className="w-full rounded-full bg-[#033c35] text-white hover:bg-[#045c50]"
              >
                {start.isPending ? "Starting…" : `Start ${p.next.semester} semester ${p.next.academicYear}`}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** Programme, level and semester tags for a course; used when creating and editing courses. */
export function CourseTagFields({
  value,
  onChange,
  faculties,
}: {
  value: CourseTags;
  onChange: (next: CourseTags) => void;
  faculties: CatalogueFaculty[];
}) {
  const years = yearsForProgrammes(faculties, value.programmeIds);
  const toggle = (id: number, on: boolean) => {
    const programmeIds = on ? [...value.programmeIds, id] : value.programmeIds.filter(p => p !== id);
    const level = value.level && yearsForProgrammes(faculties, programmeIds).includes(value.level) ? value.level : null;
    onChange({ ...value, programmeIds, level });
  };
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
      <div className="space-y-1.5">
        <span className="text-sm font-medium text-slate-700">Programmes (optional)</span>
        {faculties.length ? (
          <div className="max-h-44 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
            {faculties.flatMap(f =>
              f.departments.map(d => (
                <div key={d.id}>
                  <p className="text-xs font-semibold text-slate-500">
                    {f.name} · {d.name}
                  </p>
                  {d.programmes.map(p => (
                    <label key={p.id} className="flex items-center gap-2 py-0.5 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        className="accent-emerald-700"
                        checked={value.programmeIds.includes(p.id)}
                        onChange={e => toggle(p.id, e.target.checked)}
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
              ))
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Add programmes under Faculties and programmes to tag courses.</p>
        )}
      </div>
      <label className="space-y-1.5">
        <span className="text-sm font-medium text-slate-700">Year</span>
        <select
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
          value={value.level ?? ""}
          onChange={e => onChange({ ...value, level: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Any year</option>
          {years.map(l => (
            <option key={l} value={l}>
              {levelLabel(l)}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1.5">
        <span className="text-sm font-medium text-slate-700">Semester</span>
        <select
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
          value={value.semester ?? ""}
          onChange={e => onChange({ ...value, semester: e.target.value || null })}
        >
          <option value="">Both semesters</option>
          {SEMESTERS.map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

type CourseRef = { courseId: number; title: string; code: string };

export function CourseTagsDialog({
  course,
  tags,
  faculties,
  onClose,
}: {
  course: CourseRef | null;
  tags: CourseTags | undefined;
  faculties: CatalogueFaculty[];
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState<CourseTags | null>(null);
  const save = trpc.academics.admin.setCourseTags.useMutation({
    onSuccess: () => {
      toast.success("Course tags saved.");
      void utils.academics.admin.courseTags.invalidate();
      setDraft(null);
      onClose();
    },
    onError: e => toast.error(e.message),
  });
  const value = draft ?? tags ?? { programmeIds: [], level: null, semester: null };
  return (
    <Dialog
      open={Boolean(course)}
      onOpenChange={open => {
        if (!open) {
          setDraft(null);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {course?.code} — {course?.title}
          </DialogTitle>
          <DialogDescription>Students in these programmes see this course suggested during profile setup.</DialogDescription>
        </DialogHeader>
        <CourseTagFields value={value} onChange={setDraft} faculties={faculties} />
        <Button
          disabled={save.isPending || !course}
          onClick={() =>
            course &&
            save.mutate({
              courseId: course.courseId,
              programmeIds: value.programmeIds,
              level: value.level,
              semester: (value.semester as (typeof SEMESTERS)[number] | null) ?? null,
            })
          }
          className="rounded-full bg-[#033c35] text-white hover:bg-[#045c50]"
        >
          {save.isPending ? "Saving…" : "Save tags"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

type StudentAcademic = NonNullable<RouterOutputs["admin"]["listUsers"]["items"][number]["academic"]>;

/** Lets the admin set a student's programme and level, which students can't change themselves. */
export function StudentAcademicEditor({
  userId,
  academic,
  onSaved,
}: {
  userId: number;
  academic: StudentAcademic | null;
  onSaved: (next: StudentAcademic) => void;
}) {
  const utils = trpc.useUtils();
  const catalogue = trpc.academics.admin.catalogue.useQuery();
  const [programmeId, setProgrammeId] = useState(academic?.programmeId ?? 0);
  const [level, setLevel] = useState(parseLevelNumber(academic?.level));
  const [status, setStatus] = useState<"active" | "completed">(academic?.status === "completed" ? "completed" : "active");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const save = trpc.academics.admin.setStudentAcademic.useMutation({
    onSuccess: next => {
      toast.success("Academic details saved.");
      setReason("");
      void utils.admin.listUsers.invalidate();
      void utils.academics.admin.catalogue.invalidate();
      onSaved(next);
    },
    onError: e => toast.error(e.message),
  });
  const faculties = catalogue.data?.faculties ?? [];
  const programme = faculties.flatMap(f => f.departments.flatMap(d => d.programmes)).find(p => p.id === programmeId);
  const levels = programme ? levelsFor(programme.durationYears) : [];
  if (!faculties.length) {
    return <p className="text-xs text-slate-500">Add programmes on the Academic page to set this student's programme and year.</p>;
  }
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Set programme and year</p>
      <select
        aria-label="Programme"
        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
        value={programmeId}
        onChange={e => {
          const id = Number(e.target.value);
          setProgrammeId(id);
          const years = faculties.flatMap(f => f.departments.flatMap(d => d.programmes)).find(p => p.id === id)?.durationYears ?? 0;
          if (!levelsFor(years).includes(level)) setLevel(0);
          setErrors(v => ({ ...v, programme: null }));
        }}
      >
        <option value={0}>Choose a programme</option>
        {faculties.flatMap(f =>
          f.departments.map(d => (
            <optgroup key={d.id} label={`${f.name} · ${d.name}`}>
              {d.programmes.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.isActive ? "" : " (closed)"}
                </option>
              ))}
            </optgroup>
          ))
        )}
      </select>
      <FieldError message={errors.programme} />
      <div className="grid grid-cols-2 gap-2">
        <select
          aria-label="Year"
          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm"
          value={level}
          disabled={!programme}
          onChange={e => {
            setLevel(Number(e.target.value));
            setErrors(v => ({ ...v, level: null }));
          }}
        >
          <option value={0}>Year</option>
          {levels.map(l => (
            <option key={l} value={l}>
              {levelLabel(l)}
            </option>
          ))}
        </select>
        <select
          aria-label="Status"
          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm"
          value={status}
          onChange={e => setStatus(e.target.value as "active" | "completed")}
        >
          <option value="active">Studying</option>
          <option value="completed">Completed</option>
        </select>
      </div>
      <FieldError message={errors.level} />
      <Input
        value={reason}
        maxLength={LIMITS.reason.max}
        placeholder="Reason, e.g. Corrected programme"
        aria-invalid={Boolean(errors.reason)}
        onChange={e => {
          setReason(e.target.value);
          setErrors(v => ({ ...v, reason: null }));
        }}
        className="h-9 rounded-lg text-sm"
      />
      <FieldError message={errors.reason} />
      <Button
        size="sm"
        disabled={save.isPending}
        className="w-full rounded-lg bg-[#033c35] text-white hover:bg-[#045c50]"
        onClick={() => {
          const next = {
            programme: programmeId ? null : "Choose a programme.",
            level: level ? null : "Choose a year.",
            reason: validateText(reason, { label: "Reason", ...LIMITS.reason }),
          };
          setErrors(next);
          if (Object.values(next).some(Boolean)) return;
          save.mutate({ userId, programmeId, level, status, reason: reason.trim() });
        }}
      >
        {save.isPending ? "Saving…" : "Save academic details"}
      </Button>
    </div>
  );
}

function parseLevelNumber(value: string | null | undefined) {
  return parseLevel(value) ?? 0;
}

export function programmeNames(faculties: CatalogueFaculty[], ids: number[]) {
  const names = new Map(faculties.flatMap(f => f.departments.flatMap(d => d.programmes.map(p => [p.id, p.name] as const))));
  return ids.map(id => names.get(id)).filter(Boolean) as string[];
}

export type AdminCatalogue = RouterOutputs["academics"]["admin"]["catalogue"];
