import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useRef } from "react";
import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";
import { useAuth } from "../../src/contexts/AuthContext";
import { API_URL } from "../../src/lib/api";

type Tab = "chat" | "flashcards" | "quiz";

export default function DocumentDetailScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{
    id: string;
    tab?: string;
  }>();
  const router = useRouter();
  const docId = Number(id);
  const [activeTab, setActiveTab] = useState<Tab>(
    (initialTab as Tab) ?? "chat"
  );

  const { data: doc, isLoading } = trpc.documents.get.useQuery(
    { id: docId },
    { enabled: !Number.isNaN(docId) }
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!doc) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <Text style={{ textAlign: "center", marginTop: 40, color: colors.textMuted }}>
          Document not found.
        </Text>
      </SafeAreaView>
    );
  }

  // Build the full URL for the document
  const docUrl = doc.fileUrl.startsWith("http")
    ? doc.fileUrl
    : `${API_URL}${doc.fileUrl}`;

  const openDocument = async () => {
    try {
      const result = await WebBrowser.openBrowserAsync(docUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
    } catch {
      // Fallback to system browser if WebBrowser fails
      try {
        await Linking.openURL(docUrl);
      } catch {
        Alert.alert("Error", "Could not open the document.");
      }
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.docTitle} numberOfLines={1}>
          {doc.title}
        </Text>
        <TouchableOpacity
          style={styles.viewBtn}
          onPress={openDocument}
          activeOpacity={0.8}
        >
          <Ionicons name="eye-outline" size={16} color={colors.white} />
          <Text style={styles.viewBtnText}>View</Text>
        </TouchableOpacity>
      </View>

      {/* Document info strip */}
      <View style={styles.docInfoStrip}>
        <View style={styles.docInfoLeft}>
          <View style={styles.docIconSmall}>
            <Ionicons
              name={doc.mimeType?.includes("pdf") ? "document-text" : "document"}
              size={16}
              color={colors.primary}
            />
          </View>
          <View>
            <Text style={styles.docFileName} numberOfLines={1}>
              {doc.fileName}
            </Text>
            <Text style={styles.docFileMeta}>
              {(doc.fileSize / 1024).toFixed(0)} KB · {doc.mimeType?.split("/")[1]?.toUpperCase() ?? "FILE"}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.previewBtn}
          onPress={openDocument}
          activeOpacity={0.8}
        >
          <Ionicons name="open-outline" size={14} color={colors.primary} />
          <Text style={styles.previewBtnText}>Open PDF</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {(["chat", "flashcards", "quiz"] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Ionicons
              name={
                t === "chat"
                  ? "chatbubble-ellipses-outline"
                  : t === "flashcards"
                  ? "layers-outline"
                  : "help-circle-outline"
              }
              size={16}
              color={activeTab === t ? colors.white : colors.textMuted}
            />
            <Text
              style={[styles.tabText, activeTab === t && styles.tabTextActive]}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      {activeTab === "chat" && <ChatTab docId={docId} />}
      {activeTab === "flashcards" && <FlashcardsTab docId={docId} />}
      {activeTab === "quiz" && <QuizTab docId={docId} />}
    </SafeAreaView>
  );
}

// ─── Chat Tab ────────────────────────────────────────────────────────────────

function ChatTab({ docId }: { docId: number }) {
  const [message, setMessage] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const utils = trpc.useUtils();

  const { data: history, isLoading } = trpc.chat.history.useQuery({ documentId: docId });

  const sendMsg = trpc.chat.send.useMutation({
    onSuccess: () => {
      utils.chat.history.invalidate({ documentId: docId });
      setMessage("");
    },
    onError: (err) => Alert.alert("Error", err.message),
  });

  // Server returns messages newest-first (it calls .reverse() before returning).
  // FlatList with inverted=true renders index 0 at the bottom,
  // so newest message appears at the bottom, oldest at the top — correct order.
  const messages = history ?? [];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.chatList}
          inverted={messages.length > 0}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === "user" ? styles.bubbleUser : styles.bubbleAI,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  item.role === "user"
                    ? styles.bubbleTextUser
                    : styles.bubbleTextAI,
                ]}
              >
                {item.content}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={[styles.chatEmpty, { transform: [{ scaleY: -1 }] }]}>
              <Ionicons name="chatbubbles-outline" size={40} color={colors.primaryLight} />
              <Text style={styles.chatEmptyText}>Ask anything about this document</Text>
              <Text style={styles.chatEmptyHint}>
                Try: /summary · /flashcards 10 · /quiz 5
              </Text>
            </View>
          }
        />
      )}

      {/* Input row */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.chatInput}
          value={message}
          onChangeText={setMessage}
          placeholder="Ask a question..."
          placeholderTextColor={colors.textLight}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!message.trim() || sendMsg.isPending) && styles.sendBtnDisabled,
          ]}
          disabled={!message.trim() || sendMsg.isPending}
          onPress={() => sendMsg.mutate({ documentId: docId, message: message.trim() })}
        >
          {sendMsg.isPending ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Ionicons name="send" size={18} color={colors.white} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Flashcards Tab ───────────────────────────────────────────────────────────

function FlashcardsTab({ docId }: { docId: number }) {
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const utils = trpc.useUtils();

  const { data: cards, isLoading } = trpc.flashcards.list.useQuery({ documentId: docId });

  const generate = trpc.flashcards.generate.useMutation({
    onSuccess: () => utils.flashcards.list.invalidate({ documentId: docId }),
    onError: (err) => Alert.alert("Error", err.message),
  });

  const markReviewed = trpc.flashcards.markReviewed.useMutation();

  const toggleFlip = (id: number) => {
    setFlipped((prev) => {
      const nowFlipped = !prev[id];
      if (nowFlipped) {
        markReviewed.mutate({ flashcardId: id });
      }
      return { ...prev, [id]: nowFlipped };
    });
  };

  if (isLoading)
    return <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />;

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {!cards || cards.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="layers-outline" size={44} color={colors.primaryLight} />
          <Text style={styles.emptyTitle}>No flashcards yet</Text>
          <Text style={styles.emptyText}>
            Generate AI flashcards from this document.
          </Text>
          <TouchableOpacity
            style={styles.genBtn}
            onPress={() => generate.mutate({ documentId: docId, count: 10 })}
            disabled={generate.isPending}
          >
            {generate.isPending ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.genBtnText}>Generate 10 flashcards</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.flashcardHeader}>
            <Text style={styles.flashcardCount}>{cards.length} cards</Text>
            <TouchableOpacity
              style={styles.genBtnSmall}
              onPress={() => generate.mutate({ documentId: docId, count: 10 })}
              disabled={generate.isPending}
            >
              <Text style={styles.genBtnSmallText}>
                {generate.isPending ? "Generating..." : "+ More"}
              </Text>
            </TouchableOpacity>
          </View>

          {cards.map((card) => (
            <TouchableOpacity
              key={card.id}
              style={[
                styles.flashcard,
                flipped[card.id] && styles.flashcardFlipped,
              ]}
              onPress={() => toggleFlip(card.id)}
              activeOpacity={0.85}
            >
              <Text style={styles.flashcardHint}>
                {flipped[card.id] ? "Answer" : "Question — tap to reveal"}
              </Text>
              <Text style={styles.flashcardText}>
                {flipped[card.id] ? card.answer : card.question}
              </Text>
              {card.reviewCount > 0 && (
                <Text style={styles.flashcardReviewed}>
                  ✓ Reviewed {card.reviewCount}×
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </>
      )}
    </ScrollView>
  );
}

// ─── Quiz Tab ─────────────────────────────────────────────────────────────────

function QuizTab({ docId }: { docId: number }) {
  const { user } = useAuth();
  const [quizId, setQuizId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const utils = trpc.useUtils();

  const { data: quizzes, isLoading } = trpc.quizzes.list.useQuery({ documentId: docId });
  const { data: activeQuiz } = trpc.quizzes.get.useQuery(
    { quizId: quizId! },
    { enabled: quizId !== null }
  );

  const generate = trpc.quizzes.generate.useMutation({
    onSuccess: (quiz) => {
      utils.quizzes.list.invalidate({ documentId: docId });
      setQuizId(quiz.id);
      setAnswers({});
      setSubmitted(false);
    },
    onError: (err) => Alert.alert("Error", err.message),
  });

  const submit = trpc.quizzes.submitQuiz.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (err) => Alert.alert("Error", err.message),
  });

  if (quizId && activeQuiz) {
    const questions = activeQuiz.questions ?? [];
    const correctCount = submitted
      ? questions.filter((q) => answers[q.id] === q.correctAnswer).length
      : 0;
    const score =
      questions.length > 0 ? (correctCount / questions.length) * 100 : 0;

    return (
      <ScrollView contentContainerStyle={styles.tabContent}>
        {submitted ? (
          <View style={styles.scoreCard}>
            <Text style={styles.scoreEmoji}>
              {score >= 70 ? "🎉" : score >= 50 ? "📚" : "💪"}
            </Text>
            <Text style={styles.scoreValue}>{score.toFixed(0)}%</Text>
            <Text style={styles.scoreLabel}>
              {correctCount}/{questions.length} correct
            </Text>
            <TouchableOpacity
              style={styles.genBtn}
              onPress={() => {
                setQuizId(null);
                setAnswers({});
                setSubmitted(false);
              }}
            >
              <Text style={styles.genBtnText}>Back to quizzes</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.quizTitle}>{activeQuiz.title}</Text>
            {questions.map((q, idx) => (
              <View key={q.id} style={styles.questionCard}>
                <Text style={styles.questionNumber}>Q{idx + 1}</Text>
                <Text style={styles.questionText}>{q.question}</Text>
                {(q.options as string[]).map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.option,
                      answers[q.id] === opt && styles.optionSelected,
                    ]}
                    onPress={() =>
                      setAnswers((prev) => ({ ...prev, [q.id]: opt }))
                    }
                  >
                    <View
                      style={[
                        styles.optionDot,
                        answers[q.id] === opt && styles.optionDotSelected,
                      ]}
                    />
                    <Text
                      style={[
                        styles.optionText,
                        answers[q.id] === opt && styles.optionTextSelected,
                      ]}
                    >
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            <TouchableOpacity
              style={[
                styles.genBtn,
                Object.keys(answers).length < questions.length &&
                  styles.genBtnDisabled,
              ]}
              disabled={
                Object.keys(answers).length < questions.length ||
                submit.isPending
              }
              onPress={() => {
                const correct = questions.filter(
                  (q) => answers[q.id] === q.correctAnswer
                ).length;
                const s = (correct / questions.length) * 100;
                submit.mutate({ quizId: quizId!, score: s });
              }}
            >
              {submit.isPending ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.genBtnText}>Submit quiz</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    );
  }

  if (isLoading)
    return <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />;

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <TouchableOpacity
        style={[styles.genBtn, generate.isPending && styles.genBtnDisabled]}
        onPress={() =>
          generate.mutate({ documentId: docId, questionCount: 5 })
        }
        disabled={generate.isPending}
      >
        {generate.isPending ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <Text style={styles.genBtnText}>Generate new quiz (5 questions)</Text>
        )}
      </TouchableOpacity>

      {quizzes && quizzes.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Previous quizzes</Text>
          {quizzes.map((q) => (
            <TouchableOpacity
              key={q.id}
              style={styles.quizItem}
              onPress={() => {
                setQuizId(q.id);
                setAnswers({});
                setSubmitted(false);
              }}
            >
              <View>
                <Text style={styles.quizItemTitle}>{q.title}</Text>
                <Text style={styles.quizItemMeta}>
                  {q.totalQuestions} questions ·{" "}
                  {q.score !== null ? `Score: ${Number(q.score).toFixed(0)}%` : "Not attempted"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
            </TouchableOpacity>
          ))}
        </>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  docTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  viewBtnText: { fontSize: 13, fontWeight: "700", color: colors.white },
  // Document info strip
  docInfoStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.primaryLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  docInfoLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  docIconSmall: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  docFileName: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
    maxWidth: 180,
  },
  docFileMeta: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.surface,
  },
  previewBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 12,
    paddingVertical: 8,
    backgroundColor: "#f1f5f9",
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  tabTextActive: { color: colors.white },
  // Chat
  chatList: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  chatEmpty: { alignItems: "center", marginTop: 60, gap: 8 },
  chatEmptyText: { fontSize: 15, fontWeight: "600", color: colors.text },
  chatEmptyHint: { fontSize: 12, color: colors.textMuted },
  bubble: {
    maxWidth: "80%",
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
  },
  bubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: colors.white },
  bubbleTextAI: { color: colors.text },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: "#f8fafc",
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
  // Shared tab
  tabContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  emptyBox: { alignItems: "center", marginTop: 24, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 260,
  },
  genBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  genBtnDisabled: { opacity: 0.5 },
  genBtnText: { color: colors.white, fontWeight: "700", fontSize: 15 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 12 },
  // Flashcards
  flashcardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  flashcardCount: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
  genBtnSmall: {
    backgroundColor: colors.primary + "20",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  genBtnSmallText: { fontSize: 13, fontWeight: "700", color: colors.primary },
  flashcard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: colors.border,
    minHeight: 100,
  },
  flashcardFlipped: { borderColor: colors.primary, backgroundColor: colors.primary + "08" },
  flashcardHint: { fontSize: 11, fontWeight: "600", color: colors.textMuted, marginBottom: 8 },
  flashcardText: { fontSize: 15, color: colors.text, lineHeight: 22 },
  flashcardReviewed: { fontSize: 12, color: colors.primary, marginTop: 10, fontWeight: "600" },
  // Quiz
  quizTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 16 },
  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  questionNumber: { fontSize: 12, fontWeight: "700", color: colors.primary, marginBottom: 6 },
  questionText: { fontSize: 15, fontWeight: "600", color: colors.text, marginBottom: 14 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primary + "10" },
  optionDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
  },
  optionDotSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  optionText: { fontSize: 14, color: colors.text, flex: 1 },
  optionTextSelected: { color: colors.primary, fontWeight: "600" },
  scoreCard: { alignItems: "center", marginTop: 32, gap: 8 },
  scoreEmoji: { fontSize: 52 },
  scoreValue: { fontSize: 52, fontWeight: "800", color: colors.primary },
  scoreLabel: { fontSize: 16, color: colors.textMuted },
  quizItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  quizItemTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  quizItemMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
