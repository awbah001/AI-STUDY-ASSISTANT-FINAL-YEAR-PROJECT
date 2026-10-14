import { design } from "../../src/theme/design";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";
import {
  Card,
  EmptyState,
  formatDate,
  FormField,
  Loading,
  PrimaryButton,
  SectionHeader,
  StaffHeader,
  StaffScreen,
} from "../../src/components/staff/StaffUi";
import {
  FilterLabel,
  InlineButton,
  MetricGrid,
  MetricTile,
  OptionPicker,
  ReasonForm,
  ScoreBar,
  scoreColor,
  Sheet,
  type PickOption,
} from "../../src/components/staff/admin/AdminKit";
import {
  UserDetailSheet,
  type UserSummary,
} from "../../src/components/staff/admin/UserDetailSheet";
import {
  AcademicTermCard,
  CourseTagFields,
  CourseTagsSheet,
  NO_TAGS,
  ProgrammeCatalogue,
  courseTagText,
  type CourseTagDraft,
  type TaggedCourse,
} from "../../src/components/staff/admin/AcademicKit";
import { FieldError } from "../../src/components/FieldError";
import { LIMITS, useFieldErrors, validateText } from "../../src/lib/validation";

const DESC_MAX = 500;
const SUBJECT_MAX = 100;
const DEFAULT_REASON = "Assigned as module lecturer";
const EMPTY_COURSE = {
  title: "",
  subject: "",
  description: "",
  reason: DEFAULT_REASON,
};

type Reassign = {
  courseId: number;
  title: string;
  code: string;
  lecturerId: number | null;
};

export default function AdminAcademic() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const academic = trpc.admin.getAcademicPerformance.useQuery();
  const lecturers = trpc.admin.listUsers.useQuery({
    page: 1,
    pageSize: 100,
    search: "",
    role: "lecturer",
    status: "active",
  });
  const students = trpc.admin.listUsers.useQuery({
    page: 1,
    pageSize: 1,
    search: "",
    role: "user",
  });
  const catalogue = trpc.academics.admin.catalogue.useQuery();
  const courseTags = trpc.academics.admin.courseTags.useQuery();

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_COURSE);
  const [tags, setTags] = useState<CourseTagDraft>(NO_TAGS);
  const [tagging, setTagging] = useState<TaggedCourse | null>(null);
  const [lecturerId, setLecturerId] = useState<number | null>(null);
  const [reassign, setReassign] = useState<Reassign | null>(null);
  const [reassignTo, setReassignTo] = useState<number | null>(null);
  const [student, setStudent] = useState<UserSummary | null>(null);
  const { errors, check, clear, reset } = useFieldErrors<
    "title" | "subject" | "description" | "lecturer" | "reason"
  >();

  const lecturerOptions: PickOption[] = (lecturers.data?.items ?? []).map(
    l => ({ id: l.id, title: l.name ?? `Lecturer #${l.id}`, subtitle: l.email })
  );
  const courses = academic.data?.courses ?? [];
  const atRisk = academic.data?.atRisk ?? [];
  const topics = academic.data?.topicWeaknesses ?? [];
  const faculties = catalogue.data?.faculties ?? [];
  const tagsByCourse = new Map(
    (courseTags.data ?? []).map(({ courseId, ...t }) => [courseId, t])
  );

  const resetForm = () => {
    setForm(EMPTY_COURSE);
    setTags(NO_TAGS);
    setLecturerId(null);
    reset();
  };

  const createCourse = trpc.admin.createCourse.useMutation({
    onSuccess: course => {
      setCreating(false);
      resetForm();
      void utils.admin.getAcademicPerformance.invalidate();
      void utils.academics.invalidate();
      Alert.alert(
        "Course created",
        `${course.title} (${course.code}) was assigned to the lecturer.`
      );
    },
    onError: err => Alert.alert("Could not create course", err.message),
  });

  const assign = trpc.admin.assignLecturerToCourse.useMutation({
    onSuccess: () => {
      setReassign(null);
      setReassignTo(null);
      void utils.admin.getAcademicPerformance.invalidate();
      Alert.alert(
        "Lecturer updated",
        "The course has a new lecturer. They have been notified."
      );
    },
    onError: err => Alert.alert("Could not reassign", err.message),
  });

  const setField = (key: keyof typeof EMPTY_COURSE) => (value: string) => {
    setForm(prev => ({
      ...prev,
      [key]: key === "description" ? value.slice(0, DESC_MAX) : value,
    }));
    clear(key);
  };

  const submitCourse = () => {
    const ok = check({
      title: validateText(form.title, { label: "Course title", ...LIMITS.title }),
      subject: validateText(form.subject, { label: "Subject", required: false, max: SUBJECT_MAX }),
      description: validateText(form.description, { label: "Description", required: false, max: DESC_MAX }),
      lecturer: lecturerId === null ? "Choose the lecturer who will teach this course." : null,
      reason: validateText(form.reason, { label: "Reason", ...LIMITS.reason }),
    });
    if (!ok || lecturerId === null) return;
    createCourse.mutate({
      title: form.title.trim(),
      subject: form.subject.trim() || undefined,
      description: form.description.trim() || undefined,
      lecturerId,
      reason: form.reason.trim(),
      programmeIds: tags.programmeIds,
      level: tags.level,
      semester: tags.semester,
    });
  };

  return (
    <StaffScreen
      onRefresh={() =>
        Promise.all([
          academic.refetch(),
          lecturers.refetch(),
          students.refetch(),
          catalogue.refetch(),
          courseTags.refetch(),
        ])
      }
    >
      <StaffHeader
        title="Academic"
        subtitle="Courses, lecturer assignments and students at risk."
      />

      <MetricGrid>
        <MetricTile
          icon="book-outline"
          label="Total courses"
          value={academic.isLoading ? "—" : courses.length}
          hint="In the catalogue"
          accent={colors.primary}
          accentBg={colors.primaryLight}
        />
        <MetricTile
          icon="easel-outline"
          label="Lecturers"
          value={lecturers.data?.total ?? 0}
          hint="Active lecturers"
          accent="#0284c7"
          accentBg={colors.infoSoft}
          onPress={() =>
            router.push({
              pathname: "/admin/users",
              params: { role: "lecturer" },
            } as any)
          }
        />
        <MetricTile
          icon="school-outline"
          label="Students"
          value={students.data?.total ?? 0}
          hint="Across all courses"
          accent="#800020"
          accentBg={colors.violetSoft}
          onPress={() =>
            router.push({
              pathname: "/admin/users",
              params: { role: "user" },
            } as any)
          }
        />
        <MetricTile
          icon="warning-outline"
          label="At risk"
          value={academic.isLoading ? "—" : atRisk.length}
          hint="Need follow-up"
          accent="#dc2626"
          accentBg={colors.errorSoft}
        />
      </MetricGrid>

      <AcademicTermCard />

      <Card>
        <Text style={st.cardTitle}>Course assignment</Text>
        <Text style={st.cardBody}>
          Create a course and assign it to a lecturer. The lecturer is notified
          and the action is audited.
        </Text>
        <View style={{ marginTop: 12 }}>
          <PrimaryButton
            label="Create and assign course"
            icon="add"
            onPress={() => setCreating(true)}
          />
        </View>
        {!lecturers.isLoading && lecturerOptions.length === 0 ? (
          <Text
            style={st.warn}
            onPress={() =>
              router.push({
                pathname: "/admin/users",
                params: { role: "lecturer" },
              } as any)
            }
          >
            Create a lecturer account on Users first, then assign a course here.
            Tap to open Users.
          </Text>
        ) : null}
      </Card>

      <SectionHeader title={`Courses (${courses.length})`} />
      {academic.isLoading ? (
        <Loading />
      ) : academic.error ? (
        <EmptyState icon="alert-circle-outline" text={academic.error.message} />
      ) : !courses.length ? (
        <EmptyState
          icon="book-outline"
          text="No courses yet. Create one above."
        />
      ) : (
        courses.map(course => {
          const score = Math.round(course.averageScore);
          return (
            <Card key={course.courseId}>
              <View style={st.row}>
                <Text style={st.title} numberOfLines={2}>
                  {course.code} — {course.title}
                </Text>
                <Text style={[st.score, { color: scoreColor(score) }]}>
                  {score}%
                </Text>
              </View>
              <Text style={st.meta}>
                {course.lecturerName ?? "Unassigned"} · {course.enrolled}{" "}
                enrolled · avg quiz score
              </Text>
              <ScoreBar value={score} color={scoreColor(score)} />
              <Text style={st.tags} numberOfLines={2}>
                {courseTagText(tagsByCourse.get(course.courseId), faculties)}
              </Text>
              <View style={st.actions}>
                <InlineButton
                  label={
                    course.lecturerId ? "Reassign lecturer" : "Assign lecturer"
                  }
                  icon="swap-horizontal"
                  onPress={() => {
                    setReassignTo(null);
                    setReassign({
                      courseId: course.courseId,
                      title: course.title,
                      code: course.code,
                      lecturerId: course.lecturerId,
                    });
                  }}
                />
                <InlineButton
                  label="Edit tags"
                  icon="pricetags-outline"
                  tone="muted"
                  onPress={() =>
                    setTagging({
                      courseId: course.courseId,
                      title: course.title,
                      code: course.code,
                    })
                  }
                />
              </View>
            </Card>
          );
        })
      )}

      <SectionHeader title="Programmes" />
      <ProgrammeCatalogue />

      <SectionHeader
        title={`Students requiring follow-up (${atRisk.length})`}
      />
      {academic.isLoading ? (
        <Loading />
      ) : !atRisk.length ? (
        <EmptyState
          icon="happy-outline"
          text="No students are currently flagged as at risk."
        />
      ) : (
        atRisk.map(s => {
          const score = Math.round(s.averageScore);
          return (
            <Card
              key={s.id}
              onPress={() =>
                setStudent({
                  id: s.id,
                  name: s.name,
                  email: s.email,
                  role: "user",
                  isBanned: false,
                  averageQuizScore: s.averageScore,
                })
              }
            >
              <View style={st.row}>
                <Text style={st.title} numberOfLines={1}>
                  {s.name ?? s.email ?? `Student #${s.id}`}
                </Text>
                <Text style={[st.score, { color: scoreColor(score) }]}>
                  {score}%
                </Text>
              </View>
              {s.name && s.email ? (
                <Text style={st.meta} numberOfLines={1}>
                  {s.email}
                </Text>
              ) : null}
              <Text style={st.meta}>
                Last activity:{" "}
                {s.lastActivity ? formatDate(s.lastActivity) : "No activity"} ·{" "}
                {s.overdue ?? 0} late submission{s.overdue === 1 ? "" : "s"}
              </Text>
            </Card>
          );
        })
      )}

      <SectionHeader title="Topic weaknesses" />
      {academic.isLoading ? (
        <Loading />
      ) : !topics.length ? (
        <EmptyState
          icon="analytics-outline"
          text="No completed quizzes yet to analyse topics."
        />
      ) : (
        <Card>
          {topics.map((t, index) => {
            const score = Math.round(t.averageScore);
            return (
              <View
                key={`${t.topic ?? "untagged"}-${index}`}
                style={[st.topic, index > 0 && st.topicBorder]}
              >
                <View style={st.row}>
                  <Text style={st.topicTitle} numberOfLines={1}>
                    {t.topic || "Untagged documents"}
                  </Text>
                  <Text style={[st.topicScore, { color: scoreColor(score) }]}>
                    {score}%
                  </Text>
                </View>
                <Text style={st.meta}>
                  {t.attempted} completed quiz{t.attempted === 1 ? "" : "zes"}
                </Text>
                <ScoreBar value={score} color={scoreColor(score)} />
              </View>
            );
          })}
        </Card>
      )}

      <Sheet
        visible={creating}
        title="Create and assign course"
        hint="Fill in the details to create a course and assign it to a lecturer."
        onClose={() => setCreating(false)}
        cancelLabel="Cancel"
      >
        <FormField
          label="Course title"
          value={form.title}
          onChangeText={setField("title")}
          placeholder="Geographic Information Systems"
          maxLength={LIMITS.title.max}
          error={errors.title}
        />
        <FormField
          label="Subject (optional)"
          value={form.subject}
          onChangeText={setField("subject")}
          placeholder="Computer Science"
          maxLength={SUBJECT_MAX}
          error={errors.subject}
        />
        <FormField
          label={`Description (optional) · ${form.description.length}/${DESC_MAX}`}
          value={form.description}
          onChangeText={setField("description")}
          placeholder="Enter course description..."
          multiline
          maxLength={DESC_MAX}
          error={errors.description}
        />
        <FilterLabel>Lecturer</FilterLabel>
        {lecturers.isLoading ? (
          <Loading />
        ) : (
          <OptionPicker
            options={lecturerOptions}
            value={lecturerId}
            onChange={id => {
              setLecturerId(id);
              clear("lecturer");
            }}
            emptyText="No active lecturers. Create a lecturer account on Users first."
          />
        )}
        <FieldError message={errors.lecturer} style={{ marginBottom: 10 }} />
        <CourseTagFields value={tags} onChange={setTags} faculties={faculties} />
        <FormField
          label="Reason"
          value={form.reason}
          onChangeText={setField("reason")}
          placeholder={DEFAULT_REASON}
          maxLength={LIMITS.reason.max}
          error={errors.reason}
        />
        <PrimaryButton
          label="Create and assign course"
          icon="add"
          loading={createCourse.isPending}
          onPress={submitCourse}
        />
        <View style={{ height: 8 }} />
        <PrimaryButton
          label="Clear form"
          variant="outline"
          onPress={resetForm}
        />
      </Sheet>

      <Sheet
        visible={!!reassign}
        title={reassign?.lecturerId ? "Reassign lecturer" : "Assign lecturer"}
        hint={
          reassign
            ? `${reassign.code} — ${reassign.title}. The new lecturer is notified.`
            : null
        }
        onClose={() => setReassign(null)}
        cancelLabel="Cancel"
      >
        <FilterLabel>New lecturer</FilterLabel>
        <OptionPicker
          options={lecturerOptions}
          value={reassignTo}
          onChange={setReassignTo}
          excludeId={reassign?.lecturerId}
          emptyText="No other active lecturers are available."
        />
        <ReasonForm
          confirmLabel="Update lecturer"
          loading={assign.isPending}
          disabled={reassignTo === null}
          placeholder="Reason for reassignment"
          resetKey={reassign?.courseId}
          onSubmit={reason =>
            reassign &&
            reassignTo !== null &&
            assign.mutate({
              courseId: reassign.courseId,
              lecturerId: reassignTo,
              reason,
            })
          }
        />
      </Sheet>

      <CourseTagsSheet
        course={tagging}
        tags={tagging ? tagsByCourse.get(tagging.courseId) : undefined}
        faculties={faculties}
        onClose={() => setTagging(null)}
      />

      <UserDetailSheet target={student} onClose={() => setStudent(null)} />
    </StaffScreen>
  );
}

const st = StyleSheet.create({
  cardTitle: { ...design.sectionTitle },
  cardBody: { marginTop: 4, ...design.body },
  warn: { fontSize: 12, color: "#b45309", marginTop: 12, lineHeight: 17 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  title: { flex: 1, ...design.cardTitle },
  score: { fontSize: 14, fontWeight: "800" },
  meta: { marginTop: 4, ...design.caption },
  tags: { marginTop: 10, ...design.caption, color: colors.textSub },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  topic: { paddingVertical: 10 },
  topicBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  topicTitle: { flex: 1, ...design.cardTitle },
  topicScore: { fontSize: 13, fontWeight: "800" },
});
