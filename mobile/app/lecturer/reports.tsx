import { design } from "../../src/theme/design";
import { useStaffStyles } from "../../src/contexts/StaffAppearance";
import { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";
import { BackHeader } from "../../src/components/BackHeader";
import {
  Badge,
  Card,
  ChipSelect,
  EmptyState,
  formatDate,
  Loading,
  PrimaryButton,
  SectionHeader,
  StaffScreen,
  StatGrid,
  StatTile,
} from "../../src/components/staff/StaffUi";
import { Avatar } from "../../src/components/staff/lecturer-workspace/Visuals";
import {
  shareText,
  toCsv,
  type RouterOutputs,
} from "../../src/components/staff/lecturer-workspace/helpers";

type Report = NonNullable<
  RouterOutputs["lecturer"]["students"]["progressReport"]
>;

const ACTIVITY_TONE: Record<string, "blue" | "green" | "amber" | "grey"> = {
  quiz: "amber",
  flashcard: "blue",
  chat: "green",
};

function reportCsv(report: Report) {
  return toCsv([
    ["Student", report.student.name ?? ""],
    ["Email", report.student.email ?? ""],
    ["Course", report.course?.title ?? ""],
    ["Avg Quiz Score", `${report.student.avgQuizScore}%`],
    ["Quizzes Attempted", report.student.quizzesAttempted],
    ["Flashcards Reviewed", report.student.flashcardsReviewed],
    ["Study Minutes", report.student.studyMinutes],
    ["Engagement Score", report.student.engagementScore],
    [],
    ["Materials", ""],
    ...(report.documents?.map(d => ["", d.title]) ?? []),
    [],
    ["Recent Study Sessions", "", ""],
    ["Activity", "Duration (min)", "Date"],
    ...report.recentSessions.map(s => [
      s.activityType,
      s.durationMinutes ?? 0,
      formatDate(s.startTime),
    ]),
  ]);
}

function reportSummary(report: Report) {
  const s = report.student;
  const lines = [
    `Progress report: ${s.name ?? "Student"}`,
    s.email ? `Email: ${s.email}` : null,
    report.course ? `Course: ${report.course.title}` : null,
    `Generated: ${formatDate(new Date())}`,
    "",
    `Average quiz score: ${s.avgQuizScore}%`,
    `Quizzes attempted: ${s.quizzesAttempted}`,
    `Flashcards reviewed: ${s.flashcardsReviewed}`,
    `Study time: ${s.studyMinutes} min`,
    `Engagement score: ${s.engagementScore}`,
    "",
    "Course materials:",
    ...(report.documents?.length
      ? report.documents.map(d => `• ${d.title}`)
      : ["• None yet"]),
    "",
    "Recent study sessions:",
    ...(report.recentSessions.length
      ? report.recentSessions.map(
          r =>
            `• ${r.activityType} — ${r.durationMinutes ?? 0} min — ${formatDate(r.startTime)}`
        )
      : ["• None recorded"]),
  ];
  return lines.filter((line): line is string => line !== null).join("\n");
}

export default function LecturerReports() {
  const st = useStaffStyles(baseStyles);

  const [courseId, setCourseId] = useState<number | null>(null);
  const [studentId, setStudentId] = useState<number | null>(null);

  const courses = trpc.lecturer.courses.list.useQuery();
  const totals = trpc.lecturer.dashboardStats.useQuery();
  const students = trpc.lecturer.students.listByCourse.useQuery(
    { courseId: courseId ?? 0 },
    { enabled: !!courseId }
  );
  const report = trpc.lecturer.students.progressReport.useQuery(
    { courseId: courseId ?? 0, studentId: studentId ?? 0 },
    { enabled: !!courseId && !!studentId }
  );
  const data = report.data;
  const selectedStudent = students.data?.find(s => s.studentId === studentId);

  const share = () => {
    if (!data) return;
    const name = data.student.name?.replace(/\s+/g, "-") || "student";
    Alert.alert("Share report", "Choose a format to share or save.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Text summary",
        onPress: () =>
          void shareText(
            `Progress report — ${data.student.name ?? "Student"}`,
            reportSummary(data)
          ),
      },
      {
        text: "CSV",
        onPress: () => void shareText(`report-${name}.csv`, reportCsv(data)),
      },
    ]);
  };

  return (
    <StaffScreen
      onRefresh={() =>
        Promise.all([
          courses.refetch(),
          totals.refetch(),
          ...(courseId ? [students.refetch()] : []),
          ...(courseId && studentId ? [report.refetch()] : []),
        ])
      }
    >
      <BackHeader
        title="Progress Reports"
        subtitle="Individual student progress"
        fallback="/lecturer/more"
      />

      <StatGrid>
        <StatTile
          icon="book-outline"
          label="Your courses"
          value={courses.data?.length ?? "—"}
        />
        <StatTile
          icon="person-outline"
          label="Enrolled students"
          value={totals.data?.studentCount ?? "—"}
          accent="#2563eb"
          accentBg={colors.infoSoft}
        />
        <StatTile
          icon="document-text-outline"
          label="Course materials"
          value={totals.data?.documentCount ?? "—"}
          accent="#800020"
          accentBg={colors.violetSoft}
        />
      </StatGrid>

      <Card>
        <Text style={st.cardTitle}>Select student</Text>
        <Text style={st.cardHint}>
          Choose a course first, then pick a student.
        </Text>
        <Text style={st.label}>Course</Text>
        {courses.isLoading ? (
          <Loading />
        ) : !courses.data?.length ? (
          <Text style={st.cardHint}>No courses assigned yet.</Text>
        ) : (
          <ChipSelect<number>
            value={courseId}
            onChange={id => {
              setCourseId(id);
              setStudentId(null);
            }}
            options={courses.data.map(c => ({ value: c.id, label: c.title }))}
          />
        )}
        <Text style={st.label}>Student</Text>
        {!courseId ? (
          <Text style={st.cardHint}>Select a course to list its students.</Text>
        ) : students.isLoading ? (
          <Loading />
        ) : !students.data?.length ? (
          <Text style={st.cardHint}>No students enrolled in this course.</Text>
        ) : (
          <View style={st.studentList}>
            {students.data.map((s, index) => {
              const active = s.studentId === studentId;
              return (
                <TouchableOpacity
                  key={s.studentId}
                  style={[st.studentRow, active && st.studentRowActive]}
                  onPress={() => setStudentId(s.studentId)}
                >
                  <Avatar
                    name={s.name}
                    url={s.avatarUrl}
                    size={32}
                    index={index}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={st.studentName} numberOfLines={1}>
                      {s.name ?? "Student"}
                    </Text>
                    <Text style={st.studentEmail} numberOfLines={1}>
                      {s.email}
                    </Text>
                  </View>
                  {active ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.primary}
                    />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </Card>

      {!courseId || !studentId ? (
        <EmptyState
          icon="clipboard-outline"
          text={
            "Select a course and student.\nTheir progress report will appear here."
          }
        />
      ) : report.isLoading ? (
        <Loading />
      ) : report.isError ? (
        <EmptyState
          icon="cloud-offline-outline"
          text="Unable to load this report. Pull down to try again."
        />
      ) : !data ? (
        <EmptyState
          icon="alert-circle-outline"
          text={`No report available for ${selectedStudent?.name ?? "this student"}.`}
        />
      ) : (
        <>
          <Card>
            <View style={st.headRow}>
              <Avatar name={data.student.name} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={st.reportName} numberOfLines={1}>
                  {data.student.name ?? "Student"}
                </Text>
                <Text style={st.studentEmail} numberOfLines={1}>
                  {data.student.email}
                </Text>
                {data.course ? (
                  <Text style={st.courseTag} numberOfLines={1}>
                    {data.course.title}
                  </Text>
                ) : null}
              </View>
            </View>
            <PrimaryButton
              label="Share report"
              icon="share-outline"
              variant="outline"
              onPress={share}
            />
          </Card>

          <StatGrid>
            <StatTile
              icon="bulb-outline"
              label="Avg score"
              value={`${data.student.avgQuizScore}%`}
              accent="#4f46e5"
              accentBg={colors.infoSoft}
            />
            <StatTile
              icon="help-circle-outline"
              label="Quizzes"
              value={data.student.quizzesAttempted}
              accent="#800020"
              accentBg={colors.violetSoft}
            />
            <StatTile
              icon="layers-outline"
              label="Flashcards"
              value={data.student.flashcardsReviewed}
              accent="#2563eb"
              accentBg={colors.infoSoft}
            />
            <StatTile
              icon="time-outline"
              label="Study mins"
              value={data.student.studyMinutes}
              accent="#0891b2"
              accentBg={colors.infoSoft}
            />
            <StatTile
              icon="trending-up-outline"
              label="Engagement"
              value={data.student.engagementScore}
            />
          </StatGrid>

          <SectionHeader title="Course materials" />
          <Card>
            {!data.documents?.length ? (
              <Text style={st.cardHint}>No materials in this course yet.</Text>
            ) : (
              data.documents.map((d, index) => (
                <View
                  key={d.id}
                  style={[st.lineRow, index > 0 && st.lineDivider]}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={18}
                    color={colors.textLight}
                  />
                  <Text style={st.lineText} numberOfLines={2}>
                    {d.title}
                  </Text>
                </View>
              ))
            )}
          </Card>

          <SectionHeader title="Recent study sessions" />
          <Card>
            {!data.recentSessions.length ? (
              <Text style={st.cardHint}>No study sessions recorded yet.</Text>
            ) : (
              data.recentSessions.map((s, index) => (
                <View
                  key={index}
                  style={[st.lineRow, index > 0 && st.lineDivider]}
                >
                  <Badge
                    label={
                      s.activityType.charAt(0).toUpperCase() +
                      s.activityType.slice(1)
                    }
                    tone={ACTIVITY_TONE[s.activityType] ?? "grey"}
                  />
                  <Text style={st.lineText}>{formatDate(s.startTime)}</Text>
                  <Text style={st.duration}>{s.durationMinutes ?? 0} min</Text>
                </View>
              ))
            )}
          </Card>
        </>
      )}
    </StaffScreen>
  );
}

const baseStyles = StyleSheet.create({
  cardTitle: { ...design.sectionTitle },
  cardHint: { marginTop: 2, marginBottom: 12, ...design.caption },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSub,
    marginBottom: 8,
  },
  studentList: { gap: 8 },
  studentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  studentRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  studentName: { ...design.cardTitle },
  studentEmail: { marginTop: 1, ...design.caption },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  reportName: { ...design.cardTitle },
  courseTag: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 4,
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  lineDivider: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  lineText: { flex: 1, fontSize: 14, color: colors.textSub },
  duration: { fontSize: 14, fontWeight: "700", color: colors.text },
});
