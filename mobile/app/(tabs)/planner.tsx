import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";
import {
  notificationsAllowed,
  registerForPushNotifications,
  scheduleCalendarReminders,
} from "../../src/lib/notifications";
import { useChatVoice, VoiceCapture } from "../../src/lib/useChatVoice";

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  flashcards: "layers-outline",
  assignment: "clipboard-outline",
  quiz: "help-circle-outline",
};

const EVENT_TYPES = ["exam", "test", "quiz", "study", "other"] as const;
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const TYPE_COLOR: Record<string, string> = {
  exam: "#b91c1c",
  test: "#c2410c",
  quiz: "#7c3aed",
  study: "#047857",
  other: "#334155",
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function eventMs(value: number | string | Date): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value < 1e12 ? value * 1000 : value;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && /^\d+$/.test(String(value))) {
    return String(value).length <= 10 ? asNumber * 1000 : asNumber;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function KeyboardSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.sheetRoot}>
        <Pressable style={s.sheetBackdrop} onPress={onClose} />
        <View style={[s.sheetCard, { marginBottom: keyboardHeight }]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function monthCells(view: Date) {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const start = first.getDay();
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < start; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(view.getFullYear(), view.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function PlannerScreen() {
  const utils = trpc.useUtils();
  const { data, isLoading, refetch } = trpc.planner.today.useQuery();
  const [viewMonth, setViewMonth] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [editing, setEditing] = useState(false);
  const [minutes, setMinutes] = useState("");
  const [cards, setCards] = useState("");
  const [quizzes, setQuizzes] = useState("");
  const [askOpen, setAskOpen] = useState(false);
  const [askText, setAskText] = useState("");
  const [planText, setPlanText] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<(typeof EVENT_TYPES)[number]>("exam");
  const [time, setTime] = useState("09:00");
  const voice = useChatVoice((heard) => {
    setAskText((current) => {
      const next = current.trim() ? `${current.trim()} ${heard}` : heard;
      return next.slice(0, 500);
    });
  });

  const range = useMemo(() => {
    const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getTime();
    const monthEnd = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 2, 1).getTime();
    return {
      from: Math.min(monthStart, Date.now() - 2 * 86400000),
      to: Math.max(monthEnd, Date.now() + 90 * 86400000),
    };
  }, [viewMonth]);

  const calendarQuery = trpc.planner.calendar.useQuery(range);
  const events = calendarQuery.data?.events ?? [];

  useEffect(() => {
    if (!events.length) return;
    void registerForPushNotifications();
    void scheduleCalendarReminders(events);
  }, [events]);

  const saveGoal = trpc.planner.updateGoal.useMutation({
    onSuccess: () => {
      setEditing(false);
      utils.planner.today.invalidate();
    },
  });
  const createEvent = trpc.planner.createEvent.useMutation({
    onSuccess: () => {
      setAddOpen(false);
      setTitle("");
      utils.planner.calendar.invalidate();
    },
  });
  const deleteEvent = trpc.planner.deleteEvent.useMutation({
    onSuccess: () => utils.planner.calendar.invalidate(),
  });
  const generatePlan = trpc.planner.generatePlan.useMutation({
    onSuccess: (result) => {
      setAskOpen(false);
      setAskText("");
      setPlanText(result.reply);
      if (result.created) voice.speak(result.reply);
      const focus = result.events.find((event) => event.type !== "study") ?? result.events[0];
      if (focus) {
        const day = startOfDay(new Date(eventMs(focus.startsAt)));
        setViewMonth(day);
        setSelected(day);
      }
      void utils.planner.calendar.invalidate();
      void (async () => {
        const allowed = await notificationsAllowed();
        if (result.events.length) await scheduleCalendarReminders(result.events);
        Alert.alert(
          result.created ? "Study plan ready" : "No events saved",
          result.created
            ? allowed
              ? `${result.created} sessions saved. Alarms will ring on each study day at 8:00 AM and at session time.`
              : `${result.created} sessions saved. Allow notifications in Settings so day alarms can ring.`
            : result.reply
        );
      })();
    },
    onError: (err) => Alert.alert("Could not create plan", err.message),
  });

  const goal = data?.goal;
  const pct = goal ? Math.min(100, Math.round((data!.completedMinutes / goal.dailyStudyMinutes) * 100)) : 0;
  const cells = monthCells(viewMonth);
  const dayEvents = events.filter((e) => sameDay(new Date(eventMs(e.startsAt)), selected));
  const upcoming = [...events]
    .sort((a, b) => eventMs(a.startsAt) - eventMs(b.startsAt))
    .filter((e) => eventMs(e.startsAt) >= Date.now() - 60 * 60 * 1000);

  const openGoalEditor = () => {
    setMinutes(String(goal?.dailyStudyMinutes ?? 30));
    setCards(String(goal?.dailyFlashcards ?? 10));
    setQuizzes(String(goal?.dailyQuizzes ?? 1));
    setEditing(true);
  };

  const saveManual = () => {
    const [hh, mm] = time.split(":").map(Number);
    if (!title.trim() || Number.isNaN(hh) || Number.isNaN(mm)) {
      Alert.alert("Check the event", "Add a title and time like 09:00.");
      return;
    }
    const starts = new Date(selected);
    starts.setHours(hh, mm, 0, 0);
    createEvent.mutate({
      title: title.trim(),
      type: eventType,
      startsAt: starts.getTime(),
    });
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <VoiceCapture listening={voice.listening} usingWebSpeech={voice.usingWebSpeech} onMessage={voice.handleWebMessage} />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={false}
      >
        <View style={s.header}>
          <View>
            <Text style={s.eyebrow}>STUDY CALENDAR</Text>
            <Text style={s.title}>Planner</Text>
            <Text style={s.subtitle}>Ask AI to timetable exams — you get an alarm on each study day and at session time.</Text>
          </View>
          <TouchableOpacity
            style={s.refresh}
            onPress={() => {
              refetch();
              calendarQuery.refetch();
            }}
          >
            <Ionicons name="refresh" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={s.actionsRow}>
          <TouchableOpacity style={s.askBtn} onPress={() => setAskOpen(true)}>
            <Ionicons name="sparkles" size={16} color={colors.white} />
            <Text style={s.askBtnText}>Ask AI to plan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.addBtn} onPress={() => setAddOpen(true)}>
            <Ionicons name="add" size={18} color="#033c35" />
            <Text style={s.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        <View style={s.calCard}>
          <View style={s.calNav}>
            <TouchableOpacity
              onPress={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={s.calMonth}>
              {viewMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}
            </Text>
            <TouchableOpacity
              onPress={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
            >
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={s.weekRow}>
            {WEEKDAYS.map((d, i) => (
              <Text key={`${d}-${i}`} style={s.weekDay}>
                {d}
              </Text>
            ))}
          </View>
          <View style={s.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={`e-${i}`} style={s.cell} />;
              const isSel = sameDay(day, selected);
              const isToday = sameDay(day, new Date());
              const marked = events.some((e) => sameDay(new Date(eventMs(e.startsAt)), day));
              return (
                <TouchableOpacity key={day.toISOString()} style={s.cell} onPress={() => setSelected(startOfDay(day))}>
                  <View style={[s.dayChip, isSel && s.dayChipSel, isToday && !isSel && s.dayChipToday]}>
                    <Text style={[s.dayNum, isSel && s.dayNumSel]}>{day.getDate()}</Text>
                  </View>
                  {marked ? <View style={s.dot} /> : <View style={s.dotSpacer} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {!!planText && (
          <View style={s.planCard}>
            <Text style={s.planLabel}>STRUCTURED AI PLAN</Text>
            <Text style={s.planBody}>{planText}</Text>
          </View>
        )}

        <Text style={s.sectionTitle}>Your timetable</Text>
        {upcoming.length ? (
          upcoming.map((event) => (
            <TouchableOpacity
              key={`up-${event.id}`}
              style={s.eventRow}
              onPress={() => setSelected(startOfDay(new Date(eventMs(event.startsAt))))}
            >
              <View style={[s.typePill, { backgroundColor: TYPE_COLOR[event.type] ?? "#334155" }]}>
                <Text style={s.typePillText}>{event.type}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.eventTitle}>{event.title}</Text>
                <Text style={s.eventMeta}>{new Date(eventMs(event.startsAt)).toLocaleString()}</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={s.empty}>No upcoming plan yet. Tap Ask AI to plan and include the exam date.</Text>
        )}

        <Text style={s.sectionTitle}>
          {selected.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
        </Text>
        {dayEvents.length ? (
          dayEvents.map((event) => (
            <View key={event.id} style={s.eventRow}>
              <View style={[s.typePill, { backgroundColor: TYPE_COLOR[event.type] ?? "#334155" }]}>
                <Text style={s.typePillText}>{event.type}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.eventTitle}>{event.title}</Text>
                <Text style={s.eventMeta}>
                  {new Date(event.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {event.source === "agent" ? " · AI plan" : ""}
                  {" · alarm on the day"}
                </Text>
                {event.notes ? <Text style={s.eventNotes}>{event.notes}</Text> : null}
              </View>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert("Remove event?", event.title, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => deleteEvent.mutate({ id: event.id }) },
                  ])
                }
              >
                <Ionicons name="trash-outline" size={18} color="#b91c1c" />
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <Text style={s.empty}>Nothing else on this day.</Text>
        )}

        <View style={s.goalCard}>
          <View style={s.goalTop}>
            <View>
              <Text style={s.goalLabel}>YOUR DAILY GOALS</Text>
              <Text style={s.goalValue}>
                {data?.completedMinutes ?? 0}{" "}
                <Text style={s.goalUnit}>/ {goal?.dailyStudyMinutes ?? 30} min</Text>
              </Text>
            </View>
            <TouchableOpacity onPress={openGoalEditor} style={s.settings}>
              <Ionicons name="settings-outline" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
          <View style={s.barBg}>
            <View style={[s.barFill, { width: `${pct}%` }]} />
          </View>
          <Text style={s.goalCaption}>
            {pct >= 100
              ? "Study goal complete — keep the momentum going!"
              : `${Math.max(0, (goal?.dailyStudyMinutes ?? 30) - (data?.completedMinutes ?? 0))} study minutes remaining today`}
          </Text>
        </View>

        <View style={s.sectionHead}>
          <Text style={s.sectionTitle}>Your next steps</Text>
          <Text style={s.count}>{data?.tasks.length ?? 0} tasks</Text>
        </View>
        {isLoading ? (
          <Text style={s.empty}>Building your plan…</Text>
        ) : data?.tasks.length ? (
          data.tasks.map((task) => (
            <TouchableOpacity key={task.id} style={s.task} onPress={() => router.push(task.href as any)}>
              <View style={s.taskIcon}>
                <Ionicons name={ICONS[task.type] ?? "ellipse-outline"} size={21} color={colors.primary} />
              </View>
              <View style={s.taskContent}>
                <Text style={s.taskTitle}>{task.title}</Text>
                <Text style={s.taskDetail}>{task.detail}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
            </TouchableOpacity>
          ))
        ) : (
          <View style={s.emptyCard}>
            <Ionicons name="checkmark-circle" size={34} color={colors.primary} />
            <Text style={s.emptyTitle}>You’re all caught up</Text>
            <Text style={s.empty}>No urgent work right now. Explore a course or review a document.</Text>
          </View>
        )}
      </ScrollView>

      <KeyboardSheet visible={editing} onClose={() => setEditing(false)}>
        <Text style={s.modalTitle}>Set your daily goals</Text>
        <Text style={s.inputLabel}>Study minutes</Text>
        <TextInput keyboardType="number-pad" value={minutes} onChangeText={setMinutes} style={s.input} />
        <Text style={s.inputLabel}>Flashcards to review</Text>
        <TextInput keyboardType="number-pad" value={cards} onChangeText={setCards} style={s.input} />
        <Text style={s.inputLabel}>Quizzes to complete</Text>
        <TextInput keyboardType="number-pad" value={quizzes} onChangeText={setQuizzes} style={s.input} />
        <View style={s.actions}>
          <TouchableOpacity onPress={() => setEditing(false)} style={s.cancel}>
            <Text>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              const m = Number(minutes),
                c = Number(cards),
                q = Number(quizzes);
              if (m < 5 || c < 1 || q < 1) return Alert.alert("Check your goals", "Set at least 5 minutes, 1 flashcard, and 1 quiz.");
              saveGoal.mutate({ dailyStudyMinutes: m, dailyFlashcards: c, dailyQuizzes: q });
            }}
            style={s.save}
          >
            <Text style={s.saveText}>{saveGoal.isPending ? "Saving…" : "Save goals"}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardSheet>

      <KeyboardSheet visible={askOpen} onClose={() => setAskOpen(false)}>
        <Text style={s.modalTitle}>Ask AI for a timetable</Text>
        <Text style={s.modalSubtitle}>
          Example: “Create a 5-day study plan for my GIS exam on 20 September at 9am.”
        </Text>
        <TextInput
          value={askText}
          onChangeText={setAskText}
          style={[s.input, s.askInput]}
          multiline
          autoFocus
          autoCorrect
          placeholder={voice.listening ? "Listening…" : "Exam, test, or quiz details…"}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
        />
        <View style={s.actions}>
          <TouchableOpacity
            onPress={voice.toggleListening}
            style={[s.cancel, voice.listening && { backgroundColor: colors.primary }]}
          >
            <Text style={voice.listening ? { color: colors.white, fontWeight: "700" } : undefined}>
              {voice.listening ? "Stop mic" : "Speak"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setAskOpen(false)} style={s.cancel}>
            <Text>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (askText.trim().length < 8) {
                Alert.alert("Add more detail", "Mention the exam or test and when it is.");
                return;
              }
              if (voice.listening) voice.stopListening();
              generatePlan.mutate({ message: askText.trim() });
            }}
            style={s.save}
          >
            <Text style={s.saveText}>{generatePlan.isPending ? "Planning…" : "Create plan"}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardSheet>

      <KeyboardSheet visible={addOpen} onClose={() => setAddOpen(false)}>
        <Text style={s.modalTitle}>Add to calendar</Text>
        <Text style={s.modalSubtitle}>{selected.toLocaleDateString()}</Text>
        <Text style={s.inputLabel}>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          style={s.input}
          placeholder="GIS midterm"
          placeholderTextColor={colors.textMuted}
          autoFocus
          selectionColor={colors.primary}
        />
        <Text style={s.inputLabel}>Type</Text>
        <View style={s.typeRow}>
          {EVENT_TYPES.map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setEventType(t)}
              style={[s.typeChip, eventType === t && { backgroundColor: TYPE_COLOR[t] }]}
            >
              <Text style={[s.typeChipText, eventType === t && { color: colors.white }]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.inputLabel}>Time (24h)</Text>
        <TextInput
          value={time}
          onChangeText={setTime}
          style={s.input}
          placeholder="09:00"
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
        />
        <View style={s.actions}>
          <TouchableOpacity onPress={() => setAddOpen(false)} style={s.cancel}>
            <Text>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={saveManual} style={s.save}>
            <Text style={s.saveText}>{createEvent.isPending ? "Saving…" : "Save"}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardSheet>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f8f7" },
  scroll: { padding: 20, paddingBottom: 36 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 10 },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1, color: "#075c45" },
  title: { fontSize: 30, fontWeight: "800", color: colors.text, marginTop: 3 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 3, maxWidth: 260 },
  refresh: { padding: 10, backgroundColor: colors.surface, borderRadius: 12 },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  askBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#033c35",
    borderRadius: 14,
    paddingVertical: 12,
  },
  askBtnText: { color: colors.white, fontWeight: "800" },
  addBtn: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addBtnText: { fontWeight: "800", color: "#033c35" },
  calCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  calNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  calMonth: { fontSize: 16, fontWeight: "800", color: colors.text },
  weekRow: { flexDirection: "row" },
  weekDay: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", color: colors.textMuted },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  cell: { width: "14.28%", alignItems: "center", paddingVertical: 4 },
  dayChip: { height: 32, width: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  dayChipSel: { backgroundColor: "#033c35" },
  dayChipToday: { backgroundColor: "#e9f8ef" },
  dayNum: { fontSize: 13, fontWeight: "700", color: colors.text },
  dayNumSel: { color: colors.white },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#047857", marginTop: 2 },
  dotSpacer: { height: 7 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginTop: 20 },
  planCard: {
    marginTop: 18,
    backgroundColor: "#eef8f3",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#cfe8dc",
  },
  planLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1, color: "#075c45", marginBottom: 8 },
  planBody: { fontSize: 13, color: colors.text, lineHeight: 20 },
  eventRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typePill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 2 },
  typePillText: { color: colors.white, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  eventTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  eventMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  eventNotes: { fontSize: 12, color: colors.text, marginTop: 4 },
  empty: { fontSize: 13, color: colors.textMuted, marginTop: 8 },
  goalCard: {
    backgroundColor: "#033c35",
    borderRadius: 24,
    padding: 20,
    marginTop: 22,
  },
  goalTop: { flexDirection: "row", justifyContent: "space-between" },
  settings: { backgroundColor: "rgba(255,255,255,.13)", padding: 8, borderRadius: 11 },
  goalLabel: { fontSize: 11, color: "#b9e6cf", fontWeight: "800", letterSpacing: 1 },
  goalValue: { fontSize: 30, color: colors.white, fontWeight: "800", marginTop: 4 },
  goalUnit: { fontSize: 15, fontWeight: "600" },
  barBg: { height: 9, borderRadius: 6, backgroundColor: "rgba(255,255,255,.18)", marginTop: 18, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: "#9ae6b4", borderRadius: 6 },
  goalCaption: { color: "#d8f7e4", fontSize: 12, marginTop: 12 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 28, marginBottom: 10 },
  count: { fontSize: 12, color: colors.textMuted },
  task: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  taskIcon: { height: 42, width: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#e9f8ef" },
  taskContent: { flex: 1 },
  taskTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  taskDetail: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    alignItems: "center",
    padding: 28,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 8 },
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,.45)" },
  sheetCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 28 : 20,
    maxHeight: "88%",
  },
  modalTitle: { fontSize: 19, fontWeight: "800", color: colors.text },
  modalSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4, marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 6 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
    backgroundColor: "#fff",
    marginBottom: 14,
  },
  askInput: { minHeight: 110, height: 110, textAlignVertical: "top" },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  typeChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: "#eef2f1" },
  typeChipText: { fontSize: 12, fontWeight: "700", color: colors.text },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 4 },
  cancel: { paddingHorizontal: 16, paddingVertical: 11 },
  save: { paddingHorizontal: 16, paddingVertical: 11, backgroundColor: "#033c35", borderRadius: 11 },
  saveText: { color: colors.white, fontWeight: "700" },
});
