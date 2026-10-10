import { design } from "../../src/theme/design";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
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
  SectionHeader,
  StaffHeader,
  StaffScreen,
  StatGrid,
  StatTile,
} from "../../src/components/staff/StaffUi";

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export default function AdminOverview() {
  const router = useRouter();
  const { user } = useAuth();
  const metrics = trpc.admin.getDashboardMetrics.useQuery({ days: 30 });
  const academic = trpc.admin.getAcademicPerformance.useQuery();
  const m = metrics.data;
  const issues = (m?.failedJobs ?? 0) + (m?.queuedJobs ?? 0);
  const usersTotal = m?.usersTotal ?? 0;
  const activeLearners = m?.activeLearners ?? 0;
  const activePct = usersTotal ? (activeLearners / usersTotal) * 100 : 0;
  const quizScore = m?.averageQuizScore ?? 0;

  return (
    <StaffScreen
      onRefresh={() => Promise.all([metrics.refetch(), academic.refetch()])}
    >
      <StaffHeader
        title={`${greeting()}, ${firstName(user?.name)}`}
        subtitle="Platform health for the last 30 days."
        name={user?.name}
        avatarUrl={user?.avatarUrl}
        onAvatarPress={() => router.push("/admin/profile" as any)}
      />

      <HeroCard
        eyebrow="Platform health"
        stat={activeLearners}
        statUnit={`/ ${usersTotal} active users`}
        title={
          m?.failedJobs
            ? `${m.failedJobs} document job${m.failedJobs === 1 ? "" : "s"} failed`
            : "Systems running smoothly"
        }
        progress={activePct}
        body={
          issues
            ? `${m?.queuedJobs ?? 0} queued · ${m?.failedJobs ?? 0} failed. Tap to open Operations.`
            : "No failed or queued document processing jobs."
        }
        onPress={() => router.push("/admin/operations" as any)}
      />

      <SectionHeader title="Key metrics" />
      {metrics.isLoading ? (
        <Loading />
      ) : metrics.error ? (
        <EmptyState icon="alert-circle-outline" text={metrics.error.message} />
      ) : (
        <StatGrid>
          <StatTile
            icon="people-outline"
            label="Total users"
            value={usersTotal}
            hint="All roles"
          />
          <StatTile
            icon="pulse-outline"
            label="Active learners"
            value={activeLearners}
            hint={`${Math.round(activePct)}% active`}
            accent="#2563eb"
            accentBg={colors.infoSoft}
          />
          <StatTile
            icon="document-text-outline"
            label="Documents"
            value={m?.documentsTotal ?? 0}
            hint="Uploaded"
            accent={colors.burgundy}
            accentBg={colors.burgundySoft}
          />
          <StatTile
            icon="ribbon-outline"
            label="Avg quiz score"
            value={`${quizScore}%`}
            hint={
              quizScore >= 70
                ? "Strong"
                : quizScore >= 50
                  ? "Fair"
                  : "Needs work"
            }
            accent="#f59e0b"
            accentBg={colors.warningSoft}
          />
          <StatTile
            icon="checkmark-done-outline"
            label="Quiz completion"
            value={`${m?.quizCompletionRate ?? 0}%`}
            hint="Completed"
            accent="#0d9488"
            accentBg={colors.successSoft}
          />
          <StatTile
            icon="server-outline"
            label="Storage used"
            value={formatBytes(m?.storageBytes ?? 0)}
            hint="On server"
            accent="#64748b"
            accentBg={colors.surfaceAlt}
          />
        </StatGrid>
      )}

      <SectionHeader title="Courses" />
      {academic.isLoading ? (
        <Loading />
      ) : !academic.data?.courses.length ? (
        <EmptyState
          icon="book-outline"
          text="No courses created yet. Create courses from the web portal."
        />
      ) : (
        academic.data.courses.slice(0, 8).map(course => (
          <Card key={course.courseId}>
            <View style={st.row}>
              <View style={st.courseIcon}>
                <Ionicons name="book" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.title} numberOfLines={1}>
                  {course.title}
                </Text>
                <Text style={st.meta} numberOfLines={1}>
                  {course.code} · {course.lecturerName ?? "No lecturer"} ·{" "}
                  {course.enrolled} enrolled
                </Text>
              </View>
              <View style={st.scorePill}>
                <Text style={st.score}>{Math.round(course.averageScore)}%</Text>
              </View>
            </View>
            <View style={st.track}>
              <View
                style={[
                  st.fill,
                  {
                    width: `${Math.max(0, Math.min(100, course.averageScore))}%`,
                  },
                ]}
              />
            </View>
          </Card>
        ))
      )}

      {!!academic.data?.atRisk.length && (
        <>
          <SectionHeader
            title={`Students at risk (${academic.data.atRisk.length})`}
          />
          {academic.data.atRisk.slice(0, 5).map(student => (
            <Card key={student.id}>
              <View style={st.row}>
                <View style={st.riskAvatar}>
                  <Text style={st.riskInitial}>
                    {(student.name ?? student.email ?? "?")
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.title} numberOfLines={1}>
                    {student.name ?? student.email}
                  </Text>
                  <Text style={st.meta}>
                    Avg {Math.round(student.averageScore)}% · {student.overdue}{" "}
                    late submission{student.overdue === 1 ? "" : "s"}
                  </Text>
                </View>
                <Ionicons name="warning" size={18} color={colors.warning} />
              </View>
            </Card>
          ))}
        </>
      )}
    </StaffScreen>
  );
}

const st = StyleSheet.create({
  row: {
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
  title: { ...design.cardTitle },
  scorePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
  },
  score: { fontSize: 13, fontWeight: "800", color: colors.primary },
  meta: { marginTop: 2, ...design.caption },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primaryLight,
    marginTop: 14,
    overflow: "hidden",
  },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  riskAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.warningSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  riskInitial: { fontSize: 16, fontWeight: "800", color: "#b45309" },
});
