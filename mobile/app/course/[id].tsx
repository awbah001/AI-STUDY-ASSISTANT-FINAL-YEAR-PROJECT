import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";
import { useAuth } from "../../src/contexts/AuthContext";

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const courseId = Number(id);

  const { data: courses } = trpc.studentCourses.list.useQuery();
  const course = courses?.find((c) => c.id === courseId);

  const { data: materials, isLoading: materialsLoading } =
    trpc.studentCourses.materials.useQuery(
      { courseId },
      { enabled: !Number.isNaN(courseId) }
    );

  const { data: announcements, isLoading: announcementsLoading } =
    trpc.studentCourses.announcements.useQuery(
      { courseId },
      { enabled: !Number.isNaN(courseId) }
    );

  const { data: quizzes, isLoading: quizzesLoading } =
    trpc.studentCourses.quizzes.useQuery(
      { courseId },
      { enabled: !Number.isNaN(courseId) }
    );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Back */}
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
          <Text style={styles.backText}>Courses</Text>
        </TouchableOpacity>

        {/* Course header */}
        <View style={styles.courseHeader}>
          <View style={styles.courseBadge}>
            <Text style={styles.courseBadgeText}>
              {(course?.title ?? "?").charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.courseTitle}>{course?.title ?? "Course"}</Text>
          {(course as any)?.subject ? (
            <Text style={styles.courseSubject}>{(course as any).subject}</Text>
          ) : null}
          <Text style={styles.courseLecturer}>
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
              style={styles.itemCard}
              onPress={() =>
                router.push({ pathname: "/document/[id]", params: { id: doc.id } })
              }
              activeOpacity={0.75}
            >
              <View style={[styles.itemIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="document-text" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle} numberOfLines={1}>{doc.title}</Text>
                <Text style={styles.itemMeta}>
                  {(doc as any).materialType} · {doc.fileName}
                </Text>
              </View>
              <Text style={styles.openLink}>Open →</Text>
            </TouchableOpacity>
          ))
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
              style={styles.quizCard}
              onPress={() =>
                router.push({
                  pathname: "/document/[id]",
                  params: { id: quiz.documentId, tab: "quiz", quizId: quiz.id },
                })
              }
              activeOpacity={0.75}
            >
              <View style={[styles.itemIcon, { backgroundColor: "#ede9fe" }]}>
                <Ionicons name="help-circle" size={20} color="#7c3aed" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle} numberOfLines={1}>{quiz.title}</Text>
                <Text style={styles.itemMeta}>
                  {quiz.totalQuestions} questions ·{" "}
                  {new Date(quiz.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                </Text>
              </View>
              {quiz.completedAt ? (
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreText}>
                    {quiz.score ? `${Number(quiz.score).toFixed(0)}%` : "Done"}
                  </Text>
                </View>
              ) : (
                <Text style={styles.openLink}>Start →</Text>
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
            <View key={a.id} style={styles.announcementCard}>
              <Text style={styles.announcementTitle}>{a.title}</Text>
              <Text style={styles.announcementContent}>{a.content}</Text>
              <Text style={styles.announcementDate}>
                {new Date(a.createdAt).toLocaleString()}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  style,
}: {
  icon: string;
  title: string;
  style?: object;
}) {
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 16 },
  back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20 },
  backText: { fontSize: 15, color: colors.primary, fontWeight: "600" },
  courseHeader: {
    backgroundColor: colors.primary + "15",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    marginBottom: 28,
  },
  courseBadge: {
    width: 60, height: 60, borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  courseBadgeText: { fontSize: 28, fontWeight: "800", color: colors.white },
  courseTitle: { fontSize: 20, fontWeight: "800", color: colors.text, textAlign: "center" },
  courseSubject: { fontSize: 14, color: colors.primary, fontWeight: "600", marginTop: 4 },
  courseLecturer: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  itemCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface, borderRadius: 16,
    padding: 14, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  quizCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface, borderRadius: 16,
    padding: 14, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    borderLeftWidth: 3, borderLeftColor: "#7c3aed",
  },
  itemIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  itemTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  itemMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  openLink: { fontSize: 13, color: colors.primary, fontWeight: "600" },
  scoreBadge: {
    backgroundColor: "#d1fae5", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  scoreText: { fontSize: 12, fontWeight: "700", color: "#065f46" },
  announcementCard: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  announcementTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 6 },
  announcementContent: { fontSize: 14, color: colors.text, lineHeight: 20 },
  announcementDate: { fontSize: 12, color: colors.textMuted, marginTop: 8 },
});
