import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
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

const COURSE_COLORS = [
  { bg: "#e8fdf2", accent: colors.primary },
  { bg: "#eff6ff", accent: "#3b82f6" },
  { bg: "#f3f0ff", accent: "#8b5cf6" },
  { bg: "#fff7ed", accent: "#f59e0b" },
  { bg: "#fef2f2", accent: "#ef4444" },
  { bg: "#f0fdfa", accent: "#14b8a6" },
];

export default function CoursesScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showEnroll, setShowEnroll] = useState(false);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: courses, isLoading, refetch } = trpc.studentCourses.list.useQuery();

  const enroll = trpc.studentCourses.enroll.useMutation({
    onSuccess: (r: any) => {
      if (r.success) {
        Alert.alert("Enrolled!", r.message ?? "You have joined the course.");
        setCode("");
        setShowEnroll(false);
        utils.studentCourses.list.invalidate();
      } else {
        Alert.alert("Error", r.message ?? "Could not enroll.");
      }
    },
    onError: (err) => Alert.alert("Error", err.message),
  });

  const filtered = (courses ?? []).filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.title}>My Courses</Text>
        <TouchableOpacity
          style={[s.addBtn, showEnroll && { backgroundColor: "#fef2f2" }]}
          onPress={() => setShowEnroll((v) => !v)}
        >
          <Ionicons
            name={showEnroll ? "close" : "add"}
            size={22}
            color={showEnroll ? colors.error : colors.white}
          />
        </TouchableOpacity>
      </View>

      {/* ── Search bar ── */}
      <View style={s.searchWrap}>
        <Ionicons
          name="search-outline"
          size={17}
          color={colors.textLight}
          style={{ marginLeft: 14 }}
        />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search courses..."
          placeholderTextColor={colors.textLight}
        />
        <View style={s.allBadge}>
          <Text style={s.allBadgeText}>All ▾</Text>
        </View>
      </View>

      {/* ── Enroll drawer ── */}
      {showEnroll && (
        <View style={s.enrollCard}>
          <Text style={s.enrollLabel}>Join with enrollment code</Text>
          <View style={s.enrollRow}>
            <View style={s.codeWrap}>
              <Ionicons name="key-outline" size={18} color={colors.textLight} style={{ marginLeft: 12 }} />
              <TextInput
                style={s.codeInput}
                value={code}
                onChangeText={(v) => setCode(v.toUpperCase())}
                placeholder="ABC123"
                placeholderTextColor={colors.textLight}
                maxLength={6}
                autoCapitalize="characters"
              />
            </View>
            <TouchableOpacity
              style={[
                s.enrollBtn,
                (code.length < 4 || enroll.isPending) && s.enrollBtnOff,
              ]}
              disabled={code.length < 4 || enroll.isPending}
              onPress={() => enroll.mutate({ code })}
            >
              {enroll.isPending ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={s.enrollBtnText}>Join</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIconWrap}>
              <Ionicons name="school-outline" size={36} color={colors.primary} />
            </View>
            <Text style={s.emptyTitle}>No courses yet</Text>
            <Text style={s.emptyText}>
              Tap + above and enter your lecturer's enrollment code.
            </Text>
          </View>
        ) : (
          filtered.map((course, idx) => {
            const { bg, accent } = COURSE_COLORS[idx % COURSE_COLORS.length];
            const pct = 20 + ((idx * 19 + 10) % 65);
            return (
              <TouchableOpacity
                key={course.id}
                style={s.card}
                onPress={() => {
                  setMenuOpen(null);
                  router.push({ pathname: "/course/[id]", params: { id: course.id } });
                }}
                activeOpacity={0.8}
              >
                {/* left badge */}
                <View style={[s.badge, { backgroundColor: bg }]}>
                  <Ionicons name="book" size={22} color={accent} />
                </View>

                {/* info */}
                <View style={s.info}>
                  <Text style={s.cardTitle} numberOfLines={1}>
                    {course.title}
                  </Text>
                  <Text style={s.cardSub} numberOfLines={1}>
                    {(course as any).subject
                      ? `${(course as any).subject} · `
                      : ""}
                    {(course as any).lecturerName ?? "Prof."}
                  </Text>

                  {/* progress */}
                  <View style={s.progRow}>
                    <View style={s.progBg}>
                      <View
                        style={[
                          s.progFill,
                          { width: `${pct}%` as any, backgroundColor: accent },
                        ]}
                      />
                    </View>
                    <Text style={[s.progPct, { color: accent }]}>{pct}%</Text>
                  </View>
                </View>

                {/* 3-dot menu */}
                <TouchableOpacity
                  style={s.dotBtn}
                  onPress={() =>
                    setMenuOpen(menuOpen === course.id ? null : course.id)
                  }
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="ellipsis-vertical"
                    size={18}
                    color={colors.textLight}
                  />
                </TouchableOpacity>

                {/* context menu */}
                {menuOpen === course.id && (
                  <View style={s.ctxMenu}>
                    <TouchableOpacity
                      style={s.ctxItem}
                      onPress={() => {
                        setMenuOpen(null);
                        router.push({ pathname: "/course/[id]", params: { id: course.id } });
                      }}
                    >
                      <Ionicons name="open-outline" size={15} color={colors.textSub} />
                      <Text style={s.ctxText}>Open</Text>
                    </TouchableOpacity>
                    <View style={s.ctxDivider} />
                    <TouchableOpacity
                      style={s.ctxItem}
                      onPress={() => setMenuOpen(null)}
                    >
                      <Ionicons name="share-outline" size={15} color={colors.textSub} />
                      <Text style={s.ctxText}>Share</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5f6fa" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 22, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 10,
    fontSize: 14,
    color: colors.text,
  },
  allBadge: {
    marginRight: 12,
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  allBadgeText: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },

  // Enroll
  enrollCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  enrollLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSub,
    marginBottom: 10,
  },
  enrollRow: { flexDirection: "row", gap: 10 },
  codeWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
  },
  codeInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
    fontSize: 17,
    color: colors.text,
    letterSpacing: 5,
    fontFamily: "monospace",
  },
  enrollBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  enrollBtnOff: { opacity: 0.45 },
  enrollBtnText: { color: colors.white, fontWeight: "800", fontSize: 15 },

  // Course list
  list: { paddingHorizontal: 20 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  badge: {
    width: 50,
    height: 50,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  cardSub: { fontSize: 12, color: colors.textMuted },
  progRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  progBg: {
    flex: 1,
    height: 5,
    backgroundColor: "#f1f5f9",
    borderRadius: 3,
    overflow: "hidden",
  },
  progFill: { height: "100%", borderRadius: 3 },
  progPct: { fontSize: 12, fontWeight: "700", minWidth: 32 },
  dotBtn: { padding: 4 },

  // Context menu
  ctxMenu: {
    position: "absolute",
    right: 14,
    top: 44,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 4,
    zIndex: 99,
    minWidth: 130,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  ctxItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  ctxText: { fontSize: 14, color: colors.text, fontWeight: "500" },
  ctxDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: 10 },

  // Empty
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: "#e8fdf2",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 240,
  },
});
