import { design } from "../../src/theme/design";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";
import {
  Badge,
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
  StatGrid,
  StatTile,
} from "../../src/components/staff/StaffUi";
import { FieldError } from "../../src/components/FieldError";
import { LIMITS, useFieldErrors, validateText } from "../../src/lib/validation";

const TITLE_MAX = 160;

type Audience = "all" | "inactive" | "course" | "lecturers";

const AUDIENCE_LABELS: Record<Audience, string> = {
  all: "All students",
  inactive: "Inactive students",
  course: "One course",
  lecturers: "Lecturers",
};

export default function AdminAnnouncements() {
  const utils = trpc.useUtils();
  const stats = trpc.admin.getCommunicationStats.useQuery();
  const academic = trpc.admin.getAcademicPerformance.useQuery();
  const [audience, setAudience] = useState<Audience>("all");
  const [courseId, setCourseId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const { errors, check, clear } = useFieldErrors<"course" | "title" | "body">();

  const send = trpc.admin.sendAnnouncement.useMutation({
    onSuccess: ({ recipients }) => {
      setTitle("");
      setBody("");
      void utils.admin.getCommunicationStats.invalidate();
      Alert.alert(
        "Announcement sent",
        `Delivered to ${recipients} recipient${recipients === 1 ? "" : "s"}.`
      );
    },
    onError: err => Alert.alert("Could not send", err.message),
  });

  const courses = academic.data?.courses ?? [];
  const confirmSend = () => {
    const ok = check({
      course:
        audience === "course" && !courseId
          ? "Choose the course that should receive this announcement."
          : null,
      title: validateText(title, { label: "Title", min: 2, max: TITLE_MAX }),
      body: validateText(body, { label: "Message", min: 5, max: LIMITS.description }),
    });
    if (!ok) return;
    Alert.alert(
      "Send announcement",
      `Send "${title.trim()}" to ${AUDIENCE_LABELS[audience].toLowerCase()}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: () =>
            send.mutate({
              audience,
              courseId:
                audience === "course" ? (courseId ?? undefined) : undefined,
              title: title.trim(),
              body: body.trim(),
            }),
        },
      ]
    );
  };

  return (
    <StaffScreen
      onRefresh={() => Promise.all([stats.refetch(), academic.refetch()])}
    >
      <StaffHeader
        title="Announcements"
        subtitle="Send platform-wide messages to students or lecturers."
      />

      <StatGrid>
        <StatTile
          icon="paper-plane-outline"
          label="Messages delivered"
          value={stats.data?.sent ?? 0}
        />
        <StatTile
          icon="eye-outline"
          label="Read rate"
          value={`${stats.data?.readRate ?? 0}%`}
          accent="#2563eb"
          accentBg={colors.infoSoft}
        />
      </StatGrid>

      <Card>
        <Text style={st.label}>Audience</Text>
        <ChipSelect<Audience>
          value={audience}
          onChange={setAudience}
          options={(Object.keys(AUDIENCE_LABELS) as Audience[]).map(value => ({
            value,
            label: AUDIENCE_LABELS[value],
          }))}
        />
        {audience === "course" && (
          <>
            <Text style={st.label}>Course</Text>
            {courses.length ? (
              <ChipSelect<number>
                value={courseId}
                onChange={id => {
                  setCourseId(id);
                  clear("course");
                }}
                options={courses.map(course => ({
                  value: course.courseId,
                  label: course.title,
                }))}
              />
            ) : (
              <Text style={st.hint}>No courses available.</Text>
            )}
            <FieldError message={errors.course} style={{ marginBottom: 10 }} />
          </>
        )}
        <FormField
          label="Title"
          value={title}
          onChangeText={v => {
            setTitle(v);
            clear("title");
          }}
          placeholder="e.g. Scheduled maintenance"
          maxLength={TITLE_MAX}
          error={errors.title}
        />
        <FormField
          label={`Message · ${body.length}/${LIMITS.description}`}
          value={body}
          onChangeText={v => {
            setBody(v);
            clear("body");
          }}
          placeholder="Write your announcement"
          multiline
          maxLength={LIMITS.description}
          error={errors.body}
        />
        <PrimaryButton
          label="Send announcement"
          icon="paper-plane-outline"
          loading={send.isPending}
          onPress={confirmSend}
        />
      </Card>

      <SectionHeader title="Recent announcements" />
      {stats.isLoading ? (
        <Loading />
      ) : !stats.data?.recent.length ? (
        <EmptyState
          icon="megaphone-outline"
          text="No announcements sent yet."
        />
      ) : (
        stats.data.recent.map(item => (
          <Card key={item.id}>
            <View style={st.row}>
              <Badge
                label={
                  AUDIENCE_LABELS[(item.audience ?? "all") as Audience] ??
                  "Announcement"
                }
                tone="blue"
              />
              <Text style={st.meta}>{formatDate(item.createdAt)}</Text>
            </View>
            <Text style={st.title}>{item.title}</Text>
            <Text style={st.body} numberOfLines={3}>
              {item.body}
            </Text>
            <Text style={st.meta}>
              {item.readCount} of {item.delivered} read
            </Text>
          </Card>
        ))
      )}
    </StaffScreen>
  );
}

const st = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSub,
    marginBottom: 8,
  },
  hint: { fontSize: 13, color: colors.textMuted, marginBottom: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { marginTop: 8, ...design.cardTitle },
  body: { marginTop: 4, marginBottom: 6, ...design.body },
  meta: { ...design.caption },
});
