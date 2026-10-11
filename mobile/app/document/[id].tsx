import { design, elevation } from "../../src/theme/design";
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
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useRef, useEffect } from "react";
import { Linking } from "react-native";
import { trpc } from "../../src/lib/api";
import { colors, gradients } from "../../src/theme/colors";
import { LinearGradient } from "expo-linear-gradient";
import { API_URL } from "../../src/lib/api";
import { useChatVoice, VoiceCapture } from "../../src/lib/useChatVoice";
import { FlippingFlashcard } from "../../src/components/FlippingFlashcard";
import { oldestFirstById } from "../../src/lib/chatHistory";
import { AssistantMessage } from "../../src/components/AssistantMessage";
import { AudioRecapCard } from "../../src/components/study/AudioRecapCard";
import { PracticeMistakes } from "../../src/components/study/PracticeMistakes";

type Tab = "chat" | "flashcards" | "quiz" | "recap";

export default function DocumentDetailScreen() {
  const {
    id,
    tab: initialTab,
    quizId: initialQuizId,
  } = useLocalSearchParams<{
    id: string;
    tab?: string;
    quizId?: string;
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
  const recordActivity = trpc.studentLearning.recordActivity.useMutation();
  useEffect(() => {
    if (!doc?.id) return;
    recordActivity.mutate({
      type: "DOCUMENT_OPENED",
      documentId: doc.id,
      courseId: doc.courseId ?? undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id]);

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
        <Text
          style={{
            textAlign: "center",
            marginTop: 40,
            color: colors.textMuted,
          }}
        >
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
      const canOpen = await Linking.canOpenURL(docUrl);
      if (canOpen) {
        await Linking.openURL(docUrl);
      } else {
        Alert.alert("Cannot open", "No app available to open this document.");
      }
    } catch {
      Alert.alert("Error", "Could not open the document.");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={21} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.docIconSmall}>
          <Ionicons
            name={doc.mimeType?.includes("pdf") ? "document-text" : "document"}
            size={18}
            color={colors.primary}
          />
        </View>
        <View style={styles.docInfoLeft}>
          <Text style={styles.docTitle} numberOfLines={1}>
            {doc.title}
          </Text>
          <Text style={styles.docFileMeta} numberOfLines={1}>
            {(doc.fileSize / 1024).toFixed(0)} KB ·{" "}
            {doc.mimeType?.split("/")[1]?.toUpperCase() ?? "FILE"} ·{" "}
            {doc.fileName}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.viewBtn}
          onPress={openDocument}
          activeOpacity={0.85}
          accessibilityLabel="Open document"
        >
          <Ionicons name="open-outline" size={15} color={colors.white} />
          <Text style={styles.viewBtnText}>Open</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <View style={styles.tabTrack}>
          {(["chat", "flashcards", "quiz", "recap"] as Tab[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, activeTab === t && styles.tabActive]}
              onPress={() => setActiveTab(t)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={
                  t === "chat"
                    ? "chatbubble-ellipses"
                    : t === "flashcards"
                      ? "layers"
                      : t === "quiz"
                        ? "help-circle"
                        : "headset"
                }
                size={15}
                color={activeTab === t ? colors.primary : colors.textMuted}
              />
              <Text
                style={[styles.tabText, activeTab === t && styles.tabTextActive]}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tab content */}
      {activeTab === "chat" && <ChatTab docId={docId} />}
      {activeTab === "flashcards" && <FlashcardsTab docId={docId} />}
      {activeTab === "quiz" && (
        <QuizTab
          docId={docId}
          initialQuizId={initialQuizId ? Number(initialQuizId) : undefined}
        />
      )}
      {activeTab === "recap" && <RecapTab docId={docId} />}
    </SafeAreaView>
  );
}

function RecapTab({ docId }: { docId: number }) {
  const { data: summary } = trpc.summary.get.useQuery({ documentId: docId });
  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <AudioRecapCard documentId={docId} />
      {summary ? (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Summary</Text>
          <AssistantMessage content={summary.summary} />
        </View>
      ) : null}
    </ScrollView>
  );
}

// ─── Chat Tab ────────────────────────────────────────────────────────────────

function ChatTab({ docId }: { docId: number }) {
  const [message, setMessage] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const utils = trpc.useUtils();
  const voice = useChatVoice(heard => {
    setMessage(current => {
      const next = current.trim() ? `${current.trim()} ${heard}` : heard;
      return next.slice(0, 500);
    });
  });

  const { data: history, isLoading } = trpc.chat.history.useQuery({
    documentId: docId,
  });

  const sendMsg = trpc.chat.send.useMutation({
    onSuccess: (data: any) => {
      utils.chat.history.invalidate({ documentId: docId });
      setMessage("");
      scrollToBottom();
    },
    onError: err => Alert.alert("Error", err.message),
  });

  const messages = oldestFirstById(history);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  return (
    <>
      <VoiceCapture
        listening={voice.listening}
        usingWebSpeech={voice.usingWebSpeech}
        onMessage={voice.handleWebMessage}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : (
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={styles.chatList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={scrollToBottom}
          >
            {messages.length === 0 ? (
              <View style={styles.chatEmpty}>
                <View style={styles.chatEmptyHalo}>
                  <LinearGradient
                    colors={gradients.hero}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.chatEmptyOrb}
                  >
                    <Ionicons name="sparkles" size={26} color={colors.white} />
                  </LinearGradient>
                </View>
                <Text style={styles.chatEmptyText}>
                  Ask anything about this document
                </Text>
                <View style={styles.hintRow}>
                  {["/summary", "/flashcards 10", "/quiz 5"].map(cmd => (
                    <TouchableOpacity
                      key={cmd}
                      style={styles.hintChip}
                      onPress={() => setMessage(cmd)}
                    >
                      <Text style={styles.hintChipText}>{cmd}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              messages.map(item => (
                <View
                  key={String(item.id)}
                  style={[
                    styles.bubble,
                    item.role === "user" ? styles.bubbleUser : styles.bubbleAI,
                  ]}
                >
                  {item.role === "assistant" ? (
                    <AssistantMessage content={item.content} />
                  ) : (
                    <Text style={[styles.bubbleText, styles.bubbleTextUser]}>
                      {item.content}
                    </Text>
                  )}
                  {item.role === "assistant" ? (
                    <TouchableOpacity
                      onPress={() => voice.toggleSpeak(item.content, String(item.id))}
                      hitSlop={8}
                      style={styles.speakBtn}
                      accessibilityLabel={
                        voice.speakingId === String(item.id) ? "Stop reading aloud" : "Read aloud"
                      }
                    >
                      <Ionicons
                        name={
                          voice.speakingId === String(item.id)
                            ? "stop-circle-outline"
                            : "volume-medium-outline"
                        }
                        size={14}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))
            )}

            {/* Typing indicator — shown as the last item while waiting */}
            {sendMsg.isPending && (
              <View
                style={[styles.bubble, styles.bubbleAI, styles.typingIndicator]}
              >
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.typingText}>Thinking…</Text>
              </View>
            )}
          </ScrollView>
        )}

        <View style={styles.inputRow}>
          <View style={styles.composer}>
            <TextInput
              style={styles.chatInput}
              value={message}
              onChangeText={setMessage}
              placeholder={
                voice.listening ? "Listening…" : "Ask about this document…"
              }
              placeholderTextColor={colors.textPlaceholder}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.micBtn, voice.listening && styles.micBtnActive]}
              onPress={voice.toggleListening}
              disabled={sendMsg.isPending}
              accessibilityLabel="Voice input"
            >
              <Ionicons
                name={voice.listening ? "mic" : "mic-outline"}
                size={19}
                color={voice.listening ? colors.white : colors.textMuted}
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[
              styles.sendWrap,
              (!message.trim() || sendMsg.isPending) && styles.sendBtnDisabled,
            ]}
            disabled={!message.trim() || sendMsg.isPending}
            onPress={() => {
              if (voice.listening) voice.stopListening();
              voice.stopSpeaking();
              sendMsg.mutate({ documentId: docId, message: message.trim() });
            }}
            accessibilityLabel="Send"
          >
            <LinearGradient
              colors={gradients.hero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sendBtn}
            >
              {sendMsg.isPending ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Ionicons name="arrow-up" size={20} color={colors.white} />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

// ─── Flashcards Tab ───────────────────────────────────────────────────────────

function FlashcardsTab({ docId }: { docId: number }) {
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const utils = trpc.useUtils();

  const { data: cards, isLoading } = trpc.flashcards.list.useQuery({
    documentId: docId,
  });

  const generate = trpc.flashcards.generate.useMutation({
    onSuccess: () => utils.flashcards.list.invalidate({ documentId: docId }),
    onError: err => Alert.alert("Error", err.message),
  });

  const markReviewed = trpc.flashcards.markReviewed.useMutation();

  if (isLoading)
    return (
      <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
    );

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {!cards || cards.length === 0 ? (
        <View style={styles.emptyBox}>
          <View style={styles.emptyIcon}>
            <Ionicons name="layers" size={28} color={colors.primary} />
          </View>
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
            <View>
              <Text style={styles.sectionEyebrow}>Deck</Text>
              <Text style={styles.flashcardCount}>{cards.length} cards</Text>
            </View>
            <TouchableOpacity
              style={styles.genBtnSmall}
              onPress={() => generate.mutate({ documentId: docId, count: 10 })}
              disabled={generate.isPending}
            >
              {generate.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="add" size={16} color={colors.primary} />
              )}
              <Text style={styles.genBtnSmallText}>
                {generate.isPending ? "Generating…" : "More cards"}
              </Text>
            </TouchableOpacity>
          </View>

          {cards.map(card => (
            <FlippingFlashcard
              key={card.id}
              question={card.question}
              answer={card.answer}
              flipped={Boolean(flipped[card.id])}
              onFlip={showingAnswer => {
                setFlipped(prev => {
                  if (showingAnswer && !prev[card.id]) {
                    markReviewed.mutate({ flashcardId: card.id });
                  }
                  return { ...prev, [card.id]: showingAnswer };
                });
              }}
              footer={
                card.reviewCount > 0
                  ? `Reviewed ${card.reviewCount}×`
                  : undefined
              }
            />
          ))}
        </>
      )}
    </ScrollView>
  );
}

// ─── Quiz Tab ─────────────────────────────────────────────────────────────────

function QuizTab({
  docId,
  initialQuizId,
}: {
  docId: number;
  initialQuizId?: number;
}) {
  const [quizId, setQuizId] = useState<number | null>(initialQuizId ?? null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const utils = trpc.useUtils();

  const { data: quizzes, isLoading } = trpc.quizzes.list.useQuery({
    documentId: docId,
  });
  const { data: activeQuiz } = trpc.quizzes.get.useQuery(
    { quizId: quizId! },
    { enabled: quizId !== null }
  );

  const generate = trpc.quizzes.generate.useMutation({
    onSuccess: quiz => {
      utils.quizzes.list.invalidate({ documentId: docId });
      setQuizId(quiz.id);
      setAnswers({});
      setSubmitted(false);
    },
    onError: err => Alert.alert("Error", err.message),
  });

  const submit = trpc.quizzes.submitQuiz.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: err => Alert.alert("Error", err.message),
  });

  const handleSubmit = () => {
    if (!quizId || !activeQuiz) return;
    const questions = activeQuiz.questions ?? [];
    const correct = questions.filter(
      q => answers[q.id] === q.correctAnswer
    ).length;
    const s = (correct / questions.length) * 100;
    // Convert Record<number,string> → Record<string,string> for the server
    const answersForServer: Record<string, string> = {};
    Object.entries(answers).forEach(([qId, ans]) => {
      answersForServer[String(qId)] = ans;
    });
    submit.mutate({ quizId, score: s, answers: answersForServer });
  };

  if (quizId && activeQuiz) {
    const questions = activeQuiz.questions ?? [];
    const correctCount = submitted
      ? questions.filter(q => answers[q.id] === q.correctAnswer).length
      : 0;
    const score =
      questions.length > 0 ? (correctCount / questions.length) * 100 : 0;

    return (
      <ScrollView contentContainerStyle={styles.tabContent}>
        {submitted ? (
          <>
            {/* Score summary */}
            <LinearGradient
              colors={gradients.hero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.scoreCard}
            >
              <View style={styles.scoreRing} />
              <View style={styles.scoreIcon}>
                <Ionicons
                  name={
                    score >= 70 ? "trophy" : score >= 50 ? "book" : "barbell"
                  }
                  size={24}
                  color="#fbbf24"
                />
              </View>
              <Text style={styles.scoreValue}>{score.toFixed(0)}%</Text>
              <Text style={styles.scoreLabel}>
                {correctCount}/{questions.length} correct ·{" "}
                {score >= 70
                  ? "Great work"
                  : score >= 50
                    ? "Nearly there"
                    : "Keep practising"}
              </Text>
              <View style={styles.scoreBar}>
                <View
                  style={[styles.scoreBarFill, { width: `${score}%` as any }]}
                />
              </View>
            </LinearGradient>

            {/* Per-question breakdown */}
            <Text style={styles.reviewTitle}>Answer Review</Text>
            {questions.map((q, idx) => {
              const userAns = answers[q.id];
              const isCorrect = userAns === q.correctAnswer;
              return (
                <View
                  key={q.id}
                  style={[
                    styles.reviewCard,
                    isCorrect ? styles.reviewCorrect : styles.reviewWrong,
                  ]}
                >
                  <View style={styles.reviewHeader}>
                    <View style={styles.qChip}>
                      <Text style={styles.qChipText}>Q{idx + 1}</Text>
                    </View>
                    <View
                      style={[
                        styles.resultBadge,
                        isCorrect
                          ? styles.resultBadgeCorrect
                          : styles.resultBadgeWrong,
                      ]}
                    >
                      <Ionicons
                        name={isCorrect ? "checkmark-circle" : "close-circle"}
                        size={13}
                        color={isCorrect ? colors.success : colors.error}
                      />
                      <Text
                        style={[
                          styles.resultBadgeText,
                          isCorrect
                            ? styles.resultBadgeTextCorrect
                            : styles.resultBadgeTextWrong,
                        ]}
                      >
                        {isCorrect ? "Correct" : "Wrong"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.questionText}>{q.question}</Text>

                  {/* Your answer */}
                  {!isCorrect && (
                    <View style={styles.answerRow}>
                      <Text style={styles.answerLabel}>Your answer: </Text>
                      <Text style={styles.answerWrong}>
                        {userAns ?? "Not answered"}
                      </Text>
                    </View>
                  )}

                  {/* Correct answer */}
                  <View style={styles.answerRow}>
                    <Text style={styles.answerLabel}>Correct answer: </Text>
                    <Text style={styles.answerCorrect}>{q.correctAnswer}</Text>
                  </View>

                  {/* Explanation if available */}
                  {q.explanation ? (
                    <View style={styles.explanationBox}>
                      <View style={styles.explanationHead}>
                        <Ionicons name="bulb" size={13} color="#b45309" />
                        <Text style={styles.explanationLabel}>Explanation</Text>
                      </View>
                      <Text style={styles.explanationText}>
                        {q.explanation}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}

            <PracticeMistakes
              source={{
                kind: "quiz",
                quizId,
                answers: Object.fromEntries(Object.entries(answers).map(([k, v]) => [String(k), v])),
              }}
              mistakes={questions.length - correctCount}
            />

            <TouchableOpacity
              style={[styles.genBtn, { marginTop: 8 }]}
              onPress={() => {
                setQuizId(null);
                setAnswers({});
                setSubmitted(false);
              }}
            >
              <Text style={styles.genBtnText}>Back to quizzes</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.quizTitle}>{activeQuiz.title}</Text>
            <Text style={styles.quizMeta}>
              {questions.length} questions · {Object.keys(answers).length}/
              {questions.length} answered
            </Text>
            <View style={styles.quizProgress}>
              <View
                style={[
                  styles.quizProgressFill,
                  {
                    width: `${
                      questions.length
                        ? (Object.keys(answers).length / questions.length) * 100
                        : 0
                    }%` as any,
                  },
                ]}
              />
            </View>

            {questions.map((q, idx) => (
              <View key={q.id} style={styles.questionCard}>
                <View style={[styles.qChip, { marginBottom: 10 }]}>
                  <Text style={styles.qChipText}>Question {idx + 1}</Text>
                </View>
                <Text style={styles.questionText}>{q.question}</Text>
                {(Array.isArray(q.options) ? q.options : []).map(
                  (opt, optIdx) => (
                    <TouchableOpacity
                      key={`${q.id}-${optIdx}`}
                      style={[
                        styles.option,
                        answers[q.id] === opt && styles.optionSelected,
                      ]}
                      onPress={() =>
                        setAnswers(prev => ({ ...prev, [q.id]: opt }))
                      }
                    >
                      <View
                        style={[
                          styles.optionDot,
                          answers[q.id] === opt && styles.optionDotSelected,
                        ]}
                      >
                        {answers[q.id] === opt && (
                          <Ionicons name="checkmark" size={12} color={colors.white} />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.optionText,
                          answers[q.id] === opt && styles.optionTextSelected,
                        ]}
                      >
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
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
              onPress={handleSubmit}
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
    return (
      <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
    );

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <View style={styles.genCard}>
        <View style={styles.genCardIcon}>
          <Ionicons name="sparkles" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.genCardTitle}>Test your understanding</Text>
          <Text style={styles.genCardBody}>
            Generate a 5-question quiz from this document.
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.genBtn, generate.isPending && styles.genBtnDisabled]}
        onPress={() => generate.mutate({ documentId: docId, questionCount: 5 })}
        disabled={generate.isPending}
      >
        {generate.isPending ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <View style={styles.genBtnRow}>
            <Ionicons name="flash" size={16} color={colors.white} />
            <Text style={styles.genBtnText}>Generate new quiz</Text>
          </View>
        )}
      </TouchableOpacity>

      {quizzes && quizzes.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 26 }]}>
            Previous quizzes
          </Text>
          {quizzes.map(q => {
            const attempted = q.score !== null;
            const pct = attempted ? Number(q.score) : 0;
            const tone = !attempted
              ? colors.textMuted
              : pct >= 70
                ? colors.primary
                : "#d97706";
            return (
              <TouchableOpacity
                key={q.id}
                style={styles.quizItem}
                onPress={() => {
                  setQuizId(q.id);
                  setAnswers({});
                  setSubmitted(false);
                }}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.quizItemIcon,
                    {
                      backgroundColor: !attempted
                        ? colors.surfaceAlt
                        : pct >= 70
                          ? colors.primaryLight
                          : colors.warningSoft,
                    },
                  ]}
                >
                  <Ionicons name="help-circle" size={20} color={tone} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.quizItemTitle} numberOfLines={1}>
                    {q.title}
                  </Text>
                  <Text style={styles.quizItemMeta}>
                    {q.totalQuestions} questions
                  </Text>
                </View>
                <Text style={[styles.quizItemScore, { color: tone }]}>
                  {attempted ? `${pct.toFixed(0)}%` : "New"}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textLight}
                />
              </TouchableOpacity>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, ...design.page },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  backBtn: { ...design.iconButton, borderRadius: 22 },
  docTitle: { ...design.cardTitle, fontSize: 16.5 },
  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  viewBtnText: { fontSize: 13, fontWeight: "700", color: colors.white },
  docInfoLeft: { flex: 1, minWidth: 0 },
  docIconSmall: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  docFileMeta: { marginTop: 2, ...design.caption, fontSize: 11.5 },
  tabBar: { paddingHorizontal: 16, paddingBottom: 10 },
  tabTrack: {
    flexDirection: "row",
    backgroundColor: "#e9efec",
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    paddingVertical: 9,
  },
  tabActive: { backgroundColor: colors.white, ...elevation.sm },
  tabText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  tabTextActive: { color: colors.primary, fontWeight: "800" },
  chatList: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  chatEmpty: { alignItems: "center", marginTop: 56, gap: 12 },
  chatEmptyHalo: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  chatEmptyOrb: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  chatEmptyText: { ...design.sectionTitle, fontSize: 17, textAlign: "center" },
  hintRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  hintChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hintChipText: { fontSize: 12.5, fontWeight: "700", color: colors.primary },
  bubble: {
    maxWidth: "80%",
    borderRadius: 20,
    padding: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  bubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
    borderBottomRightRadius: 6,
  },
  bubbleAI: {
    maxWidth: "96%",
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...elevation.sm,
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: colors.white },
  typingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  typingText: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  composer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: colors.white,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: 16,
    paddingRight: 5,
    paddingVertical: 5,
    minHeight: 52,
  },
  chatInput: {
    flex: 1,
    maxHeight: 100,
    fontSize: 14.5,
    color: colors.text,
    paddingVertical: 9,
  },
  sendWrap: { borderRadius: 26, ...elevation.brand },
  sendBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.45 },
  speakBtn: {
    marginTop: 8,
    alignSelf: "flex-start",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  micBtnActive: { backgroundColor: colors.primary },
  tabContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  summaryCard: { ...design.card, padding: 16, gap: 6 },
  summaryTitle: { ...design.cardTitle, fontSize: 16 },
  emptyBox: {
    alignItems: "center",
    marginTop: 16,
    gap: 10,
    padding: 24,
    ...design.card,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { ...design.sectionTitle, fontSize: 17 },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 260,
  },
  genBtn: {
    paddingVertical: 15,
    marginTop: 14,
    alignSelf: "stretch",
    ...design.action,
  },
  genBtnRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  genBtnDisabled: { opacity: 0.5 },
  genBtnText: { color: colors.white, fontWeight: "700", fontSize: 15 },
  genCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    ...design.card,
  },
  genCardIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  genCardTitle: { ...design.cardTitle },
  genCardBody: { ...design.caption, marginTop: 2 },
  sectionTitle: { marginBottom: 12, ...design.sectionTitle },
  sectionEyebrow: { ...design.eyebrow, color: colors.primary },
  flashcardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  flashcardCount: { ...design.sectionTitle, marginTop: 2 },
  genBtnSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primaryLight,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  genBtnSmallText: { fontSize: 13, fontWeight: "700", color: colors.primary },
  quizTitle: { ...design.sectionTitle, fontSize: 19, marginBottom: 14 },
  quizProgress: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderLight,
    overflow: "hidden",
    marginBottom: 18,
  },
  quizProgressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  qChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
  },
  qChipText: { fontSize: 11.5, fontWeight: "800", color: colors.primary },
  questionCard: { padding: 18, marginBottom: 14, ...design.card },
  questionNumber: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: 6,
  },
  questionText: { marginBottom: 14, ...design.cardTitle },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 13,
    marginBottom: 8,
    ...design.chip,
    borderRadius: 14,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  optionDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  optionDotSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  optionText: { fontSize: 14, color: colors.text, flex: 1, lineHeight: 20 },
  optionTextSelected: { color: colors.primaryDark, fontWeight: "700" },
  scoreCard: {
    alignItems: "center",
    marginTop: 4,
    marginBottom: 8,
    gap: 6,
    padding: 24,
    borderRadius: 24,
    overflow: "hidden",
  },
  scoreRing: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    right: -80,
    top: -100,
  },
  scoreIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: "900",
    color: colors.white,
    letterSpacing: -1,
  },
  scoreLabel: { fontSize: 14, color: "rgba(255,255,255,0.8)", fontWeight: "600" },
  scoreBar: {
    width: "86%",
    height: 8,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 10,
  },
  scoreBarFill: {
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  reviewTitle: { marginTop: 22, marginBottom: 12, ...design.sectionTitle },
  reviewCard: { padding: 16, marginBottom: 12, ...design.card, borderWidth: 1 },
  reviewCorrect: { borderColor: "#bfe8d4" },
  reviewWrong: { borderColor: "#f6c9c9" },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  resultBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  resultBadgeCorrect: { backgroundColor: colors.successSoft },
  resultBadgeWrong: { backgroundColor: colors.errorSoft },
  resultBadgeText: { fontSize: 12, fontWeight: "700" },
  resultBadgeTextCorrect: { color: colors.success },
  resultBadgeTextWrong: { color: colors.error },
  answerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 6,
    alignItems: "flex-start",
  },
  answerLabel: { fontSize: 13, color: colors.textMuted, fontWeight: "500" },
  answerCorrect: { fontSize: 13, color: "#16a34a", fontWeight: "700", flex: 1 },
  answerWrong: { fontSize: 13, color: "#dc2626", fontWeight: "700", flex: 1 },
  explanationBox: {
    marginTop: 12,
    backgroundColor: colors.warningSoft,
    borderRadius: 14,
    padding: 12,
  },
  explanationHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  explanationLabel: { fontSize: 12, fontWeight: "800", color: "#92400e" },
  explanationText: { fontSize: 13, color: "#78350f", lineHeight: 18 },
  quizMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 16,
    marginTop: -8,
  },
  quizItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    marginBottom: 10,
    ...design.card,
  },
  quizItemIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  quizItemTitle: { ...design.cardTitle },
  quizItemMeta: { marginTop: 2, ...design.caption },
  quizItemScore: { fontSize: 14, fontWeight: "800" },
});
