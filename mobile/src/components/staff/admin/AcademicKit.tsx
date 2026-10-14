import { design } from "../../../theme/design";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "../../../lib/api";
import { validateText } from "../../../lib/validation";
import { colors } from "../../../theme/colors";
import { FIELD_ERROR_COLOR, FieldError } from "../../FieldError";
import { Card, ChipSelect, PrimaryButton } from "../StaffUi";
import {
  FilterLabel,
  OptionPicker,
  ReasonForm,
  Sheet,
  type PickOption,
} from "./AdminKit";
import {
  DEFAULT_PROGRAMME_YEARS,
  MAX_PROGRAMME_YEARS,
  MIN_PROGRAMME_YEARS,
  SEMESTERS,
  findProgramme,
  isSemester,
  levelLabel,
  levelsFor,
  parseLevel,
  yearsForProgrammes,
  type AcademicStatus,
  type CatalogueFaculty,
  type CatalogueProgramme,
  type CourseTags,
  type Semester,
  type Term,
} from "../../../../../shared/academics";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export type CourseTagDraft = {
  programmeIds: number[];
  level: number | null;
  semester: Semester | null;
};

export type StudentAcademicSummary = {
  programmeId: number | null;
  programme: string | null;
  level: string | null;
  status: string;
};

export const NO_TAGS: CourseTagDraft = { programmeIds: [], level: null, semester: null };
const NAME_LIMITS = { min: 2, max: 120 };
const YEAR_OPTIONS = Array.from(
  { length: MAX_PROGRAMME_YEARS - MIN_PROGRAMME_YEARS + 1 },
  (_, i) => {
    const years = MIN_PROGRAMME_YEARS + i;
    return { value: years, label: `${years} year${years === 1 ? "" : "s"}` };
  }
);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function formatTerm(term: Term | null | undefined) {
  return term ? `${term.semester} semester ${term.academicYear}` : "—";
}

export function toTagDraft(tags: CourseTags | undefined): CourseTagDraft {
  if (!tags) return NO_TAGS;
  return {
    programmeIds: tags.programmeIds,
    level: tags.level,
    semester: isSemester(tags.semester) ? tags.semester : null,
  };
}

export function programmeNames(faculties: CatalogueFaculty[], ids: number[]) {
  return ids
    .map(id => findProgramme(faculties, id)?.programme.name)
    .filter((name): name is string => !!name);
}

export function courseTagText(tags: CourseTags | undefined, faculties: CatalogueFaculty[]) {
  const names = tags ? programmeNames(faculties, tags.programmeIds) : [];
  const detail = [
    tags?.level ? levelLabel(tags.level) : null,
    tags?.semester ? `${tags.semester} semester` : null,
  ].filter(Boolean);
  if (!names.length && !detail.length) return "Not tagged";
  return [names.length ? names.join(", ") : "Any programme", ...detail].join(" · ");
}

export function programmePickOptions(faculties: CatalogueFaculty[]): PickOption[] {
  return faculties.flatMap(f =>
    f.departments.flatMap(d =>
      d.programmes.map(p => ({
        id: p.id,
        title: `${p.name}${p.isActive ? "" : " (closed)"}`,
        subtitle: `${f.name} · ${d.name}`,
      }))
    )
  );
}

export function studentAcademicLine(academic: StudentAcademicSummary | null | undefined) {
  if (!academic?.programme) return "Programme not set";
  return `${academic.programme} · ${academic.status === "completed" ? "Completed" : levelLabel(academic.level)}`;
}

function useCatalogueActions() {
  const utils = trpc.useUtils();
  const refresh = () => {
    void utils.academics.invalidate();
    void utils.admin.listUsers.invalidate();
  };
  const onError = (err: { message: string }) => Alert.alert("Could not save", err.message);
  return {
    saveFaculty: trpc.academics.admin.saveFaculty.useMutation({ onSuccess: refresh, onError }),
    saveDepartment: trpc.academics.admin.saveDepartment.useMutation({ onSuccess: refresh, onError }),
    saveProgramme: trpc.academics.admin.saveProgramme.useMutation({ onSuccess: refresh, onError }),
    remove: trpc.academics.admin.deleteItem.useMutation({
      onSuccess: refresh,
      onError: err => Alert.alert("Could not delete", err.message),
    }),
  };
}

type CatalogueActions = ReturnType<typeof useCatalogueActions>;

function IconButton({
  icon,
  label,
  onPress,
  danger,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[st.iconBtn, disabled && st.off]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={16} color={danger ? colors.error : colors.textMuted} />
    </TouchableOpacity>
  );
}

function NameInput({
  value,
  onChangeText,
  placeholder,
  error,
  onSubmit,
  autoFocus,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  error?: string | null;
  onSubmit: () => void;
  autoFocus?: boolean;
}) {
  return (
    <TextInput
      style={[st.nameInput, !!error && { borderColor: FIELD_ERROR_COLOR }]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textLight}
      maxLength={NAME_LIMITS.max}
      autoFocus={autoFocus}
      returnKeyType="done"
      onSubmitEditing={onSubmit}
      accessibilityLabel={placeholder ?? "Name"}
    />
  );
}

function InlineAdd({
  placeholder,
  onAdd,
  children,
}: {
  placeholder: string;
  onAdd: (name: string) => Promise<unknown>;
  children?: ReactNode;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const problem = validateText(name, { label: "Name", ...NAME_LIMITS });
    setError(problem);
    if (problem) return;
    setBusy(true);
    const ok = await onAdd(name.trim()).then(
      () => true,
      () => false
    );
    setBusy(false);
    if (ok) setName("");
  };
  return (
    <View style={st.add}>
      {children}
      <View style={st.inputRow}>
        <NameInput
          value={name}
          onChangeText={v => {
            setName(v);
            setError(null);
          }}
          placeholder={placeholder}
          error={error}
          onSubmit={() => void submit()}
        />
        <TouchableOpacity
          style={[st.addBtn, busy && st.off]}
          onPress={() => void submit()}
          disabled={busy}
          accessibilityLabel={placeholder}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="add" size={16} color={colors.primary} />
          )}
          <Text style={st.addText}>Add</Text>
        </TouchableOpacity>
      </View>
      <FieldError message={error} />
    </View>
  );
}

function NameRow({
  name,
  what,
  subtitle,
  closed,
  titleStyle,
  expanded,
  onToggle,
  onRename,
  onDelete,
}: {
  name: string;
  what: string;
  subtitle?: string;
  closed?: boolean;
  titleStyle: StyleProp<TextStyle>;
  expanded?: boolean;
  onToggle?: () => void;
  onRename: (name: string) => Promise<unknown>;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cancel = () => {
    setDraft(null);
    setError(null);
  };
  const save = async () => {
    const next = (draft ?? "").trim();
    if (next === name) return cancel();
    const problem = validateText(next, { label: "Name", ...NAME_LIMITS });
    setError(problem);
    if (problem) return;
    setBusy(true);
    const ok = await onRename(next).then(
      () => true,
      () => false
    );
    setBusy(false);
    if (ok) cancel();
  };

  if (draft !== null) {
    return (
      <View>
        <View style={st.inputRow}>
          <NameInput
            value={draft}
            onChangeText={v => {
              setDraft(v);
              setError(null);
            }}
            placeholder={`New name for this ${what}`}
            error={error}
            onSubmit={() => void save()}
            autoFocus
          />
          <IconButton icon="checkmark" label={`Save ${what} name`} onPress={() => void save()} disabled={busy} />
          <IconButton icon="close" label="Cancel rename" onPress={cancel} />
        </View>
        <FieldError message={error} />
      </View>
    );
  }

  const label = (
    <View style={{ flex: 1 }}>
      <Text style={[titleStyle, closed && st.closed]} numberOfLines={2}>
        {name}
      </Text>
      {subtitle ? <Text style={st.caption}>{subtitle}</Text> : null}
    </View>
  );
  return (
    <View style={st.nameRow}>
      {onToggle ? (
        <TouchableOpacity
          style={st.toggle}
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
        >
          <Ionicons
            name={expanded ? "chevron-down" : "chevron-forward"}
            size={16}
            color={colors.textMuted}
          />
          {label}
        </TouchableOpacity>
      ) : (
        label
      )}
      <IconButton icon="pencil" label={`Rename ${name}`} onPress={() => setDraft(name)} />
      <IconButton icon="trash-outline" label={`Delete ${name}`} danger onPress={onDelete} />
    </View>
  );
}

function ProgrammeRow({
  programme,
  departmentId,
  students,
  actions,
  onDelete,
}: {
  programme: CatalogueProgramme;
  departmentId: number;
  students: number;
  actions: CatalogueActions;
  onDelete: () => void;
}) {
  const base = {
    id: programme.id,
    departmentId,
    name: programme.name,
    durationYears: programme.durationYears,
    isActive: programme.isActive,
  };
  return (
    <View style={st.programme}>
      <NameRow
        name={programme.name}
        what="programme"
        subtitle={`${plural(students, "student")}${programme.isActive ? "" : " · Closed"}`}
        closed={!programme.isActive}
        titleStyle={st.programmeTitle}
        onRename={name => actions.saveProgramme.mutateAsync({ ...base, name })}
        onDelete={onDelete}
      />
      <Text style={st.smallLabel}>Programme length</Text>
      <ChipSelect<number>
        value={programme.durationYears}
        onChange={years => {
          if (years !== programme.durationYears) {
            actions.saveProgramme.mutate({ ...base, durationYears: years });
          }
        }}
        options={YEAR_OPTIONS}
      />
      <View style={st.switchRow}>
        <Text style={st.switchLabel}>Open to new students</Text>
        <Switch
          value={programme.isActive}
          onValueChange={isActive => actions.saveProgramme.mutate({ ...base, isActive })}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor={colors.white}
          accessibilityLabel={`${programme.name} open to new students`}
        />
      </View>
    </View>
  );
}

/** Faculties, their departments and programmes, which students choose from in profile setup. */
export function ProgrammeCatalogue() {
  const catalogue = trpc.academics.admin.catalogue.useQuery();
  const actions = useCatalogueActions();
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [years, setYears] = useState<Record<number, number>>({});
  const faculties = catalogue.data?.faculties ?? [];
  const counts: Record<number, number> = catalogue.data?.studentCounts ?? {};

  const confirmDelete = (
    kind: "faculty" | "department" | "programme",
    id: number,
    name: string
  ) =>
    Alert.alert(`Delete ${name}?`, "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => actions.remove.mutate({ kind, id }),
      },
    ]);

  return (
    <Card>
      <Text style={st.cardTitle}>Faculties and programmes</Text>
      <Text style={st.cardBody}>
        Students pick their programme from these lists when they set up their
        profile. Turn a programme off to stop new students choosing it.
      </Text>
      {catalogue.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 14 }} />
      ) : catalogue.error ? (
        <Text style={st.error}>{catalogue.error.message}</Text>
      ) : !faculties.length ? (
        <Text style={st.emptyNote}>
          No faculties yet. Until you add programmes, students type their
          faculty, department and programme by hand.
        </Text>
      ) : null}

      {faculties.map(faculty => {
        const expanded = open[faculty.id] ?? faculties.length === 1;
        const programmeCount = faculty.departments.reduce(
          (n, d) => n + d.programmes.length,
          0
        );
        return (
          <View key={faculty.id} style={st.faculty}>
            <View style={st.facultyHead}>
              <NameRow
                name={faculty.name}
                what="faculty"
                subtitle={`${plural(faculty.departments.length, "department")} · ${plural(programmeCount, "programme")}`}
                titleStyle={st.facultyTitle}
                expanded={expanded}
                onToggle={() => setOpen(v => ({ ...v, [faculty.id]: !expanded }))}
                onRename={name => actions.saveFaculty.mutateAsync({ id: faculty.id, name })}
                onDelete={() => confirmDelete("faculty", faculty.id, faculty.name)}
              />
            </View>
            {expanded ? (
              <View style={st.facultyBody}>
                {faculty.departments.map(department => (
                  <View key={department.id} style={st.department}>
                    <NameRow
                      name={department.name}
                      what="department"
                      titleStyle={st.departmentTitle}
                      onRename={name =>
                        actions.saveDepartment.mutateAsync({
                          id: department.id,
                          facultyId: faculty.id,
                          name,
                        })
                      }
                      onDelete={() =>
                        confirmDelete("department", department.id, department.name)
                      }
                    />
                    {department.programmes.map(programme => (
                      <ProgrammeRow
                        key={programme.id}
                        programme={programme}
                        departmentId={department.id}
                        students={counts[programme.id] ?? 0}
                        actions={actions}
                        onDelete={() =>
                          confirmDelete("programme", programme.id, programme.name)
                        }
                      />
                    ))}
                    <InlineAdd
                      placeholder="New programme, e.g. BSc Computer Science"
                      onAdd={name =>
                        actions.saveProgramme.mutateAsync({
                          departmentId: department.id,
                          name,
                          durationYears: years[department.id] ?? DEFAULT_PROGRAMME_YEARS,
                          isActive: true,
                        })
                      }
                    >
                      <Text style={st.smallLabel}>New programme length</Text>
                      <ChipSelect<number>
                        value={years[department.id] ?? DEFAULT_PROGRAMME_YEARS}
                        onChange={y => setYears(v => ({ ...v, [department.id]: y }))}
                        options={YEAR_OPTIONS}
                      />
                    </InlineAdd>
                  </View>
                ))}
                <InlineAdd
                  placeholder={`New department in ${faculty.name}`}
                  onAdd={name =>
                    actions.saveDepartment.mutateAsync({ facultyId: faculty.id, name })
                  }
                />
              </View>
            ) : null}
          </View>
        );
      })}

      <InlineAdd
        placeholder="New faculty, e.g. Technology & Engineering"
        onAdd={name => actions.saveFaculty.mutateAsync({ name })}
      />
    </Card>
  );
}

/** The institution's current semester, and the action that moves everyone to the next one. */
export function AcademicTermCard() {
  const utils = trpc.useUtils();
  const catalogue = trpc.academics.admin.catalogue.useQuery();
  const [open, setOpen] = useState(false);
  const preview = trpc.academics.admin.previewNewTerm.useQuery(undefined, {
    enabled: open,
    retry: false,
  });
  const start = trpc.academics.admin.startNewTerm.useMutation({
    onSuccess: summary => {
      setOpen(false);
      void utils.academics.invalidate();
      void utils.admin.listUsers.invalidate();
      void utils.admin.getUserDetail.invalidate();
      void utils.admin.settings.get.invalidate();
      Alert.alert(
        "New semester started",
        `${formatTerm(summary.next)} has started. ${plural(summary.students, "student")} moved to the new semester.`
      );
    },
    onError: err => {
      void utils.academics.invalidate();
      Alert.alert("Could not start the semester", err.message);
    },
  });
  const p = preview.data;

  return (
    <Card>
      <View style={st.termRow}>
        <View style={st.termIcon}>
          <Ionicons name="calendar-outline" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.eyebrow}>Current term</Text>
          <Text style={st.termText}>
            {catalogue.isLoading ? "Loading…" : formatTerm(catalogue.data?.term)}
          </Text>
        </View>
      </View>
      <Text style={st.cardBody}>
        Students' semester and year move forward together when you start a new
        semester.
      </Text>
      <View style={{ marginTop: 12 }}>
        <PrimaryButton
          label="Start new semester"
          icon="play-forward-outline"
          onPress={() => setOpen(true)}
        />
      </View>

      <Sheet
        visible={open}
        title="Start a new semester"
        hint="Check what will change before you confirm. This can't be undone automatically."
        onClose={() => setOpen(false)}
        cancelLabel="Cancel"
      >
        {preview.isLoading ? (
          <View style={st.previewLoading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={st.caption}>Working out the changes…</Text>
          </View>
        ) : preview.error ? (
          <Text style={st.error}>{preview.error.message}</Text>
        ) : p ? (
          <>
            <Text style={st.previewMove}>
              <Text style={st.bold}>{formatTerm(p.current)}</Text>
              {"  →  "}
              <Text style={st.bold}>{formatTerm(p.next)}</Text>
              {p.next.newYear ? " (new academic year)" : ""}
            </Text>
            <View style={st.summary}>
              <SummaryLine
                icon="people-outline"
                text={`${plural(p.students, "active student")} move to the new semester.`}
              />
              {p.next.newYear ? (
                <>
                  <SummaryLine
                    icon="trending-up-outline"
                    text={`${p.promoted} move up a year.`}
                  />
                  <SummaryLine
                    icon="ribbon-outline"
                    text={`${p.completed} finish their programme and are marked Completed.`}
                  />
                  {p.notPromoted > 0 ? (
                    <SummaryLine
                      icon="warning-outline"
                      warn
                      text={`${p.notPromoted} can't be promoted automatically because their programme or level wasn't picked from the list. Set them in Users.`}
                    />
                  ) : null}
                </>
              ) : null}
            </View>
            <ReasonForm
              confirmLabel={`Start ${formatTerm(p.next)}`}
              loading={start.isPending}
              placeholder="e.g. Second semester begins"
              resetKey={open}
              onSubmit={reason => start.mutate({ expected: p.current, reason })}
            />
          </>
        ) : null}
      </Sheet>
    </Card>
  );
}

function SummaryLine({ icon, text, warn }: { icon: IconName; text: string; warn?: boolean }) {
  const color = warn ? "#b45309" : colors.textSub;
  return (
    <View style={st.summaryLine}>
      <Ionicons name={icon} size={15} color={color} style={{ marginTop: 2 }} />
      <Text style={[st.summaryText, { color }]}>{text}</Text>
    </View>
  );
}

/** Programme, level and semester tags for a course; used when creating and editing courses. */
export function CourseTagFields({
  value,
  onChange,
  faculties,
}: {
  value: CourseTagDraft;
  onChange: (next: CourseTagDraft) => void;
  faculties: CatalogueFaculty[];
}) {
  const groups = faculties.flatMap(f =>
    f.departments
      .filter(d => d.programmes.length)
      .map(d => ({ id: d.id, label: `${f.name} · ${d.name}`, programmes: d.programmes }))
  );
  const years = yearsForProgrammes(faculties, value.programmeIds);
  const toggle = (id: number) => {
    const programmeIds = value.programmeIds.includes(id)
      ? value.programmeIds.filter(p => p !== id)
      : [...value.programmeIds, id];
    const level =
      value.level && yearsForProgrammes(faculties, programmeIds).includes(value.level) ? value.level : null;
    onChange({ ...value, programmeIds, level });
  };

  return (
    <>
      <FilterLabel>
        {`Programmes (optional)${value.programmeIds.length ? ` · ${value.programmeIds.length} selected` : ""}`}
      </FilterLabel>
      {groups.length ? (
        <View style={st.picker}>
          <ScrollView
            nestedScrollEnabled
            style={{ maxHeight: 240 }}
            keyboardShouldPersistTaps="handled"
          >
            {groups.map(group => (
              <View key={group.id}>
                <Text style={st.groupLabel} numberOfLines={1}>
                  {group.label}
                </Text>
                {group.programmes.map(programme => {
                  const checked = value.programmeIds.includes(programme.id);
                  return (
                    <TouchableOpacity
                      key={programme.id}
                      style={[st.checkRow, checked && st.checkRowActive]}
                      onPress={() => toggle(programme.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
                    >
                      <Ionicons
                        name={checked ? "checkbox" : "square-outline"}
                        size={19}
                        color={checked ? colors.primary : colors.textLight}
                      />
                      <Text style={st.checkText} numberOfLines={2}>
                        {programme.name}
                        {programme.isActive ? "" : " (closed)"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      ) : (
        <Text style={st.emptyNote}>
          Add programmes under Faculties and programmes to tag courses.
        </Text>
      )}
      <FilterLabel>Year</FilterLabel>
      <ChipSelect<number>
        value={value.level ?? 0}
        onChange={level => onChange({ ...value, level: level || null })}
        options={[
          { value: 0, label: "Any year" },
          ...years.map(l => ({ value: l, label: levelLabel(l) })),
        ]}
      />
      <FilterLabel>Semester</FilterLabel>
      <ChipSelect<string>
        value={value.semester ?? "any"}
        onChange={s => onChange({ ...value, semester: isSemester(s) ? s : null })}
        options={[
          { value: "any", label: "Both semesters" },
          ...SEMESTERS.map(s => ({ value: s, label: `${s} semester` })),
        ]}
      />
    </>
  );
}

export type TaggedCourse = { courseId: number; title: string; code: string };

export function CourseTagsSheet({
  course,
  tags,
  faculties,
  onClose,
}: {
  course: TaggedCourse | null;
  tags: CourseTags | undefined;
  faculties: CatalogueFaculty[];
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState<CourseTagDraft | null>(null);
  const close = () => {
    setDraft(null);
    onClose();
  };
  const save = trpc.academics.admin.setCourseTags.useMutation({
    onSuccess: () => {
      void utils.academics.admin.courseTags.invalidate();
      close();
      Alert.alert("Course tags saved", "Matching students now see this course suggested.");
    },
    onError: err => Alert.alert("Could not save tags", err.message),
  });
  const value = draft ?? toTagDraft(tags);

  return (
    <Sheet
      visible={!!course}
      title="Course tags"
      hint={
        course
          ? `${course.code} — ${course.title}. Students in these programmes see this course suggested during profile setup.`
          : null
      }
      onClose={close}
      cancelLabel="Cancel"
    >
      <CourseTagFields value={value} onChange={setDraft} faculties={faculties} />
      <PrimaryButton
        label="Save tags"
        icon="pricetags-outline"
        loading={save.isPending}
        onPress={() => course && save.mutate({ courseId: course.courseId, ...value })}
      />
    </Sheet>
  );
}

/** Lets the admin set a student's programme and level, which students can't change themselves. */
export function StudentAcademicEditor({
  userId,
  academic,
  onSaved,
}: {
  userId: number;
  academic: StudentAcademicSummary | null;
  onSaved: () => void;
}) {
  const utils = trpc.useUtils();
  const catalogue = trpc.academics.admin.catalogue.useQuery();
  const [programmeId, setProgrammeId] = useState<number | null>(academic?.programmeId ?? null);
  const [level, setLevel] = useState<number | null>(parseLevel(academic?.level));
  const [status, setStatus] = useState<AcademicStatus>(
    academic?.status === "completed" ? "completed" : "active"
  );
  const save = trpc.academics.admin.setStudentAcademic.useMutation({
    onSuccess: () => {
      void utils.admin.listUsers.invalidate();
      void utils.admin.getUserDetail.invalidate();
      void utils.academics.invalidate();
      Alert.alert("Academic details saved", "The student's programme and year were updated.");
      onSaved();
    },
    onError: err => Alert.alert("Could not save", err.message),
  });

  const faculties = catalogue.data?.faculties ?? [];
  const selected = findProgramme(faculties, programmeId);
  const levels = selected ? levelsFor(selected.programme.durationYears) : [];

  if (catalogue.isLoading) {
    return <ActivityIndicator color={colors.primary} style={{ marginVertical: 14 }} />;
  }
  if (!faculties.length) {
    return (
      <Text style={st.emptyNote}>
        Add programmes on the Academic screen to set this student's programme
        and year.
      </Text>
    );
  }
  return (
    <>
      <FilterLabel>Programme</FilterLabel>
      <OptionPicker
        options={programmePickOptions(faculties)}
        value={programmeId}
        onChange={id => {
          setProgrammeId(id);
          const years = findProgramme(faculties, id)?.programme.durationYears ?? 0;
          if (level && !levelsFor(years).includes(level)) setLevel(null);
        }}
        emptyText="No programmes yet."
      />
      <FilterLabel>Year</FilterLabel>
      {selected ? (
        <ChipSelect<number>
          value={level}
          onChange={setLevel}
          options={levels.map(l => ({ value: l, label: levelLabel(l) }))}
        />
      ) : (
        <Text style={st.emptyNote}>Choose a programme to see its levels.</Text>
      )}
      <FilterLabel>Study status</FilterLabel>
      <ChipSelect<AcademicStatus>
        value={status}
        onChange={setStatus}
        options={[
          { value: "active", label: "Studying" },
          { value: "completed", label: "Completed" },
        ]}
      />
      <ReasonForm
        confirmLabel="Save academic details"
        loading={save.isPending}
        disabled={!programmeId || !level}
        placeholder="e.g. Corrected programme"
        resetKey={userId}
        onSubmit={reason => {
          if (programmeId && level) {
            save.mutate({ userId, programmeId, level, status, reason });
          }
        }}
      />
    </>
  );
}

const st = StyleSheet.create({
  cardTitle: { ...design.sectionTitle },
  cardBody: { marginTop: 4, ...design.body },
  eyebrow: { ...design.eyebrow },
  caption: { marginTop: 2, ...design.caption },
  bold: { fontWeight: "800", color: colors.text },
  error: { marginTop: 10, fontSize: 13, lineHeight: 19, color: colors.error },
  emptyNote: { marginTop: 4, marginBottom: 12, ...design.caption },
  off: { opacity: 0.4 },
  closed: { color: colors.textLight, textDecorationLine: "line-through" },
  termRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  termIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  termText: { marginTop: 2, ...design.sectionTitle },
  previewLoading: { alignItems: "center", gap: 8, paddingVertical: 16 },
  previewMove: { ...design.body, marginBottom: 10 },
  summary: {
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    marginBottom: 14,
  },
  summaryLine: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  summaryText: { flex: 1, fontSize: 13, lineHeight: 19 },
  faculty: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: "hidden",
  },
  facultyHead: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surfaceAlt,
  },
  facultyTitle: { ...design.cardTitle },
  facultyBody: { padding: 12, gap: 12 },
  department: {
    padding: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 12,
    gap: 8,
  },
  departmentTitle: { ...design.cardTitle, fontSize: 14 },
  programme: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
  },
  programmeTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  toggle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  iconBtn: { padding: 6, borderRadius: 8 },
  smallLabel: {
    marginTop: 8,
    marginBottom: 6,
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchLabel: { fontSize: 13, color: colors.textSub, fontWeight: "600" },
  add: { marginTop: 12 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nameInput: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
  },
  addText: { fontSize: 13, fontWeight: "700", color: colors.primary },
  picker: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    marginBottom: 12,
    overflow: "hidden",
  },
  groupLabel: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
    fontSize: 11,
    fontWeight: "800",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  checkRowActive: { backgroundColor: colors.primaryLight },
  checkText: { flex: 1, fontSize: 14, color: colors.text },
});
