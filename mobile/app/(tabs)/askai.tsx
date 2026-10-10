import { design, elevation } from "../../src/theme/design";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useState, useRef, useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { trpc } from "../../src/lib/api";
import { colors, gradients } from "../../src/theme/colors";
import { useAuth } from "../../src/contexts/AuthContext";
import { useChatVoice, VoiceCapture } from "../../src/lib/useChatVoice";
import { oldestFirstById } from "../../src/lib/chatHistory";
import { AssistantMessage } from "../../src/components/AssistantMessage";
import { useLocalSearchParams } from "expo-router";

type Prompt = { text: string; icon: React.ComponentProps<typeof Ionicons>["name"] };

const QUICK_PROMPTS: Prompt[] = [
  { text: "Explain Binary Search algorithm", icon: "search" },
  { text: "Create a timetable for my upcoming exam", icon: "calendar" },
  { text: "Create a quiz on Data Structures", icon: "help-circle" },
  { text: "How does Recursion work?", icon: "git-branch" },
];

const COURSE_PROMPTS: Prompt[] = [
  { text: "Explain this", icon: "bulb" },
  { text: "Simplify this topic", icon: "color-wand" },
  { text: "Give an example", icon: "flask" },
  { text: "Summarize", icon: "list" },
  { text: "Create flashcards", icon: "layers" },
  { text: "Quiz me", icon: "help-circle" },
  { text: "Explain step-by-step", icon: "footsteps" },
];

const PROMPT_TONES = [
  { fg: colors.primary, bg: colors.primaryLight },
  { fg: colors.info, bg: colors.infoSoft },
  { fg: colors.violet, bg: colors.violetSoft },
  { fg: "#d97706", bg: colors.warningSoft },
];

export default function AskAIScreen() {
  const { user } = useAuth();
  const firstName = user?.name?.split(/\s+/)[0] ?? "there";
  const params = useLocalSearchParams<{ courseId?: string; prompt?: string }>();
  const courseId = Number(params.courseId);
  const scopedCourseId =
    Number.isInteger(courseId) && courseId > 0 ? courseId : undefined;
  const [message, setMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const utils = trpc.useUtils();

  const { data: savedHistory, isLoading: historyLoading } =
    trpc.generalChat.history.useQuery(undefined, {
      staleTime: 0,
      enabled: !!user?.id,
    });

  const [localMessages, setLocalMessages] = useState<
    Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      time: string;
    }>
  >([]);

  useEffect(() => {
    setLocalMessages([]);
    setMessage("");
    setIsThinking(false);
  }, [user?.id]);

  useEffect(() => {
    if (!savedHistory) return;
    if (isThinking) return;
    setLocalMessages(
      oldestFirstById(savedHistory).map(m => ({
        id: String(m.id),
        role: m.role,
        content: m.content,
        time: new Date(m.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }))
    );
  }, [savedHistory, isThinking]);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const voice = useChatVoice(heard => {
    setMessage(current => {
      const next = current.trim() ? `${current.trim()} ${heard}` : heard;
      return next.slice(0, 600);
    });
  });

  const sendMsg = trpc.chat.send.useMutation({
    onSuccess: (data: any) => {
      const aiContent =
        data?.aiResponse ??
        data?.response ??
        data?.content ??
        "I couldn't generate a response. Please try again.";

      setLocalMessages(prev => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: "assistant",
          content: aiContent,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
      setIsThinking(false);
      utils.generalChat.history.invalidate();
      scrollToBottom();
    },
    onError: err => {
      setIsThinking(false);
      setLocalMessages(prev => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: "assistant",
          content: `Sorry, I couldn't process that. ${err.message}`,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
      scrollToBottom();
    },
  });

  const clearMutation = trpc.generalChat.clear.useMutation({
    onSuccess: () => {
      setLocalMessages([]);
      utils.generalChat.history.invalidate();
    },
  });

  const handleSend = (text?: string) => {
    const content = (text ?? message).trim();
    if (!content || isThinking) return;
    if (voice.listening) voice.stopListening();
    voice.stopSpeaking();

    setLocalMessages(prev => [
      ...prev,
      {
        id: String(Date.now()),
        role: "user",
        content,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
    setMessage("");
    setIsThinking(true);
    scrollToBottom();
    sendMsg.mutate({
      documentId: 0,
      message: content,
      courseId: scopedCourseId,
    });
  };

  const handleClear = () => {
    Alert.alert("Clear history", "Delete all Ask AI chat history?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => clearMutation.mutate(),
      },
    ]);
  };

  const isEmpty = localMessages.length === 0 && !isThinking;

  const prompts = scopedCourseId ? COURSE_PROMPTS : QUICK_PROMPTS;
  const canSend = !!message.trim() && !isThinking;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.headerIconWrap}
        >
          <Ionicons name="sparkles" size={17} color={colors.white} />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Ask AI</Text>
          <View style={s.headerSubRow}>
            <View style={s.onlineDot} />
            <Text style={s.headerSub} numberOfLines={1}>
              {scopedCourseId ? "Using this course's materials" : "AI Learning Assistant"}
            </Text>
          </View>
        </View>
        <View style={s.headerActions}>
          {voice.speaking ? (
            <TouchableOpacity
              style={[s.iconBtn, s.iconBtnOn]}
              onPress={voice.stopSpeaking}
              hitSlop={8}
              accessibilityLabel="Stop reading aloud"
            >
              <Ionicons name="stop-circle-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
          {localMessages.length > 0 ? (
            <TouchableOpacity
              style={s.iconBtn}
              onPress={handleClear}
              accessibilityLabel="Clear chat history"
            >
              <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <VoiceCapture
        listening={voice.listening}
        usingWebSpeech={voice.usingWebSpeech}
        onMessage={voice.handleWebMessage}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        {historyLoading && isEmpty ? (
          <View style={s.emptyContainer}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : isEmpty ? (
          <ScrollView
            contentContainerStyle={s.emptyScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={s.welcomeBox}>
              <View style={s.orbHalo}>
                <View style={s.orbHaloInner}>
                  <LinearGradient
                    colors={gradients.hero}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.orb}
                  >
                    <Ionicons name="sparkles" size={30} color={colors.white} />
                  </LinearGradient>
                </View>
              </View>
              <Text style={s.hiText}>Hi {firstName}, how can I help?</Text>
              <Text style={s.hiSub}>
                {scopedCourseId
                  ? "I'll use this course's materials when answering."
                  : "Ask me anything about your courses or documents."}
              </Text>
            </View>
            <Text style={s.suggestLabel}>Try asking</Text>
            <View style={s.promptGrid}>
              {prompts.map((p, i) => {
                const tone = PROMPT_TONES[i % PROMPT_TONES.length];
                return (
                  <TouchableOpacity
                    key={p.text}
                    style={s.promptCard}
                    activeOpacity={0.85}
                    onPress={() => handleSend(p.text)}
                  >
                    <View style={[s.promptIcon, { backgroundColor: tone.bg }]}>
                      <Ionicons name={p.icon} size={16} color={tone.fg} />
                    </View>
                    <Text style={s.promptText} numberOfLines={3}>
                      {p.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={s.msgList}
            contentContainerStyle={s.msgContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={scrollToBottom}
          >
            {localMessages.map(item => (
              <View
                key={item.id}
                style={[
                  s.bubbleRow,
                  item.role === "user" ? s.bubbleRowUser : s.bubbleRowAI,
                ]}
              >
                {item.role === "assistant" && (
                  <LinearGradient colors={gradients.hero} style={s.aiAvatar}>
                    <Ionicons name="sparkles" size={12} color={colors.white} />
                  </LinearGradient>
                )}
                <View
                  style={[
                    s.bubble,
                    item.role === "user" ? s.bubbleUser : s.bubbleAI,
                  ]}
                >
                  {item.role === "assistant" ? (
                    <AssistantMessage content={item.content} />
                  ) : (
                    <Text style={[s.bubbleText, s.bubbleTextUser]}>
                      {item.content}
                    </Text>
                  )}
                  <View style={s.bubbleMeta}>
                    <Text
                      style={[
                        s.bubbleTime,
                        item.role === "user" && s.bubbleTimeUser,
                      ]}
                    >
                      {item.time}
                    </Text>
                    {item.role === "assistant" ? (
                      <TouchableOpacity
                        style={s.speakChip}
                        onPress={() => voice.toggleSpeak(item.content, item.id)}
                        hitSlop={8}
                        accessibilityLabel={
                          voice.speakingId === item.id ? "Stop reading aloud" : "Read aloud"
                        }
                      >
                        <Ionicons
                          name={
                            voice.speakingId === item.id
                              ? "stop-circle-outline"
                              : "volume-medium-outline"
                          }
                          size={13}
                          color={colors.primary}
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </View>
            ))}

            {isThinking && (
              <View style={[s.bubbleRow, s.bubbleRowAI]}>
                <LinearGradient colors={gradients.hero} style={s.aiAvatar}>
                  <Ionicons name="sparkles" size={12} color={colors.white} />
                </LinearGradient>
                <View style={[s.bubble, s.bubbleAI, s.thinkingBubble]}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={s.thinkingText}>Thinking…</Text>
                </View>
              </View>
            )}
          </ScrollView>
        )}

        <View style={s.composerWrap}>
          <View style={[s.composer, voice.listening && s.composerListening]}>
            <TextInput
              style={s.input}
              value={message}
              onChangeText={setMessage}
              placeholder={
                voice.listening
                  ? "Recording… tap the mic to stop"
                  : "Ask anything…"
              }
              placeholderTextColor={colors.textLight}
              multiline
              maxLength={600}
              onSubmitEditing={() => handleSend()}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[s.micBtn, voice.listening && s.micBtnActive]}
              onPress={voice.toggleListening}
              disabled={isThinking}
              accessibilityLabel={voice.listening ? "Stop recording" : "Speak your question"}
            >
              <Ionicons
                name={voice.listening ? "mic" : "mic-outline"}
                size={19}
                color={voice.listening ? colors.white : colors.textMuted}
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[s.sendBtn, !canSend && s.sendBtnDisabled]}
            disabled={!canSend}
            onPress={() => handleSend()}
            accessibilityLabel="Send"
          >
            <LinearGradient
              colors={gradients.hero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.sendInner}
            >
              {isThinking ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name="arrow-up" size={20} color={colors.white} />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, ...design.page },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { ...design.cardTitle, fontSize: 17 },
  headerSubRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 1 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  headerSub: { ...design.caption, flexShrink: 1 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: { ...design.iconButton, width: 40, height: 40, borderRadius: 20 },
  iconBtnOn: { backgroundColor: colors.primaryLight, borderColor: colors.primaryLight },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyScroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  welcomeBox: { alignItems: "center", gap: 8, marginBottom: 28 },
  orbHalo: {
    padding: 12,
    borderRadius: 70,
    backgroundColor: "rgba(10,110,82,0.06)",
    marginBottom: 12,
  },
  orbHaloInner: {
    padding: 10,
    borderRadius: 58,
    backgroundColor: "rgba(10,110,82,0.10)",
  },
  orb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  hiText: { ...design.screenTitle, fontSize: 23, lineHeight: 29, textAlign: "center" },
  hiSub: { textAlign: "center", ...design.body, color: colors.textMuted, maxWidth: 290 },
  suggestLabel: { ...design.eyebrow, marginBottom: 10, marginLeft: 2 },
  promptGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  promptCard: {
    ...design.card,
    width: "48.4%",
    flexGrow: 1,
    padding: 14,
    gap: 10,
    minHeight: 104,
  },
  promptIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  promptText: {
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.text,
    fontWeight: "600",
  },
  msgList: { flex: 1 },
  msgContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 4,
  },
  bubbleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    maxWidth: "85%",
  },
  bubbleRowUser: { alignSelf: "flex-end", flexDirection: "row-reverse" },
  bubbleRowAI: { alignSelf: "flex-start", maxWidth: "100%" },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    flexShrink: 0,
  },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 11,
    flexShrink: 1,
  },
  bubbleUser: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  bubbleAI: { borderBottomLeftRadius: 6, ...design.card, borderRadius: 20 },
  bubbleText: { fontSize: 14.5, lineHeight: 21 },
  bubbleTextUser: { color: colors.white },
  bubbleTime: { fontSize: 10.5, color: colors.textLight },
  bubbleMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 6,
  },
  bubbleTimeUser: { textAlign: "right", color: "rgba(255,255,255,0.7)" },
  speakChip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  thinkingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  thinkingText: { fontSize: 13, color: colors.textMuted },
  composerWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: colors.bg,
  },
  composer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    minHeight: 50,
    borderRadius: 25,
    paddingLeft: 18,
    paddingRight: 5,
    paddingVertical: 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.sm,
  },
  composerListening: { borderColor: colors.primary },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 40,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: colors.text,
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt,
  },
  micBtnActive: { backgroundColor: colors.primary },
  sendBtn: { borderRadius: 25, ...elevation.brand },
  sendInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4, shadowOpacity: 0, elevation: 0 },
});
