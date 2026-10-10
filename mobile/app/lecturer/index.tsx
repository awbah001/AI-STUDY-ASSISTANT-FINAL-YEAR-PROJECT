import { design } from "../../src/theme/design";
import { useStaffStyles } from "../../src/contexts/StaffAppearance";
import { useRouter } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/contexts/AuthContext";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";
import {
  Card,
  EmptyState,
  firstName,
  greeting,
  HeroCard,
  Loading,
  ListItem,
  SectionHeader,
  StaffHeader,
  StaffScreen,
  StatGrid,
  StatTile,
} from "../../src/components/staff/StaffUi";

export default function LecturerDashboard() {
  const st = useStaffStyles(baseStyles);

  const router = useRouter();
  const { user } = useAuth();
  const stats = trpc.lecturer.dashboardStats.useQuery();
  const engagement = trpc.lecturer.analytics.engagement.useQuery();
  const queue = trpc.lecturer.assignments.reviewQueue.useQuery();

  const queueTotal = queue.data?.length ?? 0;
  const pending = (queue.data ?? []).filter(
    item => item.status !== "graded"
  ).length;
  const gradedPct = queueTotal
    ? ((queueTotal - pending) / queueTotal) * 100
    : 100;
  const s = stats.data;

  return (
    <StaffScreen
      onRefresh={() =>
        Promise.all([stats.refetch(), engagement.refetch(), queue.refetch()])
      }
    >
      <StaffHeader
        title={`${greeting()}, ${firstName(user?.name)}`}
        subtitle="Here's what's happening across your courses."
        name={user?.name}
        avatarUrl={user?.avatarUrl}
        onAvatarPress={() => router.push("/lecturer/profile" as any)}
      />

      <HeroCard
        eyebrow="Grading queue"
        stat={pending}
        statUnit={
          pending === 1 ? "submission to grade" : "submissions to grade"
        }
        title={pending > 0 ? "Student work is waiting" : "You're all caught up"}
        progress={gradedPct}
        body={
          pending > 0
            ? `${queueTotal - pending} of ${queueTotal} graded. Tap to open Grading.`
            : "New student submissions will appear in Grading."
        }
        onPress={() => router.push("/lecturer/grading" as any)}
      />

      <SectionHeader title="Overview" />
      {stats.isLoading ? (
        <Loading />
      ) : (
        <StatGrid>
          <StatTile
            icon="book-outline"
            label="Courses"
            value={s?.courseCount ?? 0}
            hint="Assigned"
          />
          <StatTile
            icon="people-outline"
            label="Students"
            value={s?.studentCount ?? 0}
            hint="Enrolled"
            accent={colors.info}
            accentBg={colors.infoSoft}
          />
          <StatTile
            icon="document-text-outline"
            label="Materials"
            value={s?.documentCount ?? 0}
            hint="Uploaded"
            accent={colors.burgundy}
            accentBg={colors.burgundySoft}
          />
          <StatTile
            icon="clipboard-outline"
            label="Assignments"
            value={s?.assignmentCount ?? 0}
            hint={pending > 0 ? `${pending} to grade` : "Up to date"}
            accent="#f59e0b"
            accentBg={colors.warningSoft}
          />
        </StatGrid>
      )}

      <SectionHeader title="Teaching content" />
      <StatGrid>
        <StatTile
          icon="help-circle-outline"
          label="AI quizzes"
          value={s?.quizCount ?? "-"}
          hint="Generated"
          accent="#800020"
          accentBg={colors.violetSoft}
        />
        <StatTile
          icon="albums-outline"
          label="Flashcards"
          value={s?.flashcardCount ?? "-"}
          hint="Created"
          accent="#3b82f6"
          accentBg={colors.infoSoft}
        />
        <StatTile
          icon="megaphone-outline"
          label="Announcements"
          value={s?.announcementCount ?? "-"}
          hint="Sent"
          accent="#0d9488"
          accentBg={colors.successSoft}
        />
      </StatGrid>
      <SectionHeader title="Quick actions" />
      <ListItem
        icon="book-outline"
        tone="blue"
        title="Course management"
        subtitle="Upload materials and share enrollment codes."
        onPress={() => router.push("/lecturer/courses" as any)}
      />
      <ListItem
        icon="stats-chart-outline"
        tone="sky"
        title="Student performance"
        subtitle="Quiz scores, study time, and participation."
        onPress={() => router.push("/lecturer/analytics" as any)}
      />
      <ListItem
        icon="document-text-outline"
        tone="amber"
        title="Progress reports"
        subtitle="Detailed per-student learning reports."
        onPress={() => router.push("/lecturer/reports" as any)}
      />
      <SectionHeader
        title="Course engagement"
        action="All courses"
        onAction={() => router.push("/lecturer/courses" as any)}
      />
      {engagement.isLoading ? (
        <Loading />
      ) : !engagement.data?.length ? (
        <EmptyState
          icon="book-outline"
          text="No courses assigned yet. An administrator assigns courses to you."
        />
      ) : (
        engagement.data.map(course => (
          <Card
            key={course.courseId}
            onPress={() =>
              router.push({
                pathname: "/lecturer-course/[id]",
                params: { id: String(course.courseId) },
              } as any)
            }
          >
            <View style={st.rowBetween}>
              <View style={st.courseIcon}>
                <Ionicons name="book" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.courseTitle} numberOfLines={1}>
                  {course.courseTitle}
                </Text>
                <Text style={st.meta}>
                  {course.studentCount} student
                  {course.studentCount === 1 ? "" : "s"} enrolled
                </Text>
              </View>
              <View style={st.pctPill}>
                <Text style={st.pct}>{course.avgEngagement}%</Text>
              </View>
            </View>
            <View style={st.barBg}>
              <View
                style={[
                  st.barFill,
                  { width: `${Math.min(100, course.avgEngagement)}%` },
                ]}
              />
            </View>
          </Card>
        ))
      )}
    </StaffScreen>
  );
}

const baseStyles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  courseIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  courseTitle: { ...design.cardTitle },
  pctPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
  },
  pct: { fontSize: 13, fontWeight: "800", color: colors.primary },
  barBg: {
    height: 6,
    backgroundColor: colors.primaryLight,
    borderRadius: 3,
    marginTop: 14,
    overflow: "hidden",
  },
  barFill: { height: 6, backgroundColor: colors.primary, borderRadius: 3 },
  meta: { marginTop: 2, ...design.caption },
});
