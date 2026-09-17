import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useRef } from "react";
import { trpc, API_URL } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";
import { showLocalNotification } from "../../src/lib/notifications";
import { studyFormatLabel } from "../../src/lib/studyDocuments";

function mediaUrl(url?: string | null) {
  if (!url) return "";
  return url.startsWith("http") ? url : `${API_URL}${url}`;
}

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const courseId = Number(id);
  const prevAnnouncementCount = useRef<number | null>(null);

  const { data: courses } = trpc.studentCourses.list.useQuery();
  const course = courses?.find((c) => c.id === courseId);

  const { data: materials, isLoading: materialsLoading } =
    trpc.studentCourses.materials.useQuery({ courseId }, { enabled: !Number.isNaN(courseId) });

  const { data: announcements, isLoading: announcementsLoading } =
    trpc.studentCourses.announcements.useQuery({ courseId }, { enabled: !Number.isNaN(courseId) });

  const { data: quizzes, isLoading: quizzesLoading } =
    trpc.studentCourses.quizzes.useQuery({ courseId }, { enabled: !Number.isNaN(courseId) });

  const { data: assignments, isLoading: assignmentsLoading } =
    trpc.studentCourses.assignments.useQuery({ courseId }, { enabled: !Number.isNaN(courseId) });

  const { data: mySubmissions } =
    trpc.assignments.mySubmissionsForCourse.useQuery({ courseId }, { enabled: !Number.isNaN(courseId) });

  // Local notification when new announcements arrive
  useEffect(() => {
    if (!announcements) return;
    const count = announcements.length;
    if (prevAnnouncementCount.current !== null && count > prevAnnouncementCount.current) {
      const newest = announcements[0];
      showLocalNotification(
        `📢 New announcement: ${course?.title ?? "Your course"}`,
        newest?.title ?? "Check your course for updates."
      );
    }
    prevAnnouncementCount.current = count;
  }, [announcements]);

  // Helper: find submission for a given assignment
  const getSubmission = (assignmentId: number) =>
    mySubmissions?.find((s) => s.assignmentId === assignmentId);

  // Helper: is assignment past due?
  const isOverdue = (dueDate: Date | null | undefined) =>
    dueDate ? new Date(dueDate).getTime() < Date.now() : false;

  return (
    <SafeAreaView style={st.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>
        {/* Back */}
        <TouchableOpacity style={st.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
          <Text style={st.backText}>Courses</Text>
        </TouchableOpacity>

        {/* Course header */}
        <View style={st.courseHeader}>
          <View style={st.courseBadge}>
            <Text style={st.courseBadgeText}>
              {(course?.title ?? "?").charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={st.courseTitle}>{course?.title ?? "Course"}</Text>
          {(course as any)?.subject ? (
            <Text style={st.courseSubject}>{(course as any).subject}</Text>
          ) : null}
          <Text style={st.courseLecturer}>
            Lecturer: {(course as any)?.lecturerName ?? "—"}
          </Text>
        </View>

        {/* ── Materials ── */}
        <SectionHeader icon="document-text" title="Course Materials" />
        {materialsLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginBottom: 20 }} />
        ) : !materials || materials.length === 0 ? (
          <EmptyState text="No materials available yet." />
        ) : (
          materials.map((doc) => (
            <TouchableOpacity
              key={doc.id}
              style={st.itemCard}
              onPress={() => router.push({ pathname: "/document/[id]", params: { id: doc.id } })}
              activeOpacity={0.75}
            >
              <View style={[st.itemIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="document-text" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.itemTitle} numberOfLines={1}>{doc.title}</Text>
                <Text style={st.itemMeta}>{studyFormatLabel((doc as any).materialType, doc.fileName)} · {doc.fileName}</Text>
              </View>
              <Text style={st.openLink}>Open →</Text>
            </TouchableOpacity>
          ))
        )}

        {/* ── Assignments ── */}
        <SectionHeader icon="clipboard" title="Assignments" style={{ marginTop: 24 }} />
        {assignmentsLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginBottom: 20 }} />
        ) : !assignments || assignments.length === 0 ? (
          <EmptyState text="No assignments yet. Check back later." />
        ) : (
          assignments.map((asgn) => {
            const submission = getSubmission(asgn.id);
            const overdue = isOverdue(asgn.dueDate);
            const statusColor = submission?.status === "graded"
              ? colors.primary
              : submission?.status === "submitted"
              ? "#3b82f6"
              : overdue ? "#ef4444" : "#f59e0b";
            const statusLabel = submission?.status === "graded"
              ? `Graded${submission.grade ? ` · ${submission.grade}` : ""}`
              : submission?.status === "submitted"
              ? "Submitted"
              : overdue ? "Overdue" : "Pending";

            return (
              <View key={asgn.id} style={st.assignCard}>
                <View style={st.assignLeft}>
                  <View style={[st.itemIcon, { backgroundColor: "#fff7ed" }]}>
                    <Ionicons name="clipboard" size={20} color="#f59e0b" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.itemTitle} numberOfLines={1}>{asgn.title}</Text>
                    {asgn.description ? (
                      <Text style={st.itemMeta} numberOfLines={2}>{asgn.description}</Text>
                    ) : null}
                    {asgn.fileUrl ? (
                      <TouchableOpacity
                        onPress={() => void Linking.openURL(mediaUrl(asgn.fileUrl))}
                        activeOpacity={0.7}
                      >
                        <Text style={st.openLink}>
                          {asgn.fileName ? `Open ${asgn.fileName}` : "Open assignment document"}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    <View style={st.assignMeta}>
                      {asgn.dueDate ? (
                        <Text style={[st.dueLabel, overdue && !submission && { color: "#ef4444" }]}>
                          Due {new Date(asgn.dueDate).toLocaleDateString(undefined, { dateStyle: "medium" })}
                        </Text>
                      ) : null}
                      <View style={[st.statusBadge, { backgroundColor: statusColor + "20" }]}>
                        <Text style={[st.statusText, { color: statusColor }]}>{statusLabel}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Submit / Resubmit / View button */}
                <TouchableOpacity
                  style={[st.submitBtn, submission && st.submitBtnDone]}
                  onPress={() =>
                    router.push({
                      pathname: "/submit-assignment",
                      params: {
                        assignmentId: String(asgn.id),
                        courseId: String(courseId),
                        title: asgn.title,
                        description: asgn.description ?? "",
                        dueDate: asgn.dueDate ? String(new Date(asgn.dueDate).getTime()) : "",
                        fileUrl: asgn.fileUrl ?? "",
                        fileName: asgn.fileName ?? "",
                      },
                    })
                  }
                  activeOpacity={0.8}
                >
                  <Text style={[st.submitBtnText, submission && st.submitBtnTextDone]}>
                    {submission ? "View / Edit" : "Submit"}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}

        {/* ── Quizzes ── */}
        <SectionHeader icon="help-circle" title="Quizzes" style={{ marginTop: 24 }} />
        {quizzesLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginBottom: 20 }} />
        ) : !quizzes || quizzes.length === 0 ? (
          <EmptyState text="No quizzes assigned yet. Check back later." />
        ) : (
          quizzes.map((quiz) => (
            <TouchableOpacity
              key={quiz.id}
              style={st.quizCard}
              onPress={() =>
                router.push({
                  pathname: "/document/[id]",
                  params: { id: quiz.documentId, tab: "quiz", quizId: quiz.id },
                })
              }
              activeOpacity={0.75}
            >
              <View style={[st.itemIcon, { backgroundColor: "#ede9fe" }]}>
                <Ionicons name="help-circle" size={20} color="#7c3aed" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.itemTitle} numberOfLines={1}>{quiz.title}</Text>
                <Text style={st.itemMeta}>
                  {quiz.totalQuestions} questions ·{" "}
                  {new Date(quiz.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                </Text>
              </View>
              {quiz.completedAt ? (
                <View style={st.scoreBadge}>
                  <Text style={st.scoreText}>
                    {quiz.score ? `${Number(quiz.score).toFixed(0)}%` : "Done"}
                  </Text>
                </View>
              ) : (
                <Text style={st.openLink}>Start →</Text>
              )}
            </TouchableOpacity>
          ))
        )}

        {/* ── Announcements ── */}
        <SectionHeader icon="megaphone" title="Announcements" style={{ marginTop: 24 }} />
        {announcementsLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginBottom: 20 }} />
        ) : !announcements || announcements.length === 0 ? (
          <EmptyState text="No announcements yet." />
        ) : (
          announcements.map((a) => (
            <View key={a.id} style={st.announcementCard}>
              <Text style={st.announcementTitle}>{a.title}</Text>
              <Text style={st.announcementContent}>{a.content}</Text>
              <Text style={st.announcementDate}>{new Date(a.createdAt).toLocaleString()}</Text>
            </View>
          ))
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, style }: { icon: string; title: string; style?: object }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }, style]}>
      <Ionicons name={icon as any} size={18} color={colors.primary} />
      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>{title}</Text>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 16 }}>{text}</Text>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5f6fa" },
  content: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 16 },
  back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20 },
  backText: { fontSize: 15, color: colors.primary, fontWeight: "600" },

  // Course header
  courseHeader: {
    backgroundColor: colors.primary + "15",
    borderRadius: 20, padding: 20, alignItems: "center", marginBottom: 28,
  },
  courseBadge: {
    width: 60, height: 60, borderRadius: 18,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  courseBadgeText: { fontSize: 28, fontWeight: "800", color: colors.white },
  courseTitle: { fontSize: 20, fontWeight: "800", color: colors.text, textAlign: "center" },
  courseSubject: { fontSize: 14, color: colors.primary, fontWeight: "600", marginTop: 4 },
  courseLecturer: { fontSize: 13, color: colors.textMuted, marginTop: 4 },

  // Shared card
  itemCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface, borderRadius: 16,
    padding: 14, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  itemIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 12 },
  itemTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  itemMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  openLink: { fontSize: 13, color: colors.primary, fontWeight: "600" },

  // Assignment card
  assignCard: {
    backgroundColor: colors.surface, borderRadius: 16,
    padding: 14, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    borderLeftWidth: 3, borderLeftColor: "#f59e0b",
    gap: 12,
  },
  assignLeft: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  assignMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" },
  dueLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },
  submitBtn: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 8,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  submitBtnDone: { backgroundColor: "#e8fdf2", shadowOpacity: 0 },
  submitBtnText: { fontSize: 13, fontWeight: "700", color: colors.white },
  submitBtnTextDone: { color: colors.primaryDark },

  // Quiz card
  quizCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface, borderRadius: 16,
    padding: 14, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    borderLeftWidth: 3, borderLeftColor: "#7c3aed",
  },
  scoreBadge: { backgroundColor: "#d1fae5", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  scoreText: { fontSize: 12, fontWeight: "700", color: "#065f46" },

  // Announcement card
  announcementCard: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  announcementTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 6 },
  announcementContent: { fontSize: 14, color: colors.text, lineHeight: 20 },
  announcementDate: { fontSize: 12, color: colors.textMuted, marginTop: 8 },
});
