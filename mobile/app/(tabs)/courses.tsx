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
  Animated,
} from "react-native";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";

export default function CoursesScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const utils = trpc.useUtils();

  const { data: courses, isLoading, refetch } = trpc.studentCourses.list.useQuery();

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

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
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.pageTitle}>My Courses</Text>
          <Text style={styles.pageSubtitle}>
            Join courses using the code from your lecturer.
          </Text>

          {/* Enroll */}
          <View style={styles.enrollCard}>
            <Text style={styles.enrollLabel}>Join a course</Text>
            <View style={styles.enrollRow}>
              <View style={styles.codeInputWrap}>
                <Ionicons
                  name="key-outline"
                  size={20}
                  color={colors.textLight}
                  style={styles.codeIcon}
                />
                <TextInput
                  style={styles.codeInput}
                  value={code}
                  onChangeText={(v) => setCode(v.toUpperCase())}
                  placeholder="6-char code"
                  placeholderTextColor={colors.textLight}
                  maxLength={6}
                  autoCapitalize="characters"
                />
              </View>
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
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : !courses || courses.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="school-outline" size={48} color={colors.primary} />
              </View>
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
                  <Text style={styles.courseTitle} numberOfLines={1}>
                    {course.title}
                  </Text>
                  {course.subject ? (
                    <Text style={styles.courseSubject}>{course.subject}</Text>
                  ) : null}
                  <Text style={styles.courseMeta}>
                    {(course as any).lecturerName} · Enrolled{" "}
                    {new Date((course as any).enrolledAt).toLocaleDateString()}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
              </TouchableOpacity>
            ))
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 20 },
  pageTitle: { fontSize: 28, fontWeight: "800", color: colors.text, letterSpacing: -0.75 },
  pageSubtitle: { fontSize: 15, color: colors.textMuted, marginTop: 6, marginBottom: 28 },
  enrollCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 22,
    marginBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  enrollLabel: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 12 },
  enrollRow: { flexDirection: "row", gap: 12 },
  codeInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
  },
  codeIcon: {
    paddingLeft: 16,
  },
  codeInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 17,
    color: colors.text,
    fontFamily: "monospace",
    letterSpacing: 4,
  },
  enrollBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 90,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  enrollBtnDisabled: { opacity: 0.5 },
  enrollBtnText: { color: colors.white, fontWeight: "700", fontSize: 16 },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 56,
    gap: 12,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 20,
  },
  courseCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  courseBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  courseBadgeText: { fontSize: 22, fontWeight: "800", color: colors.white },
  courseInfo: { flex: 1 },
  courseTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  courseSubject: { fontSize: 14, color: colors.primary, fontWeight: "600", marginTop: 3 },
  courseMeta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
});
