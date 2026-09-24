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
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useRef } from "react";
import { trpc, API_URL } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";
import { showLocalNotification } from "../../src/lib/notifications";
import { studyFormatLabel } from "../../src/lib/studyDocuments";
import { GreenAppBar, HEADER_GREEN } from "../../src/components/GreenAppBar";

type TabKey = "overview" | "materials" | "quizzes" | "assignment";
const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "materials", label: "Materials" },
  { key: "quizzes", label: "Quizzes" },
  { key: "assignment", label: "Assignment" },
];

function mediaUrl(url?: string | null) {
  if (!url) return "";
  return url.startsWith("http") ? url : `${API_URL}${url}`;
}

function formatBytes(n?: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(n >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function courseGlyph(title?: string, subject?: string | null): keyof typeof Ionicons.glyphMap {
  const t = `${title ?? ""} ${subject ?? ""}`.toLowerCase();
  if (t.includes("react")) return "logo-react";
  if (t.includes("python")) return "logo-python";
  if (t.includes("android")) return "logo-android";
  if (t.includes("apple") || t.includes("ios")) return "logo-apple";
  if (t.includes("web") || t.includes("html") || t.includes("css")) return "globe-outline";
  if (t.includes("gis") || t.includes("map")) return "map-outline";
  if (t.includes("market")) return "megaphone-outline";
  if (t.includes("data") || t.includes("sql")) return "server-outline";
  return "book";
}

function materialVisual(doc: {
  title: string;
  fileName: string;
  fileUrl?: string | null;
  materialType?: string | null;
  mimeType?: string | null;
}) {
  const blob = `${doc.title} ${doc.fileName} ${doc.fileUrl ?? ""} ${doc.materialType ?? ""}`.toLowerCase();
  if (blob.includes("github") || blob.includes(".git")) {
    return { icon: "logo-github" as const, bg: "#ecf1f4", color: "#1f2937", kind: "GitHub repository" };
  }
  if (blob.startsWith("http") && !blob.includes("localhost") && (blob.includes("http://") || blob.includes("https://"))) {
    return { icon: "globe-outline" as const, bg: "#e8f1ff", color: "#2563eb", kind: "External link" };
  }
  const mime = (doc.mimeType ?? "").toLowerCase();
  if (mime.includes("presentation") || blob.includes("ppt") || blob.includes("slide")) {
    return { icon: "easel-outline" as const, bg: "#fff1f2", color: "#e11d48", kind: "Lecture slides" };
  }
  if (mime.includes("pdf") || blob.includes("pdf")) {
    return { icon: "document-text" as const, bg: "#fff1f2", color: "#e11d48", kind: "PDF" };
  }
  if (mime.includes("word") || blob.includes("doc")) {
    return { icon: "document-outline" as const, bg: "#eff6ff", color: "#2563eb", kind: "Document" };
  }
  return { icon: "document-text-outline" as const, bg: "#eef8f3", color: colors.primary, kind: studyFormatLabel(doc.materialType, doc.fileName) };
}

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const courseId = Number(id);
  const prevAnnouncementCount = useRef<number | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");

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
  const { data: progress } = trpc.progress.stats.useQuery();
  const recordActivity = trpc.studentLearning.recordActivity.useMutation();

  useEffect(() => {
    if (Number.isNaN(courseId) || courseId <= 0) return;
    recordActivity.mutate({ type: "COURSE_OPENED", courseId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  useEffect(() => {
    if (!announcements) return;
    const count = announcements.length;
    if (prevAnnouncementCount.current !== null && count > prevAnnouncementCount.current) {
      const newest = announcements[0];
      showLocalNotification(
        `New announcement: ${course?.title ?? "Your course"}`,
        newest?.title ?? "Check your course for updates."
      );
    }
    prevAnnouncementCount.current = count;
  }, [announcements, course?.title]);

  const getSubmission = (assignmentId: number) =>
    mySubmissions?.find((s) => s.assignmentId === assignmentId);

  const isOverdue = (dueDate: Date | null | undefined) =>
    dueDate ? new Date(dueDate).getTime() < Date.now() : false;

  const materialIds = new Set((materials ?? []).map((m) => m.id));
  const rows = (progress ?? []).filter((p) => materialIds.has(p.documentId));
  const pct =
    rows.length === 0
      ? 0
      : Math.round(
          rows.reduce((sum, p) => {
            const reviews = p.flashcardsReviewed ?? 0;
            const quizzesN = p.quizzesAttempted ?? 0;
            const mins = p.totalStudyTimeMinutes ?? 0;
            if (!reviews && !quizzesN && !mins) return sum;
            const score =
              Math.min(reviews / 10, 1) * 50 +
              Math.min(quizzesN / 1, 1) * 30 +
              Math.min(mins / 30, 1) * 20;
            return sum + Math.max(5, Math.round(score));
          }, 0) / Math.max(rows.length, 1)
        );
  const firstMaterial = materials?.[0];

  const continueLearning = () => {
    if (firstMaterial) {
      router.push({ pathname: "/document/[id]", params: { id: firstMaterial.id } });
      return;
    }
    if (quizzes?.[0]) {
      router.push({
        pathname: "/document/[id]",
        params: { id: quizzes[0].documentId, tab: "quiz", quizId: quizzes[0].id },
      });
    }
  };

  return (
    <View style={st.root}>
      <GreenAppBar title="Course" onBack={() => router.back()} />
      <View style={st.sheet}>
        <ScrollView contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>
          <View style={st.courseHead}>
            <View style={st.logoWrap}>
              <Ionicons name={courseGlyph(course?.title, (course as any)?.subject)} size={28} color="#2563eb" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.courseTitle}>{course?.title ?? "Course"}</Text>
              <Text style={st.courseMeta}>
                {(course as any)?.code ?? "—"}
                {(course as any)?.subject ? `  ·  ${(course as any).subject}` : ""}
              </Text>
            </View>
          </View>

          <View style={st.tabs}>
            {TABS.map((item) => {
              const active = tab === item.key;
              return (
                <TouchableOpacity key={item.key} style={st.tabBtn} onPress={() => setTab(item.key)}>
                  <Text style={[st.tabLabel, active && st.tabLabelActive]}>{item.label}</Text>
                  {active ? <View style={st.tabUnderline} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>

          {tab === "overview" ? (
            <>
              <View style={st.progressRow}>
                <Text style={st.progressLabel}>{pct}% Complete</Text>
                <Text style={st.progressPct}>{pct}%</Text>
              </View>
              <View style={st.progBg}>
                <View style={[st.progFill, { width: `${pct}%` }]} />
              </View>
              <Text style={st.description}>
                {(course as any)?.description?.trim()
                  ? (course as any).description
                  : `Learn ${(course as any)?.subject ?? course?.title ?? "this course"} with lectures, materials, and AI support from your lecturer.`}
              </Text>

              <Text style={st.sectionTitle}>Course Materials</Text>
              {materialsLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : !materials?.length ? (
                <Text style={st.empty}>No materials available yet.</Text>
              ) : (
                materials.slice(0, 6).map((doc) => (
                  <MaterialRow
                    key={doc.id}
                    doc={doc}
                    onPress={() => router.push({ pathname: "/document/[id]", params: { id: doc.id } })}
                  />
                ))
              )}

              {announcementsLoading ? null : announcements?.length ? (
                <>
                  <Text style={[st.sectionTitle, { marginTop: 18 }]}>Announcements</Text>
                  {announcements.slice(0, 3).map((a) => (
                    <View key={a.id} style={st.announcementCard}>
                      <Text style={st.itemTitle}>{a.title}</Text>
                      <Text style={st.itemMeta} numberOfLines={3}>{a.content}</Text>
                    </View>
                  ))}
                </>
              ) : null}
            </>
          ) : null}

          {tab === "materials" ? (
            materialsLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : !materials?.length ? (
              <Text style={st.empty}>No materials available yet.</Text>
            ) : (
              materials.map((doc) => (
                <MaterialRow
                  key={doc.id}
                  doc={doc}
                  onPress={() => router.push({ pathname: "/document/[id]", params: { id: doc.id } })}
                />
              ))
            )
          ) : null}

          {tab === "quizzes" ? (
            quizzesLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : !quizzes?.length ? (
              <Text style={st.empty}>No quizzes assigned yet.</Text>
            ) : (
              quizzes.map((quiz) => (
                <TouchableOpacity
                  key={quiz.id}
                  style={st.itemCard}
                  onPress={() =>
                    router.push({
                      pathname: "/document/[id]",
                      params: { id: quiz.documentId, tab: "quiz", quizId: quiz.id },
                    })
                  }
                >
                  <View style={[st.itemIcon, { backgroundColor: "#fce7f3" }]}>
                    <Ionicons name="help-buoy-outline" size={18} color="#db2777" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.itemTitle}>{quiz.title}</Text>
                    <Text style={st.itemMeta}>{quiz.totalQuestions} questions</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
                </TouchableOpacity>
              ))
            )
          ) : null}

          {tab === "assignment" ? (
            assignmentsLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : !assignments?.length ? (
              <Text style={st.empty}>No assignments yet.</Text>
            ) : (
              assignments.map((asgn) => {
                const submission = getSubmission(asgn.id);
                const overdue = isOverdue(asgn.dueDate);
                return (
                  <View key={asgn.id} style={st.itemCard}>
                    <View style={[st.itemIcon, { backgroundColor: "#ede9fe" }]}>
                      <Ionicons name="document-text" size={18} color="#7c3aed" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.itemTitle}>{asgn.title}</Text>
                      <Text style={st.itemMeta}>
                        {asgn.dueDate
                          ? `Due: ${new Date(asgn.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                          : "No due date"}
                        {overdue && !submission ? "  ·  Overdue" : ""}
                      </Text>
                      {asgn.fileUrl ? (
                        <TouchableOpacity onPress={() => void Linking.openURL(mediaUrl(asgn.fileUrl))}>
                          <Text style={st.link}>Open attachment</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={st.smallCta}
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
                    >
                      <Text style={st.smallCtaText}>{submission ? "View" : "Submit"}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )
          ) : null}

          <View style={{ height: 88 }} />
        </ScrollView>

        <View style={st.footer}>
          <TouchableOpacity style={st.continueBtn} onPress={continueLearning} activeOpacity={0.9}>
            <Text style={st.continueText}>Continue Learning</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function MaterialRow({
  doc,
  onPress,
}: {
  doc: {
    id: number;
    title: string;
    fileName: string;
    fileUrl?: string | null;
    fileSize?: number | null;
    materialType?: string | null;
    mimeType?: string | null;
  };
  onPress: () => void;
}) {
  const visual = materialVisual(doc);
  const size = formatBytes(doc.fileSize);
  return (
    <TouchableOpacity style={st.itemCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[st.itemIcon, { backgroundColor: visual.bg }]}>
        <Ionicons name={visual.icon} size={18} color={visual.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.itemTitle} numberOfLines={1}>{doc.title}</Text>
        <Text style={st.itemMeta} numberOfLines={1}>
          {visual.kind}
          {size ? `  ·  ${size}` : ""}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: HEADER_GREEN },
  sheet: {
    flex: 1,
    backgroundColor: "#f3f7f5",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 16 },
  courseHead: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 18 },
  logoWrap: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: "#e8f0ff",
    alignItems: "center",
    justifyContent: "center",
  },
  courseTitle: { fontSize: 20, fontWeight: "800", color: "#123047", letterSpacing: -0.3 },
  courseMeta: { fontSize: 13, color: "#8aa0b4", marginTop: 4, fontWeight: "500" },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e6edf0",
    marginBottom: 18,
  },
  tabBtn: { flex: 1, alignItems: "center", paddingBottom: 10 },
  tabLabel: { fontSize: 13, fontWeight: "600", color: "#9aa8b5" },
  tabLabelActive: { color: colors.primary, fontWeight: "800" },
  tabUnderline: {
    position: "absolute",
    bottom: -1,
    height: 3,
    width: "70%",
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressLabel: { fontSize: 13, fontWeight: "700", color: "#334155" },
  progressPct: { fontSize: 12, fontWeight: "700", color: "#8aa0b4" },
  progBg: { height: 7, borderRadius: 6, backgroundColor: "#e6eee9", marginTop: 8, overflow: "hidden" },
  progFill: { height: "100%", backgroundColor: "#12a06e", borderRadius: 6 },
  description: { fontSize: 14, color: "#5b6b7a", lineHeight: 22, marginTop: 14, marginBottom: 22 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#123047", marginBottom: 12 },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  itemIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  itemTitle: { fontSize: 14, fontWeight: "700", color: "#123047" },
  itemMeta: { fontSize: 12, color: "#8aa0b4", marginTop: 2 },
  empty: { fontSize: 13, color: "#8aa0b4", marginBottom: 12 },
  link: { fontSize: 12, color: colors.primary, fontWeight: "700", marginTop: 4 },
  announcementCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  smallCta: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  smallCtaText: { color: colors.white, fontWeight: "700", fontSize: 12 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 18,
    backgroundColor: "#f3f7f5",
  },
  continueBtn: {
    backgroundColor: HEADER_GREEN,
    borderRadius: 16,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  continueText: { color: colors.white, fontWeight: "800", fontSize: 16 },
});
