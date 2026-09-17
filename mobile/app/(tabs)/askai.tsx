import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { useState, useRef, useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";
import { useAuth } from "../../src/contexts/AuthContext";
import { useChatVoice, VoiceCapture } from "../../src/lib/useChatVoice";
import { oldestFirstById } from "../../src/lib/chatHistory";

const QUICK_PROMPTS = [
  "Explain Binary Search algorithm",
  "Create a timetable for my upcoming exam",
  "Create a quiz on Data Structures",
  "How does Recursion work?",
];

export default function AskAIScreen() {
  const { user } = useAuth();
  const firstName = user?.name?.split(/\s+/)[0] ?? "there";
  const [message, setMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const utils = trpc.useUtils();

  // ── Load persistent history from server ──────────────────────────────────
  const { data: savedHistory, isLoading: historyLoading } =
    trpc.generalChat.history.useQuery(undefined, {
      staleTime: 0,
    });

  // Local messages buffer — start from server history, then append new messages
  const [localMessages, setLocalMessages] = useState<
    Array<{ id: string; role: "user" | "assistant"; content: string; time: string }>
  >([]);

  // Always hydrate from the server in insertion order (oldest at top).
  useEffect(() => {
    if (!savedHistory) return;
    if (isThinking) return;
    setLocalMessages(
      oldestFirstById(savedHistory).map((m) => ({
        id: String(m.id),
        role: m.role,
        content: m.content,
        time: new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }))
    );
  }, [savedHistory, isThinking]);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const voice = useChatVoice((heard) => {
    setMessage((current) => {
      const next = current.trim() ? `${current.trim()} ${heard}` : heard;
      return next.slice(0, 600);
    });
  });

  const sendMsg = trpc.chat.send.useMutation({
    onSuccess: (data: any) => {
      const aiContent =
        data?.aiResponse ?? data?.response ?? data?.content ??
        "I couldn't generate a response. Please try again.";

      setLocalMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: "assistant",
          content: aiContent,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setIsThinking(false);
      voice.speak(aiContent);
      // Invalidate so history is refreshed from server
      utils.generalChat.history.invalidate();
      scrollToBottom();
    },
    onError: (err) => {
      setIsThinking(false);
      setLocalMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: "assistant",
          content: `Sorry, I couldn't process that. ${err.message}`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
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

    setLocalMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        role: "user",
        content,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setMessage("");
    setIsThinking(true);
    scrollToBottom();
    sendMsg.mutate({ documentId: 0, message: content });
  };

  const handleClear = () => {
    Alert.alert("Clear history", "Delete all Ask AI chat history?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => clearMutation.mutate() },
    ]);
  };

  const isEmpty = localMessages.length === 0 && !isThinking;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.menuBtn}>
          <Ionicons name="menu" size={22} color={colors.textSub} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <View style={s.headerIconWrap}>
            <Ionicons name="sparkles" size={14} color={colors.white} />
          </View>
          <View>
            <Text style={s.headerTitle}>Ask AI</Text>
            <Text style={s.headerSub}>Cognify Assistant</Text>
          </View>
        </View>
        <View style={s.headerActions}>
          <TouchableOpacity style={s.iconBtn} onPress={voice.toggleMute} hitSlop={8}>
            <Ionicons
              name={voice.muted ? "volume-mute-outline" : voice.speaking ? "volume-high" : "volume-medium-outline"}
              size={18}
              color={voice.muted ? colors.textMuted : colors.primary}
            />
          </TouchableOpacity>
          {localMessages.length > 0 ? (
            <TouchableOpacity style={s.iconBtn} onPress={handleClear}>
              <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <VoiceCapture listening={voice.listening} usingWebSpeech={voice.usingWebSpeech} onMessage={voice.handleWebMessage} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        {/* Loading history */}
        {historyLoading && isEmpty ? (
          <View style={s.emptyContainer}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : isEmpty ? (
          // Welcome / empty state
          <View style={s.emptyContainer}>
            <View style={s.welcomeBox}>
              <View style={s.aiBubbleIcon}>
                <Ionicons name="sparkles" size={32} color={colors.white} />
              </View>
              <Text style={s.hiText}>Hi {firstName}! 👋</Text>
              <Text style={s.hiSub}>
                Ask me anything about your{"\n"}courses or documents.
              </Text>
            </View>
            <View style={s.promptGrid}>
              {QUICK_PROMPTS.map((p, i) => (
                <TouchableOpacity key={i} style={s.promptChip} onPress={() => handleSend(p)}>
                  <Text style={s.promptText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          // Chat messages
          <ScrollView
            ref={scrollRef}
            style={s.msgList}
            contentContainerStyle={s.msgContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={scrollToBottom}
          >
            {localMessages.map((item) => (
              <View
                key={item.id}
                style={[s.bubbleRow, item.role === "user" ? s.bubbleRowUser : s.bubbleRowAI]}
              >
                {item.role === "assistant" && (
                  <View style={s.aiAvatar}>
                    <Ionicons name="sparkles" size={12} color={colors.white} />
                  </View>
                )}
                <View style={[s.bubble, item.role === "user" ? s.bubbleUser : s.bubbleAI]}>
                  <Text style={[s.bubbleText, item.role === "user" ? s.bubbleTextUser : s.bubbleTextAI]}>
                    {item.content}
                  </Text>
                  <View style={s.bubbleMeta}>
                    <Text style={[s.bubbleTime, item.role === "user" && s.bubbleTimeUser]}>
                      {item.time}
                    </Text>
                    {item.role === "assistant" ? (
                      <TouchableOpacity onPress={() => voice.speak(item.content)} hitSlop={8}>
                        <Ionicons name="volume-medium-outline" size={14} color={colors.primary} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </View>
            ))}

            {/* Typing indicator */}
            {isThinking && (
              <View style={[s.bubbleRow, s.bubbleRowAI]}>
                <View style={s.aiAvatar}>
                  <Ionicons name="sparkles" size={12} color={colors.white} />
                </View>
                <View style={[s.bubble, s.bubbleAI, s.thinkingBubble]}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={s.thinkingText}>Thinking…</Text>
                </View>
              </View>
            )}
          </ScrollView>
        )}

        {/* Input bar */}
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={message}
            onChangeText={setMessage}
            placeholder={voice.listening ? "Recording… tap the mic to stop" : "Type or tap the mic…"}
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
          >
            <Ionicons name={voice.listening ? "mic" : "mic-outline"} size={20} color={voice.listening ? colors.white : colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.sendBtn, (!message.trim() || isThinking) && s.sendBtnDisabled]}
            disabled={!message.trim() || isThinking}
            onPress={() => handleSend()}
          >
            {isThinking
              ? <ActivityIndicator size="small" color={colors.white} />
              : <Ionicons name="send" size={18} color={colors.white} />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5f6fa" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  menuBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIconWrap: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  headerSub: { fontSize: 11, color: colors.textMuted },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 36, justifyContent: "flex-end" },
  iconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 36 },
  welcomeBox: { alignItems: "center", gap: 12 },
  aiBubbleIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: 8, shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  hiText: { fontSize: 26, fontWeight: "800", color: colors.text },
  hiSub: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 22 },
  promptGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  promptChip: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, maxWidth: 165 },
  promptText: { fontSize: 13, color: colors.textSub, fontWeight: "500", textAlign: "center" },
  msgList: { flex: 1 },
  msgContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, gap: 4 },
  bubbleRow: { flexDirection: "row", gap: 8, marginBottom: 10, maxWidth: "85%" },
  bubbleRowUser: { alignSelf: "flex-end", flexDirection: "row-reverse" },
  bubbleRowAI: { alignSelf: "flex-start" },
  aiAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: 4, flexShrink: 0 },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, flexShrink: 1 },
  bubbleUser: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleAI: { backgroundColor: colors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  bubbleText: { fontSize: 14, lineHeight: 21 },
  bubbleTextUser: { color: colors.white },
  bubbleTextAI: { color: colors.text },
  bubbleTime: { fontSize: 10, color: colors.textLight },
  bubbleMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 },
  bubbleTimeUser: { textAlign: "right", color: "rgba(255,255,255,0.65)" },
  thinkingBubble: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 },
  thinkingText: { fontSize: 13, color: colors.textMuted },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  input: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: colors.text, backgroundColor: "#f8fafc", maxHeight: 100 },
  micBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  micBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sendBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { opacity: 0.4 },
});
