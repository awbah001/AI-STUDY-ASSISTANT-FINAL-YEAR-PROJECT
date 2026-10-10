import { design } from "../../src/theme/design";
import { useStaffStyles } from "../../src/contexts/StaffAppearance";
import { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";
import { LIMITS, useFieldErrors, validateText } from "../../src/lib/validation";
import {
  Card,
  ChipSelect,
  EmptyState,
  formatDate,
  FormField,
  Loading,
  PrimaryButton,
  SectionHeader,
  StaffHeader,
  StaffScreen,
} from "../../src/components/staff/StaffUi";

export default function LecturerAnnouncements() {
  const st = useStaffStyles(baseStyles);

  const utils = trpc.useUtils();
  const courses = trpc.lecturer.courses.list.useQuery();
  const list = trpc.lecturer.announcements.list.useQuery();
  const [courseId, setCourseId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const { errors, check, clear } = useFieldErrors<"title" | "content">();
  const activeCourseId = courseId ?? courses.data?.[0]?.id ?? null;

  const create = trpc.lecturer.announcements.create.useMutation({
    onSuccess: () => {
      setTitle("");
      setContent("");
      void utils.lecturer.announcements.list.invalidate();
      Alert.alert("Posted", "Enrolled students will get a notification.");
    },
    onError: err => Alert.alert("Could not post", err.message),
  });
  const remove = trpc.lecturer.announcements.delete.useMutation({
    onSuccess: () => void utils.lecturer.announcements.list.invalidate(),
    onError: err => Alert.alert("Could not delete", err.message),
  });

  const confirmDelete = (announcementId: number) =>
    Alert.alert(
      "Delete announcement",
      "Students will no longer see it in the course.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => remove.mutate({ announcementId }),
        },
      ]
    );

  return (
    <StaffScreen
      onRefresh={() => Promise.all([courses.refetch(), list.refetch()])}
    >
      <StaffHeader
        title="Announcements"
        subtitle="Post updates to the students in your courses."
      />

      {courses.isLoading ? (
        <Loading />
      ) : !courses.data?.length ? (
        <EmptyState
          icon="book-outline"
          text="You need an assigned course before you can post announcements."
        />
      ) : (
        <Card>
          <Text style={st.label}>Course</Text>
          <ChipSelect<number>
            value={activeCourseId}
            onChange={setCourseId}
            options={courses.data.map(course => ({
              value: course.id,
              label: course.title,
            }))}
          />
          <FormField
            label="Title"
            value={title}
            onChangeText={v => {
              setTitle(v);
              clear("title");
            }}
            placeholder="e.g. Quiz on Thursday"
            maxLength={LIMITS.title.max}
            error={errors.title}
          />
          <FormField
            label="Message"
            value={content}
            onChangeText={v => {
              setContent(v);
              clear("content");
            }}
            placeholder="Write your announcement"
            multiline
            maxLength={LIMITS.longText}
            error={errors.content}
          />
          <PrimaryButton
            label="Post announcement"
            icon="megaphone-outline"
            loading={create.isPending}
            disabled={!activeCourseId}
            onPress={() => {
              if (!activeCourseId) return;
              const ok = check({
                title: validateText(title, { label: "Title", ...LIMITS.title }),
                content: validateText(content, { label: "Message", min: 5, max: LIMITS.longText }),
              });
              if (!ok) return;
              create.mutate({
                courseId: activeCourseId,
                title: title.trim(),
                content: content.trim(),
              });
            }}
          />
        </Card>
      )}

      <SectionHeader title="Recent" />
      {list.isLoading ? (
        <Loading />
      ) : !list.data?.length ? (
        <EmptyState
          icon="megaphone-outline"
          text="No announcements posted yet."
        />
      ) : (
        list.data.map(item => (
          <Card key={item.id}>
            <View style={st.row}>
              <Text style={st.course} numberOfLines={1}>
                {item.courseTitle}
              </Text>
              <TouchableOpacity
                onPress={() => confirmDelete(item.id)}
                hitSlop={10}
                accessibilityLabel="Delete announcement"
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
            <Text style={st.title}>{item.title}</Text>
            <Text style={st.body}>{item.content}</Text>
            <Text style={st.meta}>{formatDate(item.createdAt)}</Text>
          </Card>
        ))
      )}
    </StaffScreen>
  );
}

const baseStyles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSub,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  course: { flex: 1, ...design.eyebrow },
  title: { marginTop: 6, ...design.cardTitle },
  body: { marginTop: 4, ...design.body },
  meta: { marginTop: 8, ...design.caption },
});
