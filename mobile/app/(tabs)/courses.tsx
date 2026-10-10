import { design, elevation } from "../../src/theme/design";
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
import { useAuth } from "../../src/contexts/AuthContext";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";
import { EmptyCard, IconTile, ProgressBar } from "../../src/components/ui/Kit";
import { friendlyError } from "../../src/lib/friendlyError";
import { validateCourseCode } from "../../src/lib/validation";
import { FieldError, FIELD_ERROR_COLOR } from "../../src/components/FieldError";

const COURSE_COLORS = [
  { bg: colors.primaryLight, accent: colors.primary },
  { bg: colors.infoSoft, accent: colors.info },
  { bg: colors.violetSoft, accent: colors.violet },
  { bg: colors.warningSoft, accent: "#d97706" },
  { bg: colors.errorSoft, accent: colors.error },
  { bg: "#e6f7f5", accent: "#0d9488" },
];

export default function CoursesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showEnroll, setShowEnroll] = useState(false);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const {
    data: courses,
    isLoading,
    refetch,
  } = trpc.studentCourses.list.useQuery(undefined, {
    enabled: !!user?.id,
  });

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
    onError: err =>
      Alert.alert("Error", friendlyError(err.message, "Could not enroll.")),
  });

  const joinCourse = () => {
    const error = validateCourseCode(code);
    setCodeError(error);
    if (!error) enroll.mutate({ code: code.trim().toUpperCase() });
  };

  const filtered = (courses ?? []).filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const total = courses?.length ?? 0;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>
            {total} {total === 1 ? "course" : "courses"} enrolled
          </Text>
          <Text style={s.title}>My courses</Text>
        </View>
        <TouchableOpacity
          style={[s.addBtn, showEnroll && s.addBtnActive]}
          onPress={() => setShowEnroll(v => !v)}
          accessibilityLabel={showEnroll ? "Close enrollment" : "Join a course"}
          activeOpacity={0.85}
        >
          <Ionicons
            name={showEnroll ? "close" : "add"}
            size={20}
            color={showEnroll ? colors.error : colors.white}
          />
          {!showEnroll && <Text style={s.addBtnText}>Join</Text>}
        </TouchableOpacity>
      </View>

      {/* ── Search bar ── */}
      <View style={s.searchWrap}>
        <Ionicons
          name="search-outline"
          size={18}
          color={colors.textLight}
          style={{ marginLeft: 14 }}
        />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search courses"
          placeholderTextColor={colors.textLight}
        />
        {search.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearch("")}
            hitSlop={10}
            style={{ paddingHorizontal: 12 }}
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={18} color={colors.textLight} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Enroll drawer ── */}
      {showEnroll && (
        <View style={s.enrollCard}>
          <View style={s.enrollHead}>
            <IconTile icon="key" size={36} />
            <View style={{ flex: 1 }}>
              <Text style={s.enrollLabel}>Join with enrollment code</Text>
              <Text style={s.enrollHint}>Ask your lecturer for the course code.</Text>
            </View>
          </View>
          <View style={s.enrollRow}>
            <View style={[s.codeWrap, !!codeError && { borderColor: FIELD_ERROR_COLOR }]}>
              <TextInput
                style={s.codeInput}
                value={code}
                onChangeText={v => {
                  setCode(v.toUpperCase().replace(/\s+/g, ""));
                  setCodeError(null);
                }}
                placeholder="ABC123"
                placeholderTextColor={colors.textLight}
                maxLength={10}
                autoCapitalize="characters"
                autoCorrect={false}
                accessibilityLabel="Course code"
                returnKeyType="go"
                onSubmitEditing={joinCourse}
              />
            </View>
            <TouchableOpacity
              style={[s.enrollBtn, enroll.isPending && s.enrollBtnOff]}
              disabled={enroll.isPending}
              onPress={joinCourse}
            >
              {enroll.isPending ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={s.enrollBtnText}>Join</Text>
              )}
            </TouchableOpacity>
          </View>
          <FieldError message={codeError} />
        </View>
      )}

      <ScrollView
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          search ? (
            <EmptyCard
              icon="search-outline"
              title="No matches"
              body={`No course titles match "${search}".`}
            />
          ) : (
            <EmptyCard
              icon="school-outline"
              title="No courses yet"
              body="Enter your lecturer's enrollment code to join your first course."
              action="Join a course"
              onAction={() => setShowEnroll(true)}
            />
          )
        ) : (
          filtered.map((course, idx) => {
            const { bg, accent } = COURSE_COLORS[idx % COURSE_COLORS.length];
            const pct = 20 + ((idx * 19 + 10) % 65);
            return (
              <TouchableOpacity
                key={course.id}
                style={[s.card, menuOpen === course.id && { zIndex: 10 }]}
                onPress={() => {
                  setMenuOpen(null);
                  router.push({
                    pathname: "/course/[id]",
                    params: { id: course.id },
                  });
                }}
                activeOpacity={0.85}
              >
                <View style={[s.cardStripe, { backgroundColor: accent }]} />
                <IconTile icon="book" color={accent} bg={bg} size={50} />

                <View style={s.info}>
                  <Text style={s.cardTitle} numberOfLines={1}>
                    {course.title}
                  </Text>
                  <View style={s.metaRow}>
                    <Ionicons name="person-circle-outline" size={14} color={colors.textMuted} />
                    <Text style={s.cardSub} numberOfLines={1}>
                      {(course as any).subject
                        ? `${(course as any).subject} · `
                        : ""}
                      {(course as any).lecturerName ?? "Prof."}
                    </Text>
                  </View>

                  <View style={s.progRow}>
                    <View style={{ flex: 1 }}>
                      <ProgressBar value={pct} color={accent} track={colors.surfaceAlt} height={5} />
                    </View>
                    <Text style={[s.progPct, { color: accent }]}>{pct}%</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={s.dotBtn}
                  onPress={() =>
                    setMenuOpen(menuOpen === course.id ? null : course.id)
                  }
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Course options"
                >
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={18}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>

                {menuOpen === course.id && (
                  <View style={s.ctxMenu}>
                    <TouchableOpacity
                      style={s.ctxItem}
                      onPress={() => {
                        setMenuOpen(null);
                        router.push({
                          pathname: "/course/[id]",
                          params: { id: course.id },
                        });
                      }}
                    >
                      <Ionicons
                        name="open-outline"
                        size={15}
                        color={colors.textSub}
                      />
                      <Text style={s.ctxText}>Open</Text>
                    </TouchableOpacity>
                    <View style={s.ctxDivider} />
                    <TouchableOpacity
                      style={s.ctxItem}
                      onPress={() => setMenuOpen(null)}
                    >
                      <Ionicons
                        name="share-outline"
                        size={15}
                        color={colors.textSub}
                      />
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
  safe: { flex: 1, ...design.page },

  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 12,
  },
  eyebrow: { ...design.eyebrow, color: colors.primary, marginBottom: 4 },
  title: { ...design.screenTitle },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 21,
    backgroundColor: colors.primary,
    ...elevation.brand,
  },
  addBtnActive: {
    backgroundColor: colors.errorSoft,
    paddingHorizontal: 11,
    shadowOpacity: 0,
    elevation: 0,
  },
  addBtnText: { color: colors.white, fontWeight: "700", fontSize: 14 },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 16,
    ...design.search,
  },
  searchInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: 10,
    fontSize: 14.5,
    color: colors.text,
  },

  enrollCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    ...design.card,
    borderColor: colors.accentSoft,
  },
  enrollHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  enrollLabel: { ...design.cardTitle, fontSize: 14.5 },
  enrollHint: { ...design.caption, marginTop: 1 },
  enrollRow: { flexDirection: "row", gap: 10 },
  codeWrap: {
    flex: 1,
    borderWidth: 1.2,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.bg,
  },
  codeInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 6,
    fontFamily: "monospace",
  },
  enrollBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    ...elevation.brand,
  },
  enrollBtnOff: { opacity: 0.45 },
  enrollBtnText: { color: colors.white, fontWeight: "800", fontSize: 15 },

  list: { paddingHorizontal: 20 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingLeft: 18,
    marginBottom: 12,
    gap: 14,
    overflow: "visible",
    ...design.card,
  },
  cardStripe: {
    position: "absolute",
    left: 0,
    top: 18,
    bottom: 18,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  info: { flex: 1, gap: 4 },
  cardTitle: { ...design.cardTitle },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardSub: { ...design.caption, flex: 1 },
  progRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  progPct: { fontSize: 12, fontWeight: "700", minWidth: 32, textAlign: "right" },
  dotBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt,
  },

  ctxMenu: {
    position: "absolute",
    right: 14,
    top: 56,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 4,
    zIndex: 99,
    minWidth: 140,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: "#0b2a20",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 12,
  },
  ctxItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  ctxText: { fontSize: 14, color: colors.text, fontWeight: "500" },
  ctxDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: 10,
  },
});
