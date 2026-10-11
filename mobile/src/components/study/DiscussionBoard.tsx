import { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { trpc } from "../../lib/api";
import { friendlyError } from "../../lib/friendlyError";
import { useFieldErrors, validateText } from "../../lib/validation";
import { colors } from "../../theme/colors";
import { design, radius } from "../../theme/design";
import { FieldError } from "../FieldError";
import { Pill } from "../ui/Kit";
import { DISCUSSION_LIMITS } from "../../../../shared/studentFeatures";

export function timeAgo(date: Date | string) {
  const seconds = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type Filter = "all" | "open" | "answered";

/** Course Q&A list: students ask, the AI drafts an answer, the lecturer endorses. */
export function DiscussionBoard({ courseId }: { courseId: number }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const list = trpc.discussions.list.useQuery({ courseId });
  const threads = list.data?.threads.filter((t) => (filter === "all" ? true : filter === "answered" ? t.resolved : !t.resolved));

  return (
    <View>
      <View style={s.toolbar}>
        {(["all", "open", "answered"] as const).map((key) => (
          <TouchableOpacity
            key={key}
            style={[s.chip, filter === key && s.chipActive]}
            onPress={() => setFilter(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === key }}
          >
            <Text style={[s.chipText, filter === key && s.chipTextActive]}>
              {key === "all" ? "All" : key === "open" ? "Unanswered" : "Answered"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {asking ? (
        <AskForm
          courseId={courseId}
          isStaff={!!list.data?.canModerate}
          onCancel={() => setAsking(false)}
          onCreated={(id) => {
            setAsking(false);
            router.push({ pathname: "/discussion/[id]", params: { id } });
          }}
        />
      ) : (
        <TouchableOpacity style={s.askBtn} onPress={() => setAsking(true)} activeOpacity={0.85}>
          <Ionicons name="chatbubble-ellipses" size={18} color={colors.white} />
          <Text style={s.askText}>Ask a question</Text>
        </TouchableOpacity>
      )}

      {list.isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} /> : null}
      {list.error ? (
        <TouchableOpacity style={s.empty} onPress={() => list.refetch()}>
          <Text style={s.emptyText}>{friendlyError(list.error.message, "Couldn't load questions.")} Tap to retry.</Text>
        </TouchableOpacity>
      ) : null}
      {threads && threads.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="chatbubbles-outline" size={18} color={colors.textLight} />
          <Text style={s.emptyText}>
            {filter === "all" ? "No questions yet. Ask the first one about this course." : "Nothing here yet."}
          </Text>
        </View>
      ) : null}
      {threads?.map((t) => (
        <TouchableOpacity
          key={t.id}
          style={s.thread}
          activeOpacity={0.85}
          onPress={() => router.push({ pathname: "/discussion/[id]", params: { id: t.id } })}
        >
          <View style={s.threadHead}>
            <Text style={s.threadTitle} numberOfLines={2}>
              {t.title}
            </Text>
            {t.resolved ? (
              <Pill label="Answered" icon="checkmark" color={colors.success} bg={colors.successSoft} />
            ) : t.aiStatus === "ready" ? (
              <Pill label="AI answer" icon="sparkles" color={colors.info} bg={colors.infoSoft} />
            ) : null}
          </View>
          <Text style={s.preview} numberOfLines={2}>
            {t.preview}
          </Text>
          <Text style={s.meta}>
            {t.author}
            {t.authorRole !== "user" ? " · Staff" : ""} · {timeAgo(t.lastActivityAt)} · {t.replyCount} repl{t.replyCount === 1 ? "y" : "ies"}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function AskForm({
  courseId,
  isStaff,
  onCancel,
  onCreated,
}: {
  courseId: number;
  isStaff: boolean;
  onCancel: () => void;
  onCreated: (id: number) => void;
}) {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const { errors, check, clear } = useFieldErrors<"title" | "body">();
  const create = trpc.discussions.create.useMutation({
    onSuccess: ({ id }) => {
      void utils.discussions.list.invalidate({ courseId });
      onCreated(id);
    },
    onError: (error) => Alert.alert("Couldn't post", friendlyError(error.message, "Please try again.")),
  });
  const submit = () => {
    const ok = check({
      title: validateText(title, { label: "Question title", ...DISCUSSION_LIMITS.title }),
      body: validateText(body, { label: "Question details", ...DISCUSSION_LIMITS.body }),
    });
    if (ok) create.mutate({ courseId, title: title.trim(), body: body.trim() });
  };
  return (
    <View style={s.form}>
      <TextInput
        style={[design.input, errors.title ? s.inputError : null]}
        placeholder="What do you want to know?"
        placeholderTextColor={colors.textPlaceholder}
        value={title}
        maxLength={DISCUSSION_LIMITS.title.max}
        onChangeText={(v) => {
          setTitle(v);
          clear("title");
        }}
        accessibilityLabel="Question title"
      />
      <FieldError message={errors.title} />
      <TextInput
        style={[design.input, { minHeight: 110, marginTop: 10 }, errors.body ? s.inputError : null]}
        placeholder="Add details: which lecture or topic, and what you've tried."
        placeholderTextColor={colors.textPlaceholder}
        multiline
        textAlignVertical="top"
        value={body}
        maxLength={DISCUSSION_LIMITS.body.max}
        onChangeText={(v) => {
          setBody(v);
          clear("body");
        }}
        accessibilityLabel="Question details"
      />
      <FieldError message={errors.body} />
      {!isStaff ? <Text style={[design.caption, { marginTop: 8 }]}>The AI will draft an answer from your course notes.</Text> : null}
      <View style={s.formActions}>
        <TouchableOpacity style={s.ghostBtn} onPress={onCancel}>
          <Text style={s.ghostText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.postBtn, create.isPending && { opacity: 0.7 }]} disabled={create.isPending} onPress={submit}>
          {create.isPending ? <ActivityIndicator color={colors.white} size="small" /> : null}
          <Text style={s.askText}>{create.isPending ? "Posting..." : "Post question"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  toolbar: { flexDirection: "row", gap: 8, marginBottom: 12 },
  chip: { ...design.chip, minHeight: 34, paddingVertical: 6 },
  chipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  chipText: { fontSize: 12.5, fontWeight: "600", color: colors.textSub },
  chipTextActive: { color: colors.white, fontWeight: "700" },
  askBtn: { ...design.action, flexDirection: "row", gap: 8, marginBottom: 14, minHeight: 48 },
  askText: { ...design.actionText, fontSize: 14 },
  form: { ...design.card, padding: 14, marginBottom: 14 },
  inputError: { borderColor: "#d93a3a" },
  formActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 12 },
  ghostBtn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: radius.md },
  ghostText: { fontSize: 14, fontWeight: "700", color: colors.textSub },
  postBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  empty: {
    ...design.card,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderStyle: "dashed",
    shadowOpacity: 0,
    elevation: 0,
  },
  emptyText: { flex: 1, fontSize: 13, color: colors.textMuted },
  thread: { ...design.card, padding: 14, marginBottom: 10, gap: 4 },
  threadHead: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  threadTitle: { ...design.cardTitle, flex: 1 },
  preview: { ...design.body, fontSize: 13 },
  meta: { ...design.caption, fontSize: 12 },
});
