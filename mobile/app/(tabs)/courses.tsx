import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";

export default function CoursesScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const utils = trpc.useUtils();

  const { data: courses, isLoading, refetch } = trpc.studentCourses.list.useQuery();

  const enroll = trpc.studentCourses.enroll.useMutation({
    onSuccess: (r: any) => {
      if (r.success) {
        Alert.alert("Enrolled!", r.message ?? "You have joined the course.");
        setCode("");
        utils.studentCourses.list.invalidate();
      } else {
        Alert.alert("Error", r.message ?? "Could not enroll.");
      }
    },
    onError: (err) => Alert.alert("Error", err.message),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <Text style={styles.pageTitle}>My Courses</Text>
        <Text style={styles.pageSubtitle}>
          Join courses using the code from your lecturer.
        </Text>

        {/* Enroll */}
        <View style={styles.enrollCard}>
          <Text style={styles.enrollLabel}>Join a course</Text>
          <View style={styles.enrollRow}>
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase())}
              placeholder="6-char code"
              placeholderTextColor={colors.textLight}
              maxLength={6}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={[
                styles.enrollBtn,
                (code.length < 4 || enroll.isPending) && styles.enrollBtnDisabled,
              ]}
              disabled={code.length < 4 || enroll.isPending}
              onPress={() => enroll.mutate({ code })}
              activeOpacity={0.85}
            >
              {enroll.isPending ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.enrollBtnText}>Enroll</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Course list */}
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : !courses || courses.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="school-outline" size={44} color={colors.primaryLight} />
            <Text style={styles.emptyTitle}>No courses yet</Text>
            <Text style={styles.emptyText}>
              Enter your lecturer's enrollment code above to join a course.
            </Text>
          </View>
        ) : (
          courses.map((course) => (
            <TouchableOpacity
              key={course.id}
              style={styles.courseCard}
              onPress={() =>
                router.push({
                  pathname: "/course/[id]",
                  params: { id: course.id },
                })
              }
              activeOpacity={0.75}
            >
              <View style={styles.courseBadge}>
                <Text style={styles.courseBadgeText}>
                  {course.title.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.courseInfo}>
                <Text style={styles.courseTitle}>{course.title}</Text>
                {course.subject ? (
                  <Text style={styles.courseSubject}>{course.subject}</Text>
                ) : null}
                <Text style={styles.courseMeta}>
                  {(course as any).lecturerName} · Enrolled{" "}
                  {new Date((course as any).enrolledAt).toLocaleDateString()}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 20 },
  pageTitle: { fontSize: 26, fontWeight: "800", color: colors.text, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4, marginBottom: 24 },
  enrollCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  enrollLabel: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 10 },
  enrollRow: { flexDirection: "row", gap: 10 },
  codeInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    fontFamily: "monospace",
    letterSpacing: 4,
    backgroundColor: "#f8fafc",
  },
  enrollBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 80,
  },
  enrollBtnDisabled: { opacity: 0.5 },
  enrollBtnText: { color: colors.white, fontWeight: "700", fontSize: 15 },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 260,
  },
  courseCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  courseBadge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  courseBadgeText: { fontSize: 20, fontWeight: "800", color: colors.white },
  courseInfo: { flex: 1 },
  courseTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  courseSubject: { fontSize: 13, color: colors.primary, fontWeight: "600", marginTop: 2 },
  courseMeta: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
});
