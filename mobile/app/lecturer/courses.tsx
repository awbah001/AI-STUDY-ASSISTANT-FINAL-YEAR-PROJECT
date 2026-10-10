import { useStaffStyles } from "../../src/contexts/StaffAppearance";
import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "../../src/lib/api";
import {
  Badge,
  Card,
  ChipSelect,
  EmptyState,
  FormField,
  Loading,
  PrimaryButton,
  StaffHeader,
  StaffScreen,
  StatGrid,
  StatTile,
} from "../../src/components/staff/StaffUi";
import { BottomSheet } from "../../src/components/staff/lecturer-workspace/Sheet";
import {
  courseStyles as baseStyles,
  courseError,
} from "../../src/components/staff/lecturer-workspace/courseTools";
import {
  shareText,
  type RouterOutputs,
} from "../../src/components/staff/lecturer-workspace/helpers";

import { LIMITS, useFieldErrors, validateText } from "../../src/lib/validation";

const SUBJECT_MAX = 100;

type Course = RouterOutputs["lecturer"]["courses"]["list"][number];
export default function LecturerCourses() {
  const st = useStaffStyles(baseStyles);

  const router = useRouter();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [edit, setEdit] = useState<Course | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const { errors, check, clear, reset } = useFieldErrors<"title" | "subject" | "description">();
  const courses = trpc.lecturer.courses.list.useQuery();
  const stats = trpc.lecturer.dashboardStats.useQuery();
  const students = trpc.lecturer.students.listAll.useQuery();
  const update = trpc.lecturer.courses.update.useMutation({
    onSuccess: (_, input) => {
      setEdit(null);
      reset();
      void utils.lecturer.invalidate();
      Alert.alert(
        "Course updated",
        typeof input.isActive === "boolean"
          ? input.isActive
            ? "Course restored."
            : "Course archived. Enrolled students keep access."
          : "Your changes have been saved."
      );
    },
    onError: courseError,
  });
  const query = search.trim().toLowerCase();
  const all = courses.data || [];
  const visible = all.filter(
    c =>
      (tab === "active" ? c.isActive : !c.isActive) &&
      [c.title, c.code, c.subject].some(v => v?.toLowerCase().includes(query))
  );
  return (
    <StaffScreen onRefresh={() => utils.lecturer.invalidate()}>
      <StaffHeader
        title="My Courses"
        subtitle="Courses assigned by an administrator. Archive to stop new enrollments; enrolled students keep access."
      />
      <StatGrid>
        <StatTile
          icon="book-outline"
          label="Total courses"
          value={courses.data?.length ?? "-"}
        />
        <StatTile
          icon="checkmark-circle-outline"
          label="Active courses"
          value={courses.data ? all.filter(c => c.isActive).length : "-"}
        />
        <StatTile
          icon="people-outline"
          label="Enrolled students"
          value={stats.data?.studentCount ?? "-"}
        />
        <StatTile
          icon="document-text-outline"
          label="Course materials"
          value={stats.data?.documentCount ?? "-"}
        />
      </StatGrid>
      <FormField
        value={search}
        onChangeText={setSearch}
        placeholder="Search by title, subject, or code"
        autoCapitalize="none"
      />
      <ChipSelect
        value={tab}
        onChange={setTab}
        options={[
          {
            value: "active",
            label: `Active (${all.filter(c => c.isActive).length})`,
          },
          {
            value: "archived",
            label: `Archived (${all.filter(c => !c.isActive).length})`,
          },
        ]}
      />
      {courses.isLoading ? (
        <Loading />
      ) : courses.error ? (
        <>
          <EmptyState
            icon="cloud-offline-outline"
            text={courses.error.message}
          />
          <PrimaryButton label="Retry" onPress={() => void courses.refetch()} />
        </>
      ) : !visible.length ? (
        <EmptyState icon="book-outline" text="No courses match this view." />
      ) : (
        visible.map(course => (
          <Card key={course.id}>
            <Text style={st.title}>{course.title}</Text>
            <Text style={st.meta}>{course.subject}</Text>
            <Badge
              label={course.isActive ? "Active" : "Archived"}
              tone={course.isActive ? "green" : "grey"}
            />
            <Text style={st.text}>{course.description}</Text>
            <Text selectable style={st.text}>
              Enrollment code: {course.code}
            </Text>
            <Text style={st.meta}>
              {students.data
                ? students.data.filter(s => s.courseId === course.id).length
                : "-"}{" "}
              students enrolled
            </Text>
            <View style={st.actions}>
              <PrimaryButton
                label="Open course"
                icon="book-outline"
                onPress={() =>
                  router.push({
                    pathname: "/lecturer-course/[id]",
                    params: { id: String(course.id) },
                  } as any)
                }
              />
              <PrimaryButton
                label="Share enrollment code"
                icon="share-outline"
                variant="outline"
                onPress={() =>
                  void shareText(
                    course.title,
                    `Join ${course.title} on the Course-Specific AI Learning Assistant with code ${course.code}.`
                  )
                }
              />
              <PrimaryButton
                label="Edit course"
                icon="create-outline"
                variant="outline"
                onPress={() => {
                  setEdit(course);
                  setTitle(course.title);
                  setSubject(course.subject || "");
                  setDescription(course.description || "");
                }}
              />
              <PrimaryButton
                label={course.isActive ? "Archive course" : "Restore course"}
                icon="archive-outline"
                variant="outline"
                disabled={update.isPending}
                onPress={() =>
                  Alert.alert(
                    course.isActive ? "Archive course" : "Restore course",
                    course.isActive
                      ? "Stop new enrollments? Enrolled students will keep access."
                      : "Allow new students to enroll again?",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Confirm",
                        onPress: () =>
                          update.mutate({
                            courseId: course.id,
                            isActive: !course.isActive,
                          }),
                      },
                    ]
                  )
                }
              />
            </View>
          </Card>
        ))
      )}
      <BottomSheet
        visible={!!edit}
        onClose={() => {
          if (!update.isPending) setEdit(null);
        }}
        title="Edit course"
      >
        <FormField
          label="Title"
          value={title}
          onChangeText={v => {
            setTitle(v);
            clear("title");
          }}
          maxLength={LIMITS.title.max}
          error={errors.title}
        />
        <FormField
          label="Subject"
          value={subject}
          onChangeText={v => {
            setSubject(v);
            clear("subject");
          }}
          maxLength={SUBJECT_MAX}
          error={errors.subject}
        />
        <FormField
          label="Description"
          value={description}
          onChangeText={v => {
            setDescription(v);
            clear("description");
          }}
          multiline
          maxLength={LIMITS.description}
          error={errors.description}
        />
        <PrimaryButton
          label="Save changes"
          loading={update.isPending}
          onPress={() => {
            const ok = check({
              title: validateText(title, { label: "Title", ...LIMITS.title }),
              subject: validateText(subject, { label: "Subject", required: false, max: SUBJECT_MAX }),
              description: validateText(description, { label: "Description", required: false, max: LIMITS.description }),
            });
            if (ok && edit)
              update.mutate({
                courseId: edit.id,
                title: title.trim(),
                subject: subject.trim() || undefined,
                description: description.trim() || undefined,
              });
          }}
        />
      </BottomSheet>
    </StaffScreen>
  );
}
