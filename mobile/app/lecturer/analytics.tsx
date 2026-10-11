import { design } from "../../src/theme/design";
import { useStaffStyles } from "../../src/contexts/StaffAppearance";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
  SectionHeader,
  StaffScreen,
  StatGrid,
  StatTile,
} from "../../src/components/staff/StaffUi";
import {
  Avatar,
  BarRow,
  KeyValue,
  Legend,
  MiniBar,
} from "../../src/components/staff/lecturer-workspace/Visuals";
import { ConfusionReport } from "../../src/components/staff/lecturer-workspace/ConfusionReport";
import {
  scoreTone,
  toneColor,
} from "../../src/components/staff/lecturer-workspace/helpers";

const ENGAGEMENT = "#800020";
const QUIZZES = "#06b6d4";
const SCORE = "#10b981";

export default function LecturerAnalytics() {
  const st = useStaffStyles(baseStyles);

  const [courseId, setCourseId] = useState<number | null>(null);
  const [expandedQuiz, setExpandedQuiz] = useState<number | null>(null);
  const [expandedStudent, setExpandedStudent] = useState<number | null>(null);

  const courses = trpc.lecturer.courses.list.useQuery();
  const engagement = trpc.lecturer.analytics.engagement.useQuery();
  const selectedId = courseId ?? courses.data?.[0]?.id ?? null;
  const performance = trpc.lecturer.analytics.coursePerformance.useQuery(
    { courseId: selectedId ?? 0 },
    { enabled: !!selectedId }
  );
  const quizAttempts = trpc.lecturer.analytics.quizAttempts.useQuery(
    { courseId: selectedId ?? 0 },
    { enabled: !!selectedId }
  );

  const perf = performance.data ?? [];
  const selectedCourse = courses.data?.find(c => c.id === selectedId);
  const avg = (pick: (p: (typeof perf)[number]) => number) =>
    perf.length
      ? Math.round(perf.reduce((sum, p) => sum + pick(p), 0) / perf.length)
      : 0;
  const maxEngagementByCourse = Math.max(
    1,
    ...(engagement.data ?? []).map(c => c.avgEngagement)
  );
  const maxEngagement = Math.max(1, ...perf.map(p => p.engagementScore));
  const maxQuizzes = Math.max(1, ...perf.map(p => p.quizzesAttempted));

  return (
    <StaffScreen
      onRefresh={() =>
        Promise.all([
          courses.refetch(),
          engagement.refetch(),
          ...(selectedId
            ? [performance.refetch(), quizAttempts.refetch()]
            : []),
        ])
      }
    >
      <BackHeader
        title="Student Analytics"
        subtitle="Participation, quiz performance and engagement"
        fallback="/lecturer/more"
      />

      <StatGrid>
        <StatTile
          icon="people-outline"
          label="Students in course"
          value={performance.data ? perf.length : "—"}
        />
        <StatTile
          icon="bulb-outline"
          label="Average quiz score"
          value={perf.length ? `${avg(p => p.avgQuizScore)}%` : "—"}
          accent="#800020"
          accentBg={colors.violetSoft}
        />
        <StatTile
          icon="help-circle-outline"
          label="Quiz attempts"
          value={
            performance.data
              ? perf.reduce((sum, p) => sum + p.quizzesAttempted, 0)
              : "—"
          }
          accent="#0891b2"
          accentBg={colors.infoSoft}
        />
        <StatTile
          icon="trending-up-outline"
          label="Average engagement"
          value={perf.length ? avg(p => p.engagementScore) : "—"}
          accent="#f59e0b"
          accentBg={colors.warningSoft}
        />
      </StatGrid>

      <Text style={st.label}>Viewing course</Text>
      {courses.isLoading ? (
        <Loading />
      ) : !courses.data?.length ? (
        <EmptyState
          icon="book-outline"
          text="No courses assigned yet. An administrator assigns courses to you."
        />
      ) : (
        <ChipSelect<number>
          value={selectedId}
          onChange={id => {
            setCourseId(id);
            setExpandedQuiz(null);
            setExpandedStudent(null);
          }}
          options={courses.data.map(c => ({ value: c.id, label: c.title }))}
        />
      )}

      {selectedId ? (
        <>
          <SectionHeader title="What's confusing my class" />
          <ConfusionReport key={selectedId} courseId={selectedId} />
        </>
      ) : null}

      <SectionHeader title="Engagement by course" />
      <Card>
        <Text style={st.cardCaption}>
          Average student activity score per course
        </Text>
        {engagement.isLoading ? (
          <Loading />
        ) : !engagement.data?.length ? (
          <View style={st.inlineEmpty}>
            <Ionicons
              name="bar-chart-outline"
              size={30}
              color={colors.textLight}
            />
            <Text style={st.emptyText}>No engagement data yet.</Text>
          </View>
        ) : (
          engagement.data.map(course => (
            <BarRow
              key={course.courseId}
              label={course.courseTitle}
              value={course.avgEngagement}
              max={maxEngagementByCourse}
              color="#0aa480"
              sublabel={`${course.studentCount} student${course.studentCount === 1 ? "" : "s"} · Avg engagement ${course.avgEngagement}`}
            />
          ))
        )}
      </Card>

      <SectionHeader title="Student performance" />
      <Text style={st.caption}>
        {selectedCourse?.title ?? "Select a course"}
      </Text>
      {!selectedId ? null : performance.isLoading ? (
        <Loading />
      ) : !perf.length ? (
        <EmptyState
          icon="people-outline"
          text="Enroll students to see performance data."
        />
      ) : (
        <>
          <Legend
            items={[
              { label: "Engagement", color: ENGAGEMENT },
              { label: "Quizzes", color: QUIZZES },
              { label: "Avg score %", color: SCORE },
            ]}
          />
          {perf.map((p, index) => {
            const open = expandedStudent === p.studentId;
            const tone = scoreTone(p.avgQuizScore);
            return (
              <Card
                key={p.studentId}
                onPress={() => setExpandedStudent(open ? null : p.studentId)}
              >
                <View style={st.personRow}>
                  <Avatar name={p.name} size={36} index={index} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.name} numberOfLines={1}>
                      {p.name ?? "Student"}
                    </Text>
                    <Text style={st.email} numberOfLines={1}>
                      {p.email}
                    </Text>
                  </View>
                  <Text style={[st.score, { color: toneColor(tone) }]}>
                    {p.avgQuizScore}%
                  </Text>
                  <Ionicons
                    name={open ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={colors.textLight}
                  />
                </View>
                <MiniBar
                  label="Engagement"
                  value={p.engagementScore}
                  max={maxEngagement}
                  color={ENGAGEMENT}
                  display={String(p.engagementScore)}
                />
                <MiniBar
                  label="Quizzes"
                  value={p.quizzesAttempted}
                  max={maxQuizzes}
                  color={QUIZZES}
                  display={String(p.quizzesAttempted)}
                />
                <MiniBar
                  label="Avg score"
                  value={p.avgQuizScore}
                  max={100}
                  color={SCORE}
                  display={`${p.avgQuizScore}%`}
                />
                {open ? (
                  <View style={st.kvGrid}>
                    <KeyValue label="Engagement" value={p.engagementScore} />
                    <KeyValue label="Quizzes" value={p.quizzesAttempted} />
                    <KeyValue label="Avg score" value={`${p.avgQuizScore}%`} />
                    <KeyValue
                      label="Study time"
                      value={`${p.studyMinutes} min`}
                    />
                    <KeyValue label="Chat msgs" value={p.chatCount} />
                    <KeyValue label="Flashcards" value={p.flashcardsReviewed} />
                  </View>
                ) : null}
              </Card>
            );
          })}
        </>
      )}

      <SectionHeader title="Quiz attempts" />
      <Text style={st.caption}>
        See which students attempted each quiz and their scores
      </Text>
      {!selectedId ? null : quizAttempts.isLoading ? (
        <Loading />
      ) : !quizAttempts.data?.length ? (
        <EmptyState
          icon="help-circle-outline"
          text="No quizzes generated for this course yet."
        />
      ) : (
        quizAttempts.data.map(quiz => {
          const open = expandedQuiz === quiz.id;
          const tone = scoreTone(quiz.avgScore);
          return (
            <Card key={quiz.id} style={st.quizCard}>
              <TouchableOpacity
                style={st.quizHead}
                onPress={() => setExpandedQuiz(open ? null : quiz.id)}
                activeOpacity={0.8}
              >
                <View style={st.quizIcon}>
                  <Ionicons name="help-circle" size={20} color="#800020" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.name} numberOfLines={2}>
                    {quiz.title}
                  </Text>
                  <Text style={st.email}>
                    {quiz.totalQuestions} questions · {quiz.attemptCount}{" "}
                    attempt{quiz.attemptCount === 1 ? "" : "s"} · Avg{" "}
                    <Text
                      style={{
                        color: quiz.attemptCount
                          ? toneColor(tone)
                          : colors.textMuted,
                        fontWeight: "700",
                      }}
                    >
                      {quiz.attemptCount ? `${quiz.avgScore}%` : "—"}
                    </Text>
                  </Text>
                </View>
                <Ionicons
                  name={open ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.textLight}
                />
              </TouchableOpacity>
              <View style={st.quizBadge}>
                <Badge label={`${quiz.attemptCount} attempted`} />
              </View>
              {open ? (
                <View style={st.attempts}>
                  {!quiz.attempts.length ? (
                    <Text style={st.emptyText}>
                      No students have attempted this quiz yet.
                    </Text>
                  ) : (
                    quiz.attempts.map((a, index) => (
                      <View
                        key={`${a.studentId}-${index}`}
                        style={st.attemptRow}
                      >
                        <Avatar name={a.studentName} size={30} index={index} />
                        <View style={{ flex: 1 }}>
                          <Text style={st.attemptName} numberOfLines={1}>
                            {a.studentName ?? "Student"}
                          </Text>
                          <Text style={st.attemptMeta} numberOfLines={1}>
                            {a.studentEmail}
                            {a.completedAt
                              ? ` · ${formatDate(a.completedAt)}`
                              : ""}
                          </Text>
                        </View>
                        {a.score !== null ? (
                          <Badge
                            label={`${a.score.toFixed(0)}%`}
                            tone={scoreTone(a.score)}
                          />
                        ) : (
                          <Text style={st.attemptMeta}>—</Text>
                        )}
                      </View>
                    ))
                  )}
                </View>
              ) : null}
            </Card>
          );
        })
      )}
    </StaffScreen>
  );
}

const baseStyles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSub,
    marginBottom: 8,
  },
  caption: { marginBottom: 12, marginTop: -6, ...design.body },
  cardCaption: { fontSize: 12, color: colors.textMuted, marginBottom: 14 },
  inlineEmpty: { alignItems: "center", gap: 8, paddingVertical: 18 },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: "center" },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  name: { ...design.cardTitle },
  email: { marginTop: 2, ...design.caption },
  score: { fontSize: 15, fontWeight: "800" },
  kvGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  quizCard: { padding: 0, overflow: "hidden", ...design.card },
  quizHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    paddingBottom: 8,
  },
  quizIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.violetSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  quizBadge: { paddingHorizontal: 14, paddingBottom: 12, marginLeft: 50 },
  attempts: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.surfaceAlt,
    padding: 14,
    gap: 12,
  },
  attemptRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  attemptName: { ...design.cardTitle },
  attemptMeta: { marginTop: 1, ...design.caption },
});
