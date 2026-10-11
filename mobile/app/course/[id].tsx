import { design, elevation } from "../../src/theme/design";
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
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { trpc, API_URL } from "../../src/lib/api";
import { colors, gradients } from "../../src/theme/colors";
import { IconTile, Pill, SectionHeader } from "../../src/components/ui/Kit";
import { showLocalNotification } from "../../src/lib/notifications";
import { studyFormatLabel } from "../../src/lib/studyDocuments";
import { GreenAppBar, HEADER_GREEN } from "../../src/components/GreenAppBar";
import { MockExamLauncher } from "../../src/components/study/MockExamLauncher";
import { DiscussionBoard } from "../../src/components/study/DiscussionBoard";

type TabKey = "overview" | "materials" | "quizzes" | "assignment" | "discussion";
const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "materials", label: "Materials" },
  { key: "quizzes", label: "Quizzes" },
  { key: "assignment", label: "Assignment" },
  { key: "discussion", label: "Discussion" },
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

function courseGlyph(
  title?: string,
  subject?: string | null
): keyof typeof Ionicons.glyphMap {
  const t = `${title ?? ""} ${subject ?? ""}`.toLowerCase();
  if (t.includes("react")) return "logo-react";
  if (t.includes("python")) return "logo-python";
  if (t.includes("android")) return "logo-android";
  if (t.includes("apple") || t.includes("ios")) return "logo-apple";
  if (t.includes("web") || t.includes("html") || t.includes("css"))
    return "globe-outline";
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
  const blob =
    `${doc.title} ${doc.fileName} ${doc.fileUrl ?? ""} ${doc.materialType ?? ""}`.toLowerCase();
  if (blob.includes("github") || blob.includes(".git")) {
    return {
      icon: "logo-github" as const,
      bg: "#ecf1f4",
      color: "#1f2937",
      kind: "GitHub repository",
    };
  }
  if (
    blob.startsWith("http") &&
    !blob.includes("localhost") &&
    (blob.includes("http://") || blob.includes("https://"))
  ) {
    return {
      icon: "globe-outline" as const,
      bg: "#e8f1ff",
      color: "#2563eb",
      kind: "External link",
    };
  }
  const mime = (doc.mimeType ?? "").toLowerCase();
  if (
    mime.includes("presentation") ||
    blob.includes("ppt") ||
    blob.includes("slide")
  ) {
    return {
      icon: "easel-outline" as const,
      bg: "#fff1f2",
      color: "#e11d48",
      kind: "Lecture slides",
    };
  }
  if (mime.includes("pdf") || blob.includes("pdf")) {
    return {
      icon: "document-text" as const,
      bg: "#fff1f2",
      color: "#e11d48",
      kind: "PDF",
    };
  }
  if (mime.includes("word") || blob.includes("doc")) {
    return {
      icon: "document-outline" as const,
      bg: "#eff6ff",
      color: "#2563eb",
      kind: "Document",
    };
  }
  return {
    icon: "document-text-outline" as const,
    bg: "#eef8f3",
    color: colors.primary,
    kind: studyFormatLabel(doc.materialType, doc.fileName),
  };
}

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const courseId = Number(id);
  const prevAnnouncementCount = useRef<number | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const insets = useSafeAreaInsets();

  const { data: courses } = trpc.studentCourses.list.useQuery();
  const course = courses?.find(c => c.id === courseId);

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

  const { data: assignments, isLoading: assignmentsLoading } =
    trpc.studentCourses.assignments.useQuery(
      { courseId },
      { enabled: !Number.isNaN(courseId) }
    );

  const { data: mySubmissions } =
    trpc.assignments.mySubmissionsForCourse.useQuery(
      { courseId },
      { enabled: !Number.isNaN(courseId) }
    );
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
    if (
      prevAnnouncementCount.current !== null &&
      count > prevAnnouncementCount.current
    ) {
      const newest = announcements[0];
      showLocalNotification(
        `New announcement: ${course?.title ?? "Your course"}`,
        newest?.title ?? "Check your course for updates."
      );
    }
    prevAnnouncementCount.current = count;
  }, [announcements, course?.title]);

  const getSubmission = (assignmentId: number) =>
    mySubmissions?.find(s => s.assignmentId === assignmentId);

  const isOverdue = (dueDate: Date | null | undefined) =>
    dueDate ? new Date(dueDate).getTime() < Date.now() : false;

  const materialIds = new Set((materials ?? []).map(m => m.id));
  const rows = (progress ?? []).filter(p => materialIds.has(p.documentId));
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
      router.push({
        pathname: "/document/[id]",
        params: { id: firstMaterial.id },
      });
      return;
    }
    if (quizzes?.[0]) {
      router.push({
        pathname: "/document/[id]",
        params: {
          id: quizzes[0].documentId,
          tab: "quiz",
          quizId: quizzes[0].id,
        },
      });
    }
  };

  const counts: Record<TabKey, number | undefined> = {
    overview: undefined,
    materials: materials?.length,
    quizzes: quizzes?.length,
    assignment: assignments?.length,
    discussion: undefined,
  };

  return (
    <View style={st.root}>
      <GreenAppBar title="Course" onBack={() => router.back()}>
        <View style={st.courseHead}>
          <View style={st.logoWrap}>
            <Ionicons
              name={courseGlyph(course?.title, (course as any)?.subject)}
              size={26}
              color={colors.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.courseTitle} numberOfLines={2}>
              {course?.title ?? "Course"}
            </Text>
            <View style={st.courseMetaRow}>
              {(course as any)?.code ? (
                <View style={st.codeChip}>
                  <Text style={st.codeChipText}>{(course as any).code}</Text>
                </View>
              ) : null}
              {(course as any)?.subject ? (
                <Text style={st.courseMeta} numberOfLines={1}>
                  {(course as any).subject}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
        <View style={st.heroStats}>
          <HeroStat icon="document-text-outline" value={materials?.length ?? 0} label="Materials" />
          <View style={st.heroDivider} />
          <HeroStat icon="help-circle-outline" value={quizzes?.length ?? 0} label="Quizzes" />
          <View style={st.heroDivider} />
          <HeroStat icon="clipboard-outline" value={assignments?.length ?? 0} label="Tasks" />
        </View>
        <View style={st.progressRow}>
          <Text style={st.progressLabel}>Course progress</Text>
          <Text style={st.progressPct}>{pct}%</Text>
        </View>
        <View style={st.progBg}>
          <View style={[st.progFill, { width: `${pct}%` }]} />
        </View>
      </GreenAppBar>
      <View style={st.sheet}>
        <View style={st.tabsWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.tabs}
          >
            {TABS.map(item => {
              const active = tab === item.key;
              const count = counts[item.key];
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[st.tabBtn, active && st.tabBtnActive]}
                  onPress={() => setTab(item.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[st.tabLabel, active && st.tabLabelActive]}>
                    {item.label}
                  </Text>
                  {count ? (
                    <View style={[st.tabCount, active && st.tabCountActive]}>
                      <Text style={[st.tabCountText, active && st.tabCountTextActive]}>
                        {count}
                      </Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
        <ScrollView
          contentContainerStyle={st.content}
          showsVerticalScrollIndicator={false}
        >
          {tab === "overview" ? (
            <>
              <View style={st.aboutCard}>
                <View style={st.aboutHead}>
                  <Ionicons name="information-circle" size={16} color={colors.primary} />
                  <Text style={st.aboutTitle}>About this course</Text>
                </View>
                <Text style={st.description}>
                  {(course as any)?.description?.trim()
                    ? (course as any).description
                    : `Learn ${(course as any)?.subject ?? course?.title ?? "this course"} with lectures, materials, and AI support from your lecturer.`}
                </Text>
              </View>

              <SectionHeader
                title="Course materials"
                action={materials && materials.length > 6 ? "See all" : undefined}
                onAction={() => setTab("materials")}
              />
              {materialsLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : !materials?.length ? (
                <EmptyLine icon="folder-open-outline" text="No materials available yet." />
              ) : (
                materials
                  .slice(0, 6)
                  .map(doc => (
                    <MaterialRow
                      key={doc.id}
                      doc={doc}
                      onPress={() =>
                        router.push({
                          pathname: "/document/[id]",
                          params: { id: doc.id },
                        })
                      }
                    />
                  ))
              )}

              {announcementsLoading ? null : announcements?.length ? (
                <>
                  <SectionHeader title="Announcements" style={{ marginTop: 14 }} />
                  {announcements.slice(0, 3).map(a => (
                    <View key={a.id} style={st.announcementCard}>
                      <View style={st.announceIcon}>
                        <Ionicons name="megaphone" size={15} color={colors.warning} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={st.itemTitle}>{a.title}</Text>
                        <Text style={st.itemMeta} numberOfLines={3}>
                          {a.content}
                        </Text>
                      </View>
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
              <EmptyLine icon="folder-open-outline" text="No materials available yet." />
            ) : (
              materials.map(doc => (
                <MaterialRow
                  key={doc.id}
                  doc={doc}
                  onPress={() =>
                    router.push({
                      pathname: "/document/[id]",
                      params: { id: doc.id },
                    })
                  }
                />
              ))
            )
          ) : null}

          {tab === "quizzes" ? <MockExamLauncher courseId={courseId} /> : null}

          {tab === "discussion" ? <DiscussionBoard courseId={courseId} /> : null}

          {tab === "quizzes" ? (
            quizzesLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : !quizzes?.length ? (
              <EmptyLine icon="help-circle-outline" text="No quizzes assigned yet." />
            ) : (
              quizzes.map(quiz => (
                <TouchableOpacity
                  key={quiz.id}
                  style={st.itemCard}
                  activeOpacity={0.85}
                  onPress={() =>
                    router.push({
                      pathname: "/document/[id]",
                      params: {
                        id: quiz.documentId,
                        tab: "quiz",
                        quizId: quiz.id,
                      },
                    })
                  }
                >
                  <IconTile icon="help-buoy-outline" color="#db2777" bg="#fdebf4" size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.itemTitle}>{quiz.title}</Text>
                    <Text style={st.itemMeta}>
                      {quiz.totalQuestions} questions
                    </Text>
                  </View>
                  <View style={st.goChip}>
                    <Text style={st.goChipText}>Start</Text>
                  </View>
                </TouchableOpacity>
              ))
            )
          ) : null}

          {tab === "assignment" ? (
            assignmentsLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : !assignments?.length ? (
              <EmptyLine icon="clipboard-outline" text="No assignments yet." />
            ) : (
              assignments.map(asgn => {
                const submission = getSubmission(asgn.id);
                const overdue = isOverdue(asgn.dueDate);
                return (
                  <View key={asgn.id} style={st.itemCard}>
                    <IconTile icon="document-text" color={colors.violet} bg={colors.violetSoft} size={44} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={st.itemTitle}>{asgn.title}</Text>
                      <View style={st.asgnMeta}>
                        <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
                        <Text style={st.itemMetaInline}>
                          {asgn.dueDate
                            ? `Due ${new Date(asgn.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                            : "No due date"}
                        </Text>
                      </View>
                      <View style={st.asgnMeta}>
                        {submission ? (
                          <Pill label="Submitted" icon="checkmark" color={colors.success} bg={colors.successSoft} />
                        ) : overdue ? (
                          <Pill label="Overdue" icon="alert" color={colors.error} bg={colors.errorSoft} />
                        ) : null}
                        {asgn.fileUrl ? (
                          <TouchableOpacity
                            onPress={() =>
                              void Linking.openURL(mediaUrl(asgn.fileUrl))
                            }
                            style={st.linkRow}
                          >
                            <Ionicons name="attach" size={13} color={colors.primary} />
                            <Text style={st.link}>Attachment</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[st.smallCta, submission && st.smallCtaGhost]}
                      onPress={() =>
                        router.push({
                          pathname: "/submit-assignment",
                          params: {
                            assignmentId: String(asgn.id),
                            courseId: String(courseId),
                            title: asgn.title,
                            description: asgn.description ?? "",
                            dueDate: asgn.dueDate
                              ? String(new Date(asgn.dueDate).getTime())
                              : "",
                            fileUrl: asgn.fileUrl ?? "",
                            fileName: asgn.fileName ?? "",
                          },
                        })
                      }
                    >
                      <Text style={[st.smallCtaText, submission && st.smallCtaGhostText]}>
                        {submission ? "View" : "Submit"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )
          ) : null}

          <View style={{ height: 96 }} />
        </ScrollView>

        <View style={[st.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <TouchableOpacity
            style={st.continueBtn}
            onPress={continueLearning}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={gradients.hero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={st.continueInner}
            >
              <Ionicons name="play-circle" size={20} color={colors.accentSoft} />
              <Text style={st.continueText}>Continue learning</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function HeroStat({
  icon,
  value,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  value: number;
  label: string;
}) {
  return (
    <View style={st.heroStat}>
      <Ionicons name={icon} size={15} color={colors.accentSoft} />
      <Text style={st.heroStatValue}>{value}</Text>
      <Text style={st.heroStatLabel}>{label}</Text>
    </View>
  );
}

function EmptyLine({
  icon,
  text,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  text: string;
}) {
  return (
    <View style={st.emptyLine}>
      <Ionicons name={icon} size={18} color={colors.textLight} />
      <Text style={st.empty}>{text}</Text>
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
    <TouchableOpacity style={st.itemCard} onPress={onPress} activeOpacity={0.85}>
      <IconTile icon={visual.icon} color={visual.color} bg={visual.bg} size={44} />
      <View style={{ flex: 1 }}>
        <Text style={st.itemTitle} numberOfLines={1}>
          {doc.title}
        </Text>
        <Text style={st.itemMeta} numberOfLines={1}>
          {visual.kind}
          {size ? `  ·  ${size}` : ""}
        </Text>
      </View>
      <View style={st.rowArrow}>
        <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: HEADER_GREEN },
  sheet: {
    flex: 1,
    marginTop: -14,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    ...design.page,
  },
  courseHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  courseTitle: {
    color: colors.white,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  courseMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  codeChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  codeChipText: { color: colors.white, fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  courseMeta: { flex: 1, color: "#bfe3d6", fontSize: 12.5, fontWeight: "500" },
  heroStats: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginBottom: 16,
  },
  heroStat: { flex: 1, alignItems: "center", gap: 2 },
  heroStatValue: { color: colors.white, fontSize: 17, fontWeight: "800" },
  heroStatLabel: { color: "#bfe3d6", fontSize: 11, fontWeight: "600" },
  heroDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.12)" },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressLabel: { fontSize: 12.5, fontWeight: "600", color: "#d1fae5" },
  progressPct: { fontSize: 13, fontWeight: "800", color: colors.white },
  progBg: {
    height: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.16)",
    marginTop: 8,
    overflow: "hidden",
  },
  progFill: { height: "100%", backgroundColor: colors.accent, borderRadius: 6 },

  tabsWrap: { paddingTop: 18, paddingBottom: 6 },
  tabs: { paddingHorizontal: 20, gap: 8 },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 38,
    paddingHorizontal: 15,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabBtnActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  tabLabel: { fontSize: 13, fontWeight: "600", color: colors.textSub },
  tabLabelActive: { color: colors.white, fontWeight: "700" },
  tabCount: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  tabCountActive: { backgroundColor: "rgba(255,255,255,0.18)" },
  tabCountText: { fontSize: 11, fontWeight: "700", color: colors.textMuted },
  tabCountTextActive: { color: colors.white },

  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  aboutCard: { ...design.card, padding: 16, marginBottom: 22 },
  aboutHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  aboutTitle: { fontSize: 13, fontWeight: "700", color: colors.primaryDark },
  description: { ...design.body },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginBottom: 10,
    gap: 12,
    ...design.card,
  },
  itemTitle: { ...design.cardTitle },
  itemMeta: { marginTop: 2, ...design.caption },
  itemMetaInline: { ...design.caption },
  asgnMeta: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  rowArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  goChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
  },
  goChipText: { fontSize: 12, fontWeight: "700", color: colors.primary },
  emptyLine: {
    ...design.card,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    marginBottom: 12,
    borderStyle: "dashed",
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  empty: { fontSize: 13, color: colors.textMuted, fontWeight: "500" },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  link: { fontSize: 12, color: colors.primary, fontWeight: "700" },
  announcementCard: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    marginBottom: 10,
    ...design.card,
  },
  announceIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.warningSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  smallCta: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  smallCtaGhost: { backgroundColor: colors.primaryLight },
  smallCtaText: { color: colors.white, fontWeight: "700", fontSize: 12 },
  smallCtaGhostText: { color: colors.primary },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: "rgba(245,247,246,0.96)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  continueBtn: { borderRadius: 16, ...elevation.brand },
  continueInner: {
    minHeight: 54,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  continueText: { color: colors.white, fontWeight: "800", fontSize: 16 },
});
