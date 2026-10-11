import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { trpc } from "../../src/lib/api";
import { friendlyError } from "../../src/lib/friendlyError";
import { validateText } from "../../src/lib/validation";
import { colors } from "../../src/theme/colors";
import { design, radius } from "../../src/theme/design";
import { GreenAppBar, HEADER_GREEN } from "../../src/components/GreenAppBar";
import { FieldError } from "../../src/components/FieldError";
import { Pill } from "../../src/components/ui/Kit";
import { AssistantMessage } from "../../src/components/AssistantMessage";
import { timeAgo } from "../../src/components/study/DiscussionBoard";
import { DISCUSSION_LIMITS } from "../../../shared/studentFeatures";

function RoleTag({ role, isLecturer }: { role: string; isLecturer?: boolean }) {
  if (isLecturer) return <Pill label="Lecturer" color={colors.primary} bg={colors.primaryLight} />;
  if (role === "admin") return <Pill label="Admin" color={colors.textSub} bg={colors.neutralGraySoft} />;
  if (role === "lecturer") return <Pill label="Staff" color={colors.primary} bg={colors.primaryLight} />;
  return null;
}

export default function DiscussionThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const threadId = Number(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();
  const query = trpc.discussions.get.useQuery(
    { threadId },
    { enabled: threadId > 0, refetchInterval: (q) => (q.state.data?.ai.status === "pending" ? 3000 : false) }
  );
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const showError = (error: { message: string }) => Alert.alert("Something went wrong", friendlyError(error.message, "Please try again."));
  const refresh = () => {
    void query.refetch();
    if (query.data) void utils.discussions.list.invalidate({ courseId: query.data.courseId });
  };
  const send = trpc.discussions.reply.useMutation({
    onSuccess: () => {
      setReply("");
      refresh();
    },
    onError: showError,
  });
  const endorse = trpc.discussions.endorse.useMutation({ onSuccess: refresh, onError: showError });
  const retry = trpc.discussions.retryAi.useMutation({ onSuccess: refresh, onError: showError });
  const removeThread = trpc.discussions.deleteThread.useMutation({
    onSuccess: () => {
      if (query.data) void utils.discussions.list.invalidate({ courseId: query.data.courseId });
      router.back();
    },
    onError: showError,
  });
  const removeReply = trpc.discussions.deleteReply.useMutation({ onSuccess: refresh, onError: showError });

  const t = query.data;
  const sendReply = () => {
    const error = validateText(reply, { label: "Reply", ...DISCUSSION_LIMITS.reply });
    setReplyError(error);
    if (!error && t) send.mutate({ threadId: t.id, body: reply.trim() });
  };

  return (
    <View style={st.root}>
      <GreenAppBar
        title={t?.courseTitle ?? "Discussion"}
        onBack={() => router.back()}
        right={
          t?.canDelete ? (
            <TouchableOpacity
              accessibilityLabel="Delete question"
              hitSlop={10}
              onPress={() =>
                Alert.alert("Delete this question?", "All replies will be removed too.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => removeThread.mutate({ threadId: t.id }) },
                ])
              }
            >
              <Ionicons name="trash-outline" size={20} color={colors.white} />
            </TouchableOpacity>
          ) : undefined
        }
      />
      <KeyboardAvoidingView style={st.sheet} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {query.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : !t ? (
          <Text style={[design.body, { padding: 24, textAlign: "center" }]}>
            {friendlyError(query.error?.message, "This question was removed.")}
          </Text>
        ) : (
          <>
            <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
              <View style={st.card}>
                <Text style={st.title}>{t.title}</Text>
                <View style={st.metaRow}>
                  <Text style={st.meta}>{t.author}</Text>
                  <RoleTag role={t.authorRole} isLecturer={t.isLecturer} />
                  <Text style={st.meta}>· {timeAgo(t.createdAt)}</Text>
                </View>
                <Text style={st.body}>{t.body}</Text>
              </View>

              {t.ai.status !== "none" ? (
                <View style={[st.card, t.ai.endorsed ? st.endorsedCard : st.aiCard]}>
                  <View style={st.aiHead}>
                    <Ionicons name="sparkles" size={16} color={colors.info} />
                    <Text style={st.aiTitle}>AI suggested answer</Text>
                    {t.ai.endorsed ? <Pill label="Endorsed" icon="checkmark" color={colors.success} bg={colors.successSoft} /> : null}
                  </View>
                  {t.ai.status === "pending" ? (
                    <View style={st.metaRow}>
                      <ActivityIndicator size="small" color={colors.info} />
                      <Text style={st.meta}>Reading the course materials and drafting an answer...</Text>
                    </View>
                  ) : null}
                  {t.ai.status === "failed" ? (
                    <View style={{ gap: 8 }}>
                      <Text style={st.meta}>The AI couldn't draft an answer this time.</Text>
                      {t.canRetryAi ? (
                        <TouchableOpacity style={st.smallBtn} disabled={retry.isPending} onPress={() => retry.mutate({ threadId: t.id })}>
                          <Ionicons name="refresh" size={14} color={colors.primary} />
                          <Text style={st.smallBtnText}>Try again</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}
                  {t.ai.status === "ready" && t.ai.answer ? (
                    <>
                      <AssistantMessage content={t.ai.answer} />
                      {t.ai.sources.length ? <Text style={[st.meta, { marginTop: 6 }]}>From: {t.ai.sources.join(", ")}</Text> : null}
                      {!t.ai.endorsed ? (
                        <Text style={[st.meta, { marginTop: 4 }]}>AI answers can be wrong. Your lecturer can endorse it once checked.</Text>
                      ) : null}
                      {t.canModerate ? (
                        <TouchableOpacity
                          style={[st.smallBtn, { marginTop: 10 }]}
                          disabled={endorse.isPending}
                          onPress={() => endorse.mutate({ threadId: t.id, endorsed: !t.ai.endorsed })}
                        >
                          <Ionicons name={t.ai.endorsed ? "close-circle-outline" : "checkmark-circle-outline"} size={15} color={colors.primary} />
                          <Text style={st.smallBtnText}>{t.ai.endorsed ? "Remove endorsement" : "Endorse answer"}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </>
                  ) : null}
                </View>
              ) : null}

              <Text style={st.section}>
                {t.replies.length} repl{t.replies.length === 1 ? "y" : "ies"}
              </Text>
              {t.replies.map((r) => (
                <View key={r.id} style={[st.card, r.isEndorsed && st.endorsedCard]}>
                  <View style={st.metaRow}>
                    <Text style={[st.meta, { color: colors.text, fontWeight: "700" }]}>{r.author}</Text>
                    <RoleTag role={r.authorRole} isLecturer={r.isLecturer} />
                    <Text style={st.meta}>· {timeAgo(r.createdAt)}</Text>
                    {r.isEndorsed ? <Pill label="Endorsed" icon="checkmark" color={colors.success} bg={colors.successSoft} /> : null}
                  </View>
                  <Text style={st.body}>{r.body}</Text>
                  {t.canModerate || r.canDelete ? (
                    <View style={st.replyActions}>
                      {t.canModerate ? (
                        <TouchableOpacity
                          style={st.smallBtn}
                          disabled={endorse.isPending}
                          onPress={() => endorse.mutate({ threadId: t.id, replyId: r.id, endorsed: !r.isEndorsed })}
                        >
                          <Text style={st.smallBtnText}>{r.isEndorsed ? "Unendorse" : "Endorse"}</Text>
                        </TouchableOpacity>
                      ) : null}
                      {r.canDelete ? (
                        <TouchableOpacity
                          style={st.smallBtn}
                          accessibilityLabel="Delete reply"
                          onPress={() =>
                            Alert.alert("Delete this reply?", undefined, [
                              { text: "Cancel", style: "cancel" },
                              { text: "Delete", style: "destructive", onPress: () => removeReply.mutate({ replyId: r.id }) },
                            ])
                          }
                        >
                          <Ionicons name="trash-outline" size={14} color={colors.error} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              ))}
              <View style={{ height: 16 }} />
            </ScrollView>
            <View style={[st.composer, { paddingBottom: Math.max(insets.bottom, 10) + 4 }]}>
              <View style={st.composerRow}>
                <TextInput
                  style={[st.replyInput, replyError ? { borderColor: "#d93a3a" } : null]}
                  placeholder="Write a reply..."
                  placeholderTextColor={colors.textPlaceholder}
                  multiline
                  value={reply}
                  maxLength={DISCUSSION_LIMITS.reply.max}
                  onChangeText={(v) => {
                    setReply(v);
                    setReplyError(null);
                  }}
                  accessibilityLabel="Your reply"
                />
                <TouchableOpacity
                  style={[st.sendBtn, send.isPending && { opacity: 0.7 }]}
                  disabled={send.isPending}
                  onPress={sendReply}
                  accessibilityLabel="Send reply"
                >
                  {send.isPending ? <ActivityIndicator color={colors.white} size="small" /> : <Ionicons name="send" size={17} color={colors.white} />}
                </TouchableOpacity>
              </View>
              <FieldError message={replyError} />
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </View>
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
  content: { padding: 20, paddingTop: 22 },
  card: { ...design.card, padding: 16, marginBottom: 12, gap: 6 },
  aiCard: { borderColor: "#bfdbfe", backgroundColor: "#f5f9ff" },
  endorsedCard: { borderColor: colors.primaryMuted, backgroundColor: "#f3faf6" },
  title: { ...design.sectionTitle },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  meta: { ...design.caption },
  body: { ...design.body, marginTop: 4 },
  aiHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  aiTitle: { ...design.cardTitle, flex: 1, fontSize: 14 },
  section: { ...design.sectionTitle, fontSize: 15, marginVertical: 8 },
  replyActions: { flexDirection: "row", gap: 8, marginTop: 6 },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
  },
  smallBtnText: { fontSize: 12.5, fontWeight: "700", color: colors.primary },
  composer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  replyInput: { ...design.input, flex: 1, minHeight: 46, maxHeight: 120, paddingVertical: 11 },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
