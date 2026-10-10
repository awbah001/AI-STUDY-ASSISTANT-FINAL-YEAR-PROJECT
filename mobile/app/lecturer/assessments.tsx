import { design } from "../../src/theme/design";
import { useStaffStyles } from "../../src/contexts/StaffAppearance";
import { useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";
import { BackHeader } from "../../src/components/BackHeader";
import { FieldError } from "../../src/components/FieldError";
import { LIMITS, useFieldErrors, validateText } from "../../src/lib/validation";
import {
  Badge,
  Card,
  EmptyState,
  formatDate,
  FormField,
  Loading,
  PrimaryButton,
  SectionHeader,
  StaffScreen,
  StatGrid,
  StatTile,
} from "../../src/components/staff/StaffUi";
import { BottomSheet } from "../../src/components/staff/lecturer-workspace/Sheet";
import { GradeSubmissionSheet } from "../../src/components/staff/lecturer-workspace/GradeSubmissionSheet";
import {
  openMail,
  shareText,
  submissionStatus,
  toCsv,
} from "../../src/components/staff/lecturer-workspace/helpers";

const QUEUE_PREVIEW = 5;
const MISSING_PREVIEW = 8;
const MAX_CRITERIA = 12;

type CriterionDraft = { key: number; criterion: string; maxPoints: string };

let draftKey = 0;
const blankCriterion = (): CriterionDraft => ({
  key: ++draftKey,
  criterion: "",
  maxPoints: "",
});

export default function LecturerAssessments() {
  const st = useStaffStyles(baseStyles);

  const router = useRouter();
  const utils = trpc.useUtils();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showAllQueue, setShowAllQueue] = useState(false);
  const [showAllMissing, setShowAllMissing] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [criteria, setCriteria] = useState<CriterionDraft[]>([]);
  const { errors, check, clear, reset: resetErrors } = useFieldErrors<"name" | "title" | "description" | "rubric">();

  const courses = trpc.lecturer.courses.list.useQuery();
  const queue = trpc.lecturer.assignments.reviewQueue.useQuery();
  const interventions =
    trpc.lecturer.assignments.interventionStudents.useQuery();
  const missing = trpc.lecturer.assignments.missingSubmissions.useQuery();
  const templates = trpc.lecturer.assignments.templates.list.useQuery();

  const all = queue.data ?? [];
  const pending = all.filter(s => s.status !== "graded");
  const ordered = [...pending, ...all.filter(s => s.status === "graded")];
  const visibleQueue = showAllQueue ? ordered : ordered.slice(0, QUEUE_PREVIEW);
  const missingList = missing.data ?? [];
  const visibleMissing = showAllMissing
    ? missingList
    : missingList.slice(0, MISSING_PREVIEW);
  const selected = all.find(s => s.id === selectedId) ?? null;
  const courseTitle = (id: number) =>
    courses.data?.find(c => c.id === id)?.title ?? String(id);

  const resetTemplate = () => {
    setTemplateName("");
    setTemplateTitle("");
    setTemplateDescription("");
    setCriteria([]);
    resetErrors();
  };

  const createTemplate = trpc.lecturer.assignments.templates.create.useMutation(
    {
      onSuccess: () => {
        resetTemplate();
        setTemplateOpen(false);
        void utils.lecturer.assignments.templates.list.invalidate();
        Alert.alert("Template saved", "Assessment template saved.");
      },
      onError: err => Alert.alert("Could not save template", err.message),
    }
  );

  const deleteTemplate = trpc.lecturer.assignments.templates.delete.useMutation(
    {
      onSuccess: result => {
        if (!result.success)
          Alert.alert("Could not delete template", "Please try again.");
        void utils.lecturer.assignments.templates.list.invalidate();
      },
      onError: err => Alert.alert("Could not delete template", err.message),
    }
  );

  const confirmDeleteTemplate = (id: number, name: string) =>
    Alert.alert(
      "Delete template",
      `Delete "${name}"? Assignments already created from it are not affected.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteTemplate.mutate({ id }),
        },
      ]
    );

  const updateCriterion = (key: number, patch: Partial<CriterionDraft>) => {
    clear("rubric");
    setCriteria(current =>
      current.map(item => (item.key === key ? { ...item, ...patch } : item))
    );
  };

  const saveTemplate = () => {
    const filled = criteria.filter(
      item => item.criterion.trim() || item.maxPoints.trim()
    );
    const rubric = filled.map(item => ({
      criterion: item.criterion.trim(),
      maxPoints: Number(item.maxPoints),
    }));
    const rubricError = rubric.some(item => !item.criterion)
      ? "Every rubric row needs a criterion name."
      : rubric.some(item => !Number.isFinite(item.maxPoints) || item.maxPoints <= 0 || item.maxPoints > 1000)
        ? "Each criterion needs maximum points between 1 and 1000."
        : new Set(rubric.map(item => item.criterion.toLowerCase())).size !== rubric.length
          ? "Each rubric criterion must have a different name."
          : null;
    const ok = check({
      name: validateText(templateName, { label: "Template name", min: 2, max: 100 }),
      title: validateText(templateTitle, { label: "Assignment title", ...LIMITS.title }),
      description: validateText(templateDescription, { label: "Instructions", required: false, max: LIMITS.description }),
      rubric: rubricError,
    });
    if (!ok) return;
    createTemplate.mutate({
      name: templateName.trim(),
      title: templateTitle.trim(),
      description: templateDescription.trim() || undefined,
      rubric: rubric.length ? rubric : undefined,
    });
  };

  const exportGrades = () =>
    shareText(
      "assessment-grades.csv",
      toCsv([
        [
          "Course",
          "Assignment",
          "Student",
          "Email",
          "Status",
          "Grade",
          "Submitted",
        ],
        ...all.map(s => [
          courseTitle(s.courseId),
          s.assignmentTitle,
          s.studentName ?? "",
          s.studentEmail ?? "",
          s.status,
          s.grade ?? "",
          new Date(s.submittedAt).toLocaleString(),
        ]),
      ])
    );

  const rubricTotal = criteria.reduce(
    (sum, item) => sum + (Number(item.maxPoints) || 0),
    0
  );

  return (
    <StaffScreen
      onRefresh={() =>
        Promise.all([
          courses.refetch(),
          queue.refetch(),
          interventions.refetch(),
          missing.refetch(),
          templates.refetch(),
        ])
      }
    >
      <BackHeader
        title="Assessments & Feedback"
        subtitle="Review work, return feedback, support students"
        fallback="/lecturer/more"
      />

      <StatGrid>
        <StatTile
          icon="clipboard-outline"
          label="Awaiting review"
          value={queue.data ? pending.length : "—"}
        />
        <StatTile
          icon="document-text-outline"
          label="All submissions"
          value={queue.data?.length ?? "—"}
          accent="#2563eb"
          accentBg={colors.infoSoft}
        />
        <StatTile
          icon="warning-outline"
          label="Need intervention"
          value={interventions.data?.length ?? "—"}
          accent={colors.error}
          accentBg={colors.errorSoft}
        />
        <StatTile
          icon="people-outline"
          label="Missing submissions"
          value={missing.data?.length ?? "—"}
          accent="#f59e0b"
          accentBg={colors.warningSoft}
        />
      </StatGrid>

      <View style={{ marginBottom: 20 }}>
        <PrimaryButton
          label="Export grades CSV"
          icon="share-outline"
          variant="outline"
          disabled={!all.length}
          onPress={() => void exportGrades()}
        />
      </View>

      <SectionHeader
        title="Submission review queue"
        action="Open grading"
        onAction={() => router.push("/lecturer/grading" as any)}
      />
      <Text style={st.caption}>
        Late and ungraded submissions are ready for marking.
      </Text>
      {queue.isLoading ? (
        <Loading />
      ) : queue.isError ? (
        <EmptyState
          icon="cloud-offline-outline"
          text="Unable to load submissions. Pull down to try again."
        />
      ) : !all.length ? (
        <EmptyState icon="document-outline" text="No submissions yet." />
      ) : (
        <>
          {visibleQueue.map(s => {
            const status = submissionStatus(s);
            return (
              <Card key={s.id} onPress={() => setSelectedId(s.id)}>
                <View style={st.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.title} numberOfLines={1}>
                      {s.studentName ?? "Student"}
                    </Text>
                    <Text style={st.sub} numberOfLines={1}>
                      {s.studentEmail}
                    </Text>
                  </View>
                  <Badge label={status.label} tone={status.tone} />
                </View>
                <Text style={st.body} numberOfLines={2}>
                  {s.assignmentTitle}
                  {s.fileUrl ? (
                    <Text style={st.fileHint}> · File attached</Text>
                  ) : null}
                </Text>
                <View style={st.rowBetween}>
                  <Text style={st.meta}>
                    Submitted {formatDate(s.submittedAt)}
                    {s.grade ? ` · Grade ${s.grade}` : ""}
                  </Text>
                  <Text style={st.link}>
                    {s.status === "graded" ? "Edit" : "Grade"}
                  </Text>
                </View>
              </Card>
            );
          })}
          {ordered.length > QUEUE_PREVIEW ? (
            <TouchableOpacity
              style={st.more}
              onPress={() => setShowAllQueue(v => !v)}
            >
              <Text style={st.link}>
                {showAllQueue
                  ? "Show less"
                  : `Show all ${ordered.length} submissions`}
              </Text>
            </TouchableOpacity>
          ) : null}
        </>
      )}

      <SectionHeader title="Students needing intervention" />
      {interventions.isLoading ? (
        <Loading />
      ) : !interventions.data?.length ? (
        <EmptyState icon="happy-outline" text="No intervention signals." />
      ) : (
        <Card>
          {interventions.data.map((s, index) => (
            <View
              key={s.studentId}
              style={[st.lineRow, index > 0 && st.lineDivider]}
            >
              <View style={st.alertIcon}>
                <Ionicons name="alert" size={16} color={colors.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.title} numberOfLines={1}>
                  {s.name ?? s.email ?? "Student"}
                </Text>
                <Text style={st.sub}>
                  Quiz average {Math.round(Number(s.averageScore) || 0)}% ·{" "}
                  {Number(s.lateSubmissions) || 0} late ·{" "}
                  {s.lastActivity
                    ? `active ${formatDate(s.lastActivity)}`
                    : "no activity"}
                </Text>
              </View>
              {s.email ? (
                <TouchableOpacity
                  onPress={() => openMail(s.email)}
                  hitSlop={10}
                  accessibilityLabel={`Email ${s.name ?? "student"}`}
                >
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </Card>
      )}

      <SectionHeader title="Overdue and missing" />
      {missing.isLoading ? (
        <Loading />
      ) : !missingList.length ? (
        <EmptyState
          icon="checkmark-circle-outline"
          text="No overdue submissions missing."
        />
      ) : (
        <Card>
          {visibleMissing.map((item, index) => (
            <View
              key={`${item.assignmentId}-${item.studentId}`}
              style={[st.lineRow, index > 0 && st.lineDivider]}
            >
              <View style={{ flex: 1 }}>
                <Text style={st.title} numberOfLines={1}>
                  {item.studentName ?? item.studentEmail ?? "Student"}
                </Text>
                <Text style={st.missing} numberOfLines={2}>
                  Missing: {item.assignmentTitle}
                </Text>
                {item.dueDate ? (
                  <Text style={st.meta}>
                    Due {formatDate(item.dueDate)} ·{" "}
                    {courseTitle(item.courseId)}
                  </Text>
                ) : null}
              </View>
              {item.studentEmail ? (
                <TouchableOpacity
                  onPress={() => openMail(item.studentEmail)}
                  hitSlop={10}
                  accessibilityLabel={`Email ${item.studentName ?? "student"}`}
                >
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
          {missingList.length > MISSING_PREVIEW ? (
            <TouchableOpacity
              style={st.more}
              onPress={() => setShowAllMissing(v => !v)}
            >
              <Text style={st.link}>
                {showAllMissing
                  ? "Show less"
                  : `Show all ${missingList.length}`}
              </Text>
            </TouchableOpacity>
          ) : null}
        </Card>
      )}

      <SectionHeader
        title="Reusable assessment templates"
        action="New template"
        onAction={() => setTemplateOpen(true)}
      />
      {templates.isLoading ? (
        <Loading />
      ) : !templates.data?.length ? (
        <EmptyState
          icon="save-outline"
          text="No templates yet. Save a reusable brief and marking rubric."
        />
      ) : (
        templates.data.map(t => {
          const rubric = t.rubric ?? [];
          return (
            <Card key={t.id}>
              <View style={st.rowBetween}>
                <Text style={[st.title, { flex: 1 }]} numberOfLines={1}>
                  {t.name}
                </Text>
                <TouchableOpacity
                  onPress={() => confirmDeleteTemplate(t.id, t.name)}
                  hitSlop={10}
                  disabled={deleteTemplate.isPending}
                  accessibilityLabel={`Delete template ${t.name}`}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={colors.error}
                  />
                </TouchableOpacity>
              </View>
              <Text style={st.body}>{t.title}</Text>
              {t.description ? (
                <Text style={st.sub}>{t.description}</Text>
              ) : null}
              {rubric.length ? (
                <View style={st.rubricBox}>
                  {rubric.map(item => (
                    <View key={item.criterion} style={st.rubricLine}>
                      <Text style={st.rubricCriterion} numberOfLines={1}>
                        {item.criterion}
                      </Text>
                      <Text style={st.rubricPoints}>{item.maxPoints} pts</Text>
                    </View>
                  ))}
                  <Text style={st.rubricTotal}>
                    Total{" "}
                    {rubric.reduce((sum, item) => sum + item.maxPoints, 0)} pts
                  </Text>
                </View>
              ) : null}
              <Text style={st.meta}>Created {formatDate(t.createdAt)}</Text>
            </Card>
          );
        })
      )}

      <GradeSubmissionSheet
        submission={selected}
        onClose={() => setSelectedId(null)}
      />

      <BottomSheet
        visible={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title="New assessment template"
        subtitle="Save a reusable brief with an optional marking rubric."
      >
        <FormField
          label="Template name"
          value={templateName}
          onChangeText={v => {
            setTemplateName(v);
            clear("name");
          }}
          placeholder="e.g. Weekly essay"
          maxLength={100}
          error={errors.name}
        />
        <FormField
          label="Assignment title"
          value={templateTitle}
          onChangeText={v => {
            setTemplateTitle(v);
            clear("title");
          }}
          placeholder="e.g. Reflective essay"
          maxLength={LIMITS.title.max}
          error={errors.title}
        />
        <FormField
          label="Brief / marking instructions"
          value={templateDescription}
          onChangeText={v => {
            setTemplateDescription(v);
            clear("description");
          }}
          placeholder="What students should do and how it's marked"
          multiline
          maxLength={LIMITS.description}
          error={errors.description}
        />

        <View style={st.rubricHead}>
          <Text style={st.label}>Rubric (optional)</Text>
          {criteria.length ? (
            <Text style={st.rubricTotal}>Total {rubricTotal} pts</Text>
          ) : null}
        </View>
        {criteria.map(item => (
          <View key={item.key} style={st.criterionRow}>
            <TextInput
              style={[st.input, { flex: 1 }]}
              value={item.criterion}
              onChangeText={criterion =>
                updateCriterion(item.key, { criterion })
              }
              placeholder="Criterion"
              placeholderTextColor={colors.textLight}
              maxLength={120}
            />
            <TextInput
              style={[st.input, st.pointsInput]}
              value={item.maxPoints}
              onChangeText={maxPoints =>
                updateCriterion(item.key, { maxPoints })
              }
              placeholder="Pts"
              placeholderTextColor={colors.textLight}
              keyboardType="numeric"
              maxLength={4}
            />
            <TouchableOpacity
              onPress={() =>
                setCriteria(current =>
                  current.filter(row => row.key !== item.key)
                )
              }
              hitSlop={8}
              accessibilityLabel="Remove criterion"
            >
              <Ionicons
                name="close-circle"
                size={22}
                color={colors.textLight}
              />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          style={[
            st.addCriterion,
            criteria.length >= MAX_CRITERIA && { opacity: 0.5 },
          ]}
          disabled={criteria.length >= MAX_CRITERIA}
          onPress={() => setCriteria(current => [...current, blankCriterion()])}
        >
          <Ionicons
            name="add-circle-outline"
            size={18}
            color={colors.primary}
          />
          <Text style={st.link}>
            {criteria.length >= MAX_CRITERIA
              ? `Maximum ${MAX_CRITERIA} criteria`
              : "Add criterion"}
          </Text>
        </TouchableOpacity>
        <FieldError message={errors.rubric} style={{ marginBottom: 10 }} />

        <PrimaryButton
          label="Save template"
          icon="save-outline"
          loading={createTemplate.isPending}
          onPress={saveTemplate}
        />
      </BottomSheet>
    </StaffScreen>
  );
}

const baseStyles = StyleSheet.create({
  caption: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 12,
    marginTop: -6,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: { ...design.cardTitle },
  sub: { marginTop: 2, ...design.caption },
  body: { marginTop: 8, marginBottom: 6, ...design.body },
  fileHint: { fontSize: 12, color: "#4f46e5", fontWeight: "700" },
  meta: { marginTop: 4, ...design.caption },
  link: { fontSize: 13, fontWeight: "700", color: colors.primary },
  more: { alignItems: "center", paddingVertical: 10, marginBottom: 8 },
  lineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  lineDivider: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  alertIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.errorSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  missing: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.error,
    marginTop: 2,
  },
  rubricBox: { padding: 10, marginTop: 10, ...design.card },
  rubricLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 3,
  },
  rubricCriterion: { flex: 1, fontSize: 13, color: colors.textSub },
  rubricPoints: { fontSize: 13, fontWeight: "700", color: colors.text },
  rubricTotal: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primary,
    marginTop: 4,
  },
  rubricHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSub,
    marginBottom: 8,
  },
  criterionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  input: { ...design.input },
  pointsInput: { width: 72, textAlign: "center", ...design.input },
  addCriterion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    marginBottom: 12,
  },
});
