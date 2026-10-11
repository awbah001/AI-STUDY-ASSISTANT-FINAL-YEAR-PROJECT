import { design } from "../../src/theme/design";
import { useStaffStyles } from "../../src/contexts/StaffAppearance";
import { CourseMaterials } from "../../src/components/staff/lecturer-workspace/CourseMaterials";
import { CourseQuizzes } from "../../src/components/staff/lecturer-workspace/CourseQuizzes";
import { CourseAssignments } from "../../src/components/staff/lecturer-workspace/CourseAssignments";
import { DiscussionBoard } from "../../src/components/study/DiscussionBoard";
import { ConfusionReport } from "../../src/components/staff/lecturer-workspace/ConfusionReport";
import { useState } from "react";
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/contexts/AuthContext";
import { API_URL, trpc } from "../../src/lib/api";
import { homeForRole } from "../../src/lib/roleHome";
import { colors } from "../../src/theme/colors";
import { BackHeader } from "../../src/components/BackHeader";
import {
  Badge,
  Card,
  ChipSelect,
  EmptyState,
  formatDate,
  FormField,
  ListItem,
  Loading,
  PrimaryButton,
  SectionHeader,
  StaffScreen,
} from "../../src/components/staff/StaffUi";

type Section =
  "quizzes" | "students" | "materials" | "assignments" | "announcements" | "discussion" | "insights";

export default function LecturerCourseDetail() {
  const st = useStaffStyles(baseStyles);

  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const courseId = Number(id);
  const utils = trpc.useUtils();
  const [section, setSection] = useState<Section>("materials");
  const isLecturer = user?.role === "lecturer";

  const course = trpc.lecturer.courses.get.useQuery(
    { courseId },
    { enabled: isLecturer && Number.isInteger(courseId) && courseId > 0 }
  );

  if (!user) return <Redirect href="/(auth)/login" />;
  if (!isLecturer) return <Redirect href={homeForRole(user.role) as any} />;

  if (!Number.isInteger(courseId) || courseId <= 0)
    return (
      <StaffScreen>
        <BackHeader title="Course not found" fallback="/lecturer/courses" />
        <EmptyState
          icon="alert-circle-outline"
          text="Choose a course from your course list."
        />
      </StaffScreen>
    );
  return (
    <StaffScreen onRefresh={() => utils.lecturer.invalidate()}>
      <BackHeader
        title={course.data?.title ?? "Course"}
        subtitle={course.data ? `Code ${course.data.code}` : undefined}
        fallback="/lecturer/courses"
      />
      {course.isLoading ? (
        <Loading />
      ) : course.error ? (
        <EmptyState icon="alert-circle-outline" text={course.error.message} />
      ) : (
        <>
          {course.data?.description ? (
            <Text style={st.description}>{course.data.description}</Text>
          ) : null}
          <ChipSelect<Section>
            value={section}
            onChange={setSection}
            options={[
              { value: "materials", label: "Materials" },
              { value: "quizzes", label: "Quizzes" },
              { value: "students", label: "Students" },
              { value: "assignments", label: "Assignments" },
              { value: "announcements", label: "Announcements" },
              { value: "discussion", label: "Discussion" },
              { value: "insights", label: "Class insights" },
            ]}
          />
          {section === "quizzes" && <CourseQuizzes courseId={courseId} />}
          {section === "students" && <StudentsSection courseId={courseId} />}
          {section === "materials" && <CourseMaterials courseId={courseId} />}
          {section === "assignments" && (
            <CourseAssignments courseId={courseId} />
          )}
          {section === "announcements" && (
            <AnnouncementsSection courseId={courseId} />
          )}
          {section === "discussion" && <DiscussionBoard courseId={courseId} />}
          {section === "insights" && (
            <>
              <SectionHeader title="What's confusing my class" />
              <ConfusionReport courseId={courseId} />
            </>
          )}
        </>
      )}
    </StaffScreen>
  );
}

function StudentsSection({ courseId }: { courseId: number }) {
  const st = useStaffStyles(baseStyles);

  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const students = trpc.lecturer.students.listByCourse.useQuery({ courseId });
  const enroll = trpc.lecturer.students.enroll.useMutation({
    onSuccess: result => {
      if (!result.success)
        return Alert.alert("Could not enroll", result.message);
      setEmail("");
      void utils.lecturer.invalidate();
      Alert.alert(
        "Student enrolled",
        "They can now see this course in the app."
      );
    },
    onError: err => Alert.alert("Could not enroll", err.message),
  });
  const remove = trpc.lecturer.students.remove.useMutation({
    onSuccess: () => void utils.lecturer.invalidate(),
    onError: err => Alert.alert("Could not remove", err.message),
  });

  const confirmRemove = (studentId: number, name: string | null) =>
    Alert.alert(
      "Remove student",
      `Remove ${name ?? "this student"} from the course?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => remove.mutate({ courseId, studentId }),
        },
      ]
    );

  return (
    <>
      <Card>
        <FormField
          label="Enroll a student by email"
          value={email}
          onChangeText={setEmail}
          placeholder="student@central.edu.sl"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <PrimaryButton
          label="Enroll student"
          icon="person-add-outline"
          loading={enroll.isPending}
          disabled={!email.includes("@")}
          onPress={() => enroll.mutate({ courseId, email: email.trim() })}
        />
      </Card>
      <SectionHeader title={`Enrolled (${students.data?.length ?? 0})`} />
      {students.isLoading ? (
        <Loading />
      ) : students.error ? (
        <>
          <EmptyState
            icon="cloud-offline-outline"
            text={students.error.message}
          />
          <PrimaryButton
            label="Retry"
            onPress={() => void students.refetch()}
          />
        </>
      ) : !students.data?.length ? (
        <EmptyState
          icon="people-outline"
          text="No students enrolled yet. Share the course code or enroll them above."
        />
      ) : (
        students.data.map(student => (
          <ListItem
            key={student.enrollmentId}
            icon="person"
            iconBg={colors.infoSoft}
            iconColor="#2563eb"
            title={student.name ?? "Unnamed student"}
            subtitle={student.email}
            meta={`Enrolled ${formatDate(student.enrolledAt)}`}
            right={
              <TouchableOpacity
                onPress={() => confirmRemove(student.studentId, student.name)}
                hitSlop={10}
                accessibilityLabel="Remove student"
              >
                <Ionicons name="trash-outline" size={19} color={colors.error} />
              </TouchableOpacity>
            }
          />
        ))
      )}
    </>
  );
}

function AnnouncementsSection({ courseId }: { courseId: number }) {
  const st = useStaffStyles(baseStyles);

  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const list = trpc.lecturer.announcements.listByCourse.useQuery({ courseId });
  const create = trpc.lecturer.announcements.create.useMutation({
    onSuccess: () => {
      setTitle("");
      setContent("");
      void utils.lecturer.announcements.listByCourse.invalidate({ courseId });
      void utils.lecturer.announcements.list.invalidate();
      Alert.alert("Posted", "Enrolled students will get a notification.");
    },
    onError: err => Alert.alert("Could not post", err.message),
  });

  return (
    <>
      <Card>
        <FormField
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Class moved to Friday"
        />
        <FormField
          label="Message"
          value={content}
          onChangeText={setContent}
          placeholder="Write your announcement"
          multiline
        />
        <PrimaryButton
          label="Post announcement"
          icon="megaphone-outline"
          loading={create.isPending}
          disabled={!title.trim() || !content.trim()}
          onPress={() =>
            create.mutate({
              courseId,
              title: title.trim(),
              content: content.trim(),
            })
          }
        />
      </Card>
      <SectionHeader title="Previous announcements" />
      {list.isLoading ? (
        <Loading />
      ) : !list.data?.length ? (
        <EmptyState
          icon="megaphone-outline"
          text="No announcements posted for this course yet."
        />
      ) : (
        list.data.map(item => (
          <Card key={item.id}>
            <Text style={st.annTitle}>{item.title}</Text>
            <Text style={st.annBody}>{item.content}</Text>
            <Text style={st.annMeta}>{formatDate(item.createdAt)}</Text>
          </Card>
        ))
      )}
    </>
  );
}

const baseStyles = StyleSheet.create({
  description: { marginBottom: 14, ...design.body },
  hint: { marginBottom: 12, ...design.caption },
  actions: { flexDirection: "row", gap: 10 },
  annTitle: { ...design.cardTitle },
  annBody: { marginTop: 6, ...design.body },
  annMeta: { marginTop: 8, ...design.caption },
});
