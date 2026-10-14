import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { WebView } from "react-native-webview";
import { useAuth } from "../src/contexts/AuthContext";
import { trpc } from "../src/lib/api";
import { getOfflineOwner, offlineEvent, offlineStorage, syncOfflineStudy } from "../src/lib/offlineStudy";
import { gradeOfflineQuiz, type OfflineStudyPack } from "../../shared/offlineStudy";
import { colors } from "../src/theme/colors";

export default function OfflineStudyScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const utils = trpc.useUtils();
  const [owner, setOwner] = useState<number | null>(null);
  const [packs, setPacks] = useState<OfflineStudyPack[]>([]);
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [rejected, setRejected] = useState<string[]>([]);
  const [pack, setPack] = useState<OfflineStudyPack | null>(null);
  const [tab, setTab] = useState<"notes" | "cards" | "quizzes">("notes");
  const [started, setStarted] = useState(Date.now());
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState<number[]>([]);
  const [quiz, setQuiz] = useState<OfflineStudyPack["quizzes"][number] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [score, setScore] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);

  async function refresh(ownerId: number) {
    const data = await offlineStorage.read(ownerId);
    setPacks(data.packs); setPending(data.events.length);
  }
  useEffect(() => {
    let active = true;
    setPack(null); setPacks([]); setLoading(true); setRejected([]); setError("");
    void (async () => {
      const id = user?.id ?? await getOfflineOwner();
      if (!active) return;
      setOwner(id);
      if (id) {
        const data = await offlineStorage.read(id);
        if (active) { setPacks(data.packs); setPending(data.events.length); }
      }
    })().catch(err => { if (active) setError(err instanceof Error ? err.message : "Could not load downloads."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id]);

  const select = (next: OfflineStudyPack) => { setPack(next); setTab("notes"); setStarted(Date.now()); setRecorded(false); setReviewed([]); setCardIndex(0); setRevealed(false); setQuiz(null); setScore(null); setAnswers({}); };
  const changeTab = (next: typeof tab) => { setTab(next); setStarted(Date.now()); setRecorded(false); };
  const record = async (kind: "reading" | "flashcards" | "quiz") => {
    if (!owner || !pack || recorded || recording) return;
    setRecording(true);
    try {
      await offlineStorage.enqueue(owner, offlineEvent(pack.document.id, kind, started, kind === "quiz" ? { quizId: quiz!.id, answers } : kind === "flashcards" ? { cardIds: reviewed } : {}));
      setRecorded(true);
      if (kind === "quiz") setScore(gradeOfflineQuiz(quiz!.questions, answers));
      await refresh(owner);
    } catch (err) { Alert.alert("Could not save progress", err instanceof Error ? err.message : "Please try again."); }
    finally { setRecording(false); }
  };
  const sync = async () => {
    if (!owner || !user || user.id !== owner) { router.push("/(auth)/login"); return; }
    setSyncing(true); setError("");
    try {
      const result = await syncOfflineStudy(owner, input => utils.client.offlineStudy.sync.mutate(input));
      await refresh(owner);
      setRejected(result.rejected.map(event => event.eventId));
      if (result.rejected.length) setError(result.rejected[0].message);
      else if (result.accepted.length) Alert.alert("Progress synced", `${result.accepted.length} study sessions synced.`);
      void utils.progress.invalidate();
    } catch (err) { setError(err instanceof Error ? err.message : "Progress is saved locally. Try syncing again when connected."); }
    finally { setSyncing(false); }
  };
  const button = (label: string, onPress: () => void, disabled = false) => <TouchableOpacity disabled={disabled} onPress={onPress} style={[s.button, disabled && { opacity: 0.5 }]}><Text style={s.buttonText}>{label}</Text></TouchableOpacity>;
  const currentCard = pack?.cards[cardIndex];
  return <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
    <View style={s.header}>
      {button(pack ? "Downloads" : "Back", () => pack ? setPack(null) : router.back())}
      <Text style={s.title} numberOfLines={1}>{pack?.document.title ?? "Offline study"}</Text>
    </View>
    <View style={s.banner}>
      <Text>{pending} session{pending === 1 ? "" : "s"} waiting to sync</Text>
      {button(syncing ? "Syncing…" : user ? "Sync now" : "Sign in to sync", () => void sync(), syncing || (!!user && pending === 0))}
      {!!error && <Text style={{ color: "#b45309" }}>{error}</Text>}
      {!!rejected.length && button("Discard rejected sessions", () => Alert.alert("Discard unsynced progress?", "Only the rejected sessions will be removed. Their progress cannot be recovered.", [{ text: "Cancel" }, { text: "Discard", style: "destructive", onPress: () => { void offlineStorage.acknowledge(owner!, rejected).then(() => { setRejected([]); setError(""); return refresh(owner!); }).catch(err => setError(String(err))); } }]))}
    </View>
    {loading ? <ActivityIndicator /> : !pack ? <ScrollView contentContainerStyle={s.content}>
      {!packs.length && <Text>Open a document while connected and choose “Save for offline study” to download notes and existing flashcards and quizzes.</Text>}
      {packs.map(item => <View key={item.document.id} style={s.card}>
        <Text style={s.title}>{item.document.title}</Text>
        <Text>{item.cards.length} flashcards · {item.quizzes.length} practice quizzes</Text>
        <Text>Saved {new Date(item.savedAt).toLocaleDateString()}</Text>
        {button("Study offline", () => select(item))}
        {button("Remove download", () => Alert.alert("Remove download?", "Saved progress will remain queued for sync.", [{ text: "Cancel" }, { text: "Remove", style: "destructive", onPress: () => { void offlineStorage.remove(owner!, item.document.id).then(() => refresh(owner!)).catch(err => setError(String(err))); } }]))}
      </View>)}
    </ScrollView> : <>
      <View style={s.tabs}>{(["notes", "cards", "quizzes"] as const).map(next => button(next === "cards" ? "Flashcards" : next === "notes" ? "Notes" : "Quizzes", () => changeTab(next), tab === next))}</View>
      {tab === "notes" && <>
        {Platform.OS === "web" ? <iframe title={pack.document.title} srcDoc={pack.html} sandbox="" style={{ width: "100%", flex: 1, border: 0 }} /> : <WebView source={{ html: pack.html }} javaScriptEnabled={false} originWhitelist={["*"]} onShouldStartLoadWithRequest={request => request.url === "about:blank" || request.url.startsWith("data:")} style={{ flex: 1 }} />}
        {button(recorded ? "Reading progress saved" : "Finish reading session", () => void record("reading"), recorded || recording)}
      </>}
      {tab === "cards" && <ScrollView contentContainerStyle={s.content}>
        {currentCard ? <View style={s.card}>
          <Text>{cardIndex + 1} / {pack.cards.length}</Text><Text style={s.title}>{currentCard.question}</Text>
          {revealed && <Text>{currentCard.answer}</Text>}
          {button(revealed ? "Answer shown" : "Show answer", () => { setRevealed(true); setReviewed(ids => [...new Set([...ids, currentCard.id])]); }, revealed)}
          {button("Next card", () => { setCardIndex((cardIndex + 1) % pack.cards.length); setRevealed(false); })}
          {button(recorded ? "Session saved" : `Finish session (${reviewed.length} reviewed)`, () => void record("flashcards"), !reviewed.length || recorded || recording)}
        </View> : <Text>No flashcards were available when this copy was saved. Generate flashcards while connected, then update the download.</Text>}
      </ScrollView>}
      {tab === "quizzes" && <ScrollView contentContainerStyle={s.content}>
        {!quiz && !pack.quizzes.length && <Text>No quizzes were available when this copy was saved. Generate a quiz while connected, then update the download.</Text>}
        {!quiz && pack.quizzes.map(item => <View key={item.id}>{button(item.title, () => { setQuiz(item); setAnswers({}); setScore(null); setRecorded(false); setStarted(Date.now()); })}</View>)}
        {quiz && <>
          <Text style={s.title}>{quiz.title}</Text>
          {quiz.questions.map((question, index) => <View key={question.id} style={s.card}>
            <Text>{index + 1}. {question.question}</Text>
            {question.options.map(option => <TouchableOpacity key={option} disabled={score !== null} onPress={() => setAnswers(prev => ({ ...prev, [question.id]: option }))} style={[s.option, answers[String(question.id)] === option && { borderColor: colors.primary, backgroundColor: "#e8fdf2" }]}><Text>{option}</Text></TouchableOpacity>)}
            {score !== null && <Text>Answer: {question.correctAnswer}{question.explanation ? `\n${question.explanation}` : ""}</Text>}
          </View>)}
          {score !== null ? <Text style={s.title}>Score: {score}% · progress saved locally</Text> : button("Finish quiz", () => void record("quiz"), recording || !quiz.questions.length || quiz.questions.some(question => answers[String(question.id)] === undefined))}
          {button("Back to quizzes", () => { setQuiz(null); setRecorded(false); setScore(null); })}
        </>}
      </ScrollView>}
    </>}
  </SafeAreaView>;
}

const s = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#f5f9f7" }, header: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 }, title: { fontSize: 18, fontWeight: "700", flexShrink: 1, color: colors.text }, banner: { padding: 12, gap: 8, backgroundColor: "#e8fdf2" }, content: { padding: 16, gap: 16 }, card: { padding: 16, gap: 12, borderRadius: 16, backgroundColor: "white", borderWidth: 1, borderColor: colors.border }, button: { padding: 10, borderRadius: 10, backgroundColor: colors.primary, marginVertical: 2 }, buttonText: { color: "white", fontWeight: "600" }, tabs: { flexDirection: "row", justifyContent: "space-around", padding: 8 }, option: { padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10 } });
