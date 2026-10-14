import { design } from "../../src/theme/design";
import { useStaffStyles } from "../../src/contexts/StaffAppearance";
import { useMemo, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";
import { BackHeader } from "../../src/components/BackHeader";
import { FieldError } from "../../src/components/FieldError";
import { LIMITS, useFieldErrors, validateEmail } from "../../src/lib/validation";
import {
  Card,
  ChipSelect,
  EmptyState,
  formatDate,
  FormField,
  Loading,
  PrimaryButton,
  StaffScreen,
  StatGrid,
  StatTile,
} from "../../src/components/staff/StaffUi";
import { BottomSheet } from "../../src/components/staff/lecturer-workspace/Sheet";
import { Avatar } from "../../src/components/staff/lecturer-workspace/Visuals";
import {
  openMail,
  shareText,
  toCsv,
  type RouterOutputs,
} from "../../src/components/staff/lecturer-workspace/helpers";
import { levelLabel } from "../../../shared/academics";

type Enrollment = RouterOutputs["lecturer"]["students"]["listAll"][number];
type Row = { student: Enrollment; courses: Enrollment[] };
type CourseFilter = number | "all";

const NO_LEVEL = "—";

function academicLine(s: Enrollment) {
  return [
    s.programme?.trim(),
    s.academicStatus === "completed"
      ? "Completed"
      : s.level?.trim()
        ? levelLabel(s.level)
        : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function LecturerStudents() {
  const st = useStaffStyles(baseStyles);

  const router = useRouter();
  const utils = trpc.useUtils();
  const courses = trpc.lecturer.courses.list.useQuery();
  const students = trpc.lecturer.students.listAll.useQuery();
  const [search, setSearch] = useState("");
  const [courseTab, setCourseTab] = useState<CourseFilter>("all");
  const [programmeFilter, setProgrammeFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [enrollCourse, setEnrollCourse] = useState<number | null>(null);
  const { errors, check, clear } = useFieldErrors<"course" | "email">();
  const [detailId, setDetailId] = useState<number | null>(null);

  const all = students.data ?? [];
  const activeCourses = (courses.data ?? []).filter(course => course.isActive);
  const uniqueCount = new Set(all.map(s => s.studentId)).size;
  const programmeOptions = useMemo(
    () =>
      [
        ...new Set(
          all
            .map(s => s.programme?.trim())
            .filter((v): v is string => Boolean(v))
        ),
      ].sort(),
    [all]
  );
  const levelOptions = useMemo(
    () =>
      [
        ...new Set(all.map(s => levelLabel(s.level)).filter(v => v !== NO_LEVEL)),
      ].sort(),
    [all]
  );

  const rows = useMemo<Row[]>(() => {
    const term = search.trim().toLowerCase();
    const scoped = all.filter(
      s =>
        (courseTab === "all" || s.courseId === courseTab) &&
        (!programmeFilter || s.programme?.trim() === programmeFilter) &&
        (!levelFilter || levelLabel(s.level) === levelFilter)
    );
    const matched = new Set(
      scoped
        .filter(
          s =>
            !term ||
            [s.name, s.email, s.courseTitle].some(v =>
              v?.toLowerCase().includes(term)
            )
        )
        .map(s => s.studentId)
    );
    const grouped = new Map<number, Row>();
    for (const s of scoped) {
      if (!matched.has(s.studentId)) continue;
      if (!grouped.has(s.studentId))
        grouped.set(s.studentId, { student: s, courses: [] });
      grouped.get(s.studentId)!.courses.push(s);
    }
    return [...grouped.values()];
  }, [all, courseTab, programmeFilter, levelFilter, search]);

  const detail =
    detailId === null
      ? null
      : {
          student: all.find(s => s.studentId === detailId) ?? null,
          courses: all.filter(s => s.studentId === detailId),
        };

  const invalidate = () =>
    Promise.all([
      utils.lecturer.students.listAll.invalidate(),
      utils.lecturer.students.listByCourse.invalidate(),
      utils.lecturer.dashboardStats.invalidate(),
      utils.lecturer.analytics.invalidate(),
    ]);

  const enroll = trpc.lecturer.students.enroll.useMutation({
    onSuccess: result => {
      if (!result.success)
        return Alert.alert("Could not enroll", result.message);
      setEnrollOpen(false);
      setEmail("");
      void invalidate();
      Alert.alert("Student enrolled", result.message);
    },
    onError: err => Alert.alert("Could not enroll", err.message),
  });

  const remove = trpc.lecturer.students.remove.useMutation({
    onSuccess: (_, vars) => {
      if (all.filter(s => s.studentId === vars.studentId).length <= 1)
        setDetailId(null);
      void invalidate();
    },
    onError: err => Alert.alert("Could not remove student", err.message),
  });

  const confirmRemove = (entry: Enrollment) =>
    Alert.alert(
      "Remove from course",
      `Remove ${entry.name ?? entry.email ?? "this student"} from ${entry.courseTitle}? They will lose access to its materials.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            remove.mutate({
              courseId: entry.courseId,
              studentId: entry.studentId,
            }),
        },
      ]
    );

  const openCourse = (courseId: number) => {
    setDetailId(null);
    router.push({
      pathname: "/lecturer-course/[id]",
      params: { id: String(courseId) },
    } as any);
  };

  const openEnroll = () => {
    setEnrollCourse(
      typeof courseTab === "number" &&
        activeCourses.some(c => c.id === courseTab)
        ? courseTab
        : (activeCourses[0]?.id ?? null)
    );
    setEnrollOpen(true);
  };

  const exportStudents = () =>
    shareText(
      "students.csv",
      toCsv([
        ["Name", "Email", "Student ID", "Programme", "Year", "Courses", "Enrolled"],
        ...rows.map(({ student: s, courses: c }) => [
          s.name,
          s.email,
          s.studentNumber ?? "",
          s.programme ?? "",
          s.level ? levelLabel(s.level) : "",
          c.map(v => v.courseTitle).join("; "),
          formatDate(s.enrolledAt),
        ]),
      ])
    );

  const submitEnroll = () => {
    const ok = check({
      course: enrollCourse ? null : "Choose the course to enroll the student in.",
      email: validateEmail(email),
    });
    if (ok && enrollCourse) enroll.mutate({ courseId: enrollCourse, email: email.trim() });
  };

  return (
    <StaffScreen
      onRefresh={() => Promise.all([courses.refetch(), students.refetch()])}
    >
      <BackHeader
        title="Students"
        subtitle="Everyone enrolled in your courses"
        fallback="/lecturer/more"
      />

      <StatGrid>
        <StatTile
          icon="people-outline"
          label="Enrolled students"
          value={students.data ? uniqueCount : "—"}
        />
        <StatTile
          icon="book-outline"
          label="Courses in view"
          value={
            courses.data ? (courseTab === "all" ? courses.data.length : 1) : "—"
          }
          accent="#2563eb"
          accentBg={colors.infoSoft}
        />
        <StatTile
          icon="search-outline"
          label="Search results"
          value={students.data ? rows.length : "—"}
          accent="#800020"
          accentBg={colors.violetSoft}
        />
        <StatTile
          icon="school-outline"
          label="Course enrollments"
          value={students.data ? all.length : "—"}
          accent="#f59e0b"
          accentBg={colors.warningSoft}
        />
      </StatGrid>

      <ChipSelect<CourseFilter>
        value={courseTab}
        onChange={setCourseTab}
        options={[
          { value: "all", label: `All courses (${uniqueCount})` },
          ...(courses.data ?? []).map(c => ({
            value: c.id,
            label: `${c.title} (${all.filter(s => s.courseId === c.id).length})`,
          })),
        ]}
      />
      {programmeOptions.length > 1 ? (
        <ChipSelect<string>
          value={programmeFilter}
          onChange={setProgrammeFilter}
          options={[
            { value: "", label: "All programmes" },
            ...programmeOptions.map(p => ({ value: p, label: p })),
          ]}
        />
      ) : null}
      {levelOptions.length > 1 ? (
        <ChipSelect<string>
          value={levelFilter}
          onChange={setLevelFilter}
          options={[
            { value: "", label: "All years" },
            ...levelOptions.map(l => ({ value: l, label: l })),
          ]}
        />
      ) : null}

      <View style={st.search}>
        <Ionicons name="search" size={18} color={colors.textLight} />
        <TextInput
          style={st.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, email, or course..."
          placeholderTextColor={colors.textLight}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search students"
        />
        {search ? (
          <TouchableOpacity
            onPress={() => setSearch("")}
            hitSlop={10}
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={18} color={colors.textLight} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={st.actions}>
        <View style={{ flex: 1 }}>
          <PrimaryButton
            label="Export"
            icon="share-outline"
            variant="outline"
            disabled={!rows.length}
            onPress={() => void exportStudents()}
          />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton
            label="Add student"
            icon="person-add-outline"
            disabled={!activeCourses.length}
            onPress={openEnroll}
          />
        </View>
      </View>

      <Text style={st.count}>Students ({rows.length})</Text>
      {students.isLoading ? (
        <Loading />
      ) : students.isError ? (
        <EmptyState
          icon="cloud-offline-outline"
          text="Unable to load students. Pull down to try again."
        />
      ) : !rows.length ? (
        <EmptyState
          icon="people-outline"
          text={
            all.length
              ? "No students match this view."
              : "No students are enrolled in your courses yet."
          }
        />
      ) : (
        rows.map(({ student: s, courses: c }, index) => (
          <Card key={s.studentId} onPress={() => setDetailId(s.studentId)}>
            <View style={st.personRow}>
              <Avatar name={s.name} url={s.avatarUrl} index={index} />
              <View style={{ flex: 1 }}>
                <Text style={st.name} numberOfLines={1}>
                  {s.name ?? "Unnamed student"}
                </Text>
                <Text style={st.email} numberOfLines={1}>
                  {s.email}
                </Text>
                {academicLine(s) ? (
                  <Text style={st.academic} numberOfLines={1}>
                    {academicLine(s)}
                  </Text>
                ) : null}
              </View>
              {s.email ? (
                <TouchableOpacity
                  style={st.iconBtn}
                  onPress={() => openMail(s.email)}
                  accessibilityLabel={`Email ${s.name ?? "student"}`}
                >
                  <Ionicons
                    name="mail-outline"
                    size={18}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={st.badges}>
              {c.map(entry => (
                <TouchableOpacity
                  key={entry.courseId}
                  style={st.courseBadge}
                  onPress={() => openCourse(entry.courseId)}
                >
                  <Text style={st.courseBadgeText} numberOfLines={1}>
                    {entry.courseTitle}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={st.meta}>Enrolled {formatDate(s.enrolledAt)}</Text>
          </Card>
        ))
      )}
      {rows.length ? (
        <Text style={st.footer}>
          Showing 1 to {rows.length} of {rows.length} students
        </Text>
      ) : null}

      <BottomSheet
        visible={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        title="Add student"
        subtitle="Enroll an existing student account by email."
      >
        <Text style={st.label}>Course</Text>
        {activeCourses.length ? (
          <ChipSelect<number>
            value={enrollCourse}
            onChange={v => {
              setEnrollCourse(v);
              clear("course");
            }}
            options={activeCourses.map(c => ({ value: c.id, label: c.title }))}
          />
        ) : (
          <Text style={st.hint}>
            You have no active courses. Restore an archived course before
            enrolling students.
          </Text>
        )}
        <FieldError message={errors.course} style={{ marginBottom: 10 }} />
        <FormField
          label="Student email"
          value={email}
          onChangeText={v => {
            setEmail(v);
            clear("email");
          }}
          placeholder="student@central.edu.sl"
          keyboardType="email-address"
          autoCapitalize="none"
          maxLength={LIMITS.email}
          error={errors.email}
        />
        <PrimaryButton
          label={enroll.isPending ? "Enrolling..." : "Enroll student"}
          icon="person-add-outline"
          loading={enroll.isPending}
          disabled={!activeCourses.length}
          onPress={submitEnroll}
        />
      </BottomSheet>

      <BottomSheet
        visible={!!detail?.student}
        onClose={() => setDetailId(null)}
        title={detail?.student?.name ?? "Student"}
        subtitle={detail?.student?.email}
      >
        {detail?.student ? (
          <View>
            <View style={st.detailHead}>
              <Avatar
                name={detail.student.name}
                url={detail.student.avatarUrl}
                size={56}
              />
              <View style={{ flex: 1 }}>
                {academicLine(detail.student) ? (
                  <Text style={st.academic}>
                    {academicLine(detail.student)}
                  </Text>
                ) : null}
                {detail.student.studentNumber ? (
                  <Text style={st.meta}>
                    Student ID {detail.student.studentNumber}
                  </Text>
                ) : null}
                <Text style={st.meta}>
                  {detail.courses.length} course enrollment
                  {detail.courses.length === 1 ? "" : "s"}
                </Text>
              </View>
            </View>
            {detail.student.email ? (
              <View style={{ marginBottom: 14 }}>
                <PrimaryButton
                  label="Send email"
                  icon="mail-outline"
                  variant="outline"
                  onPress={() => openMail(detail.student?.email)}
                />
              </View>
            ) : null}
            <Text style={st.label}>Courses</Text>
            {detail.courses.map(entry => (
              <View key={entry.courseId} style={st.enrollRow}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => openCourse(entry.courseId)}
                >
                  <Text style={st.enrollTitle} numberOfLines={2}>
                    {entry.courseTitle}
                  </Text>
                  <Text style={st.meta}>
                    Enrolled {formatDate(entry.enrolledAt)} · Open course
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.iconBtn, st.iconBtnDanger]}
                  onPress={() => confirmRemove(entry)}
                  disabled={remove.isPending}
                  accessibilityLabel={`Remove from ${entry.courseTitle}`}
                >
                  <Ionicons
                    name="person-remove-outline"
                    size={18}
                    color={colors.error}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}
      </BottomSheet>
    </StaffScreen>
  );
}

const baseStyles = StyleSheet.create({
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    ...design.search,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
  },
  actions: { flexDirection: "row", gap: 10, marginBottom: 18 },
  count: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 12,
  },
  personRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { ...design.cardTitle },
  email: { marginTop: 2, ...design.caption },
  academic: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSub,
  },
  iconBtn: { ...design.iconButton },
  iconBtnDanger: { backgroundColor: colors.errorSoft },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  courseBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: "100%",
  },
  courseBadgeText: { fontSize: 12, fontWeight: "700", color: colors.primary },
  meta: { marginTop: 8, ...design.caption },
  footer: {
    fontSize: 12,
    color: colors.textLight,
    textAlign: "center",
    marginTop: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSub,
    marginBottom: 8,
  },
  hint: { fontSize: 13, color: colors.textMuted, marginBottom: 12 },
  detailHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  enrollRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  enrollTitle: { ...design.cardTitle },
});
