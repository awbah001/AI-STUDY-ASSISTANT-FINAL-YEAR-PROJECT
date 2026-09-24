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
import { router } from "expo-router";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";
import { GreenAppBar, HEADER_GREEN } from "../../src/components/GreenAppBar";
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
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function weekOf(anchor: Date) {
  const d = startOfDay(anchor);
  const mondayOffset = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    return x;
  });
}

function eventVisual(type: string) {
  if (type === "assignment") return { icon: "document-text" as const, bg: "#ede9fe", color: "#7c3aed" };
  if (type === "quiz" || type === "test") return { icon: "help-buoy-outline" as const, bg: "#fce7f3", color: "#db2777" };
  if (type === "exam") return { icon: "school-outline" as const, bg: "#fee2e2", color: "#dc2626" };
  return { icon: "book-outline" as const, bg: "#e8f5ee", color: colors.primary };
}

export default function PlannerScreen() {
  const utils = trpc.useUtils();
  const { data } = trpc.planner.today.useQuery();
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
  const weekDays = weekOf(selected);
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];
  const dayEvents = events.filter((e) => sameDay(new Date(eventMs(e.startsAt)), selected));
  const upcoming = [...events]
    .sort((a, b) => eventMs(a.startsAt) - eventMs(b.startsAt))
    .filter((e) => !sameDay(new Date(eventMs(e.startsAt)), selected) && eventMs(e.startsAt) >= selected.getTime());
  const todayLabel = selected.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const shiftWeek = (dir: number) => {
    const next = new Date(selected);
    next.setDate(selected.getDate() + dir * 7);
    const day = startOfDay(next);
    setSelected(day);
    setViewMonth(day);
  };

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
    <View style={s.root}>
      <GreenAppBar
        title="Study Planner"
        right={
          <TouchableOpacity onPress={() => setAskOpen(true)} hitSlop={8}>
            <Ionicons name="sparkles" size={18} color={colors.white} />
          </TouchableOpacity>
        }
      />
      <VoiceCapture listening={voice.listening} usingWebSpeech={voice.usingWebSpeech} onMessage={voice.handleWebMessage} />
      <View style={s.sheet}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={s.weekCard}>
            <View style={s.weekHead}>
              <View>
                <Text style={s.weekTitle}>This Week</Text>
                <Text style={s.weekRange}>
                  {weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} –{" "}
                  {weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </Text>
              </View>
              <View style={s.weekNav}>
                <TouchableOpacity onPress={() => shiftWeek(-1)} style={s.navHit}>
                  <Ionicons name="chevron-back" size={16} color="#8aa0b4" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => shiftWeek(1)} style={s.navHit}>
                  <Ionicons name="chevron-forward" size={16} color="#8aa0b4" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={s.weekStrip}>
              {weekDays.map((day, i) => {
                const isSel = sameDay(day, selected);
                const isToday = sameDay(day, new Date());
                return (
                  <TouchableOpacity key={day.toISOString()} style={s.weekCell} onPress={() => setSelected(startOfDay(day))}>
                    <Text style={[s.weekDow, (isSel || isToday) && s.weekDowActive]}>{WEEKDAYS[i]}</Text>
                    <View style={[s.dateChip, isSel && s.dateChipSel, isToday && !isSel && s.dateChipToday]}>
                      <Text style={[s.dateNum, isSel && s.dateNumSel, isToday && !isSel && s.dateNumToday]}>
                        {day.getDate()}
                      </Text>
                    </View>
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

          <View style={s.sectionHead}>
            <Text style={[s.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>Today · {todayLabel}</Text>
            <TouchableOpacity onPress={openGoalEditor}>
              <Text style={s.goalLink}>
                {data?.completedMinutes ?? 0}/{goal?.dailyStudyMinutes ?? 30}m
              </Text>
            </TouchableOpacity>
          </View>
          {dayEvents.length ? (
            dayEvents.map((event) => {
              const done = eventMs(event.startsAt) < Date.now();
              return (
                <View key={event.id} style={s.taskCard}>
                  <View style={[s.check, done && s.checkOn]}>
                    {done ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.taskTitle, done && s.taskDone]}>{event.title}</Text>
                    <Text style={s.taskDetail}>
                      {new Date(eventMs(event.startsAt)).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      {event.notes ? ` · ${event.notes}` : ""}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert("Remove event?", event.title, [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: () => deleteEvent.mutate({ id: event.id }) },
                      ])
                    }
                  >
                    <Ionicons name="trash-outline" size={16} color="#c4cdd4" />
                  </TouchableOpacity>
                </View>
              );
            })
          ) : sameDay(selected, new Date()) && data?.tasks.length ? (
            data.tasks.map((task) => (
              <TouchableOpacity key={task.id} style={s.taskCard} onPress={() => router.push(task.href as any)}>
                <View style={s.check}>
                  <Ionicons name={ICONS[task.type] ?? "ellipse-outline"} size={14} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.taskTitle}>{task.title}</Text>
                  <Text style={s.taskDetail}>{task.detail}</Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={s.empty}>Nothing scheduled this day. Tap + to add a session.</Text>
          )}

          <Text style={s.sectionTitle}>Upcoming</Text>
          {upcoming.length ? (
            upcoming.slice(0, 6).map((event) => {
              const vis = eventVisual(event.type);
              return (
                <TouchableOpacity
                  key={`up-${event.id}`}
                  style={s.taskCard}
                  onPress={() => setSelected(startOfDay(new Date(eventMs(event.startsAt))))}
                >
                  <View style={[s.upIcon, { backgroundColor: vis.bg }]}>
                    <Ionicons name={vis.icon} size={18} color={vis.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.taskTitle}>
                      {event.type[0].toUpperCase() + event.type.slice(1)}: {event.title}
                    </Text>
                    <Text style={s.taskDetail}>
                      Due: {new Date(eventMs(event.startsAt)).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={s.empty}>No upcoming deadlines. Ask AI to plan an exam timetable.</Text>
          )}
          <View style={{ height: 72 }} />
        </ScrollView>

        <TouchableOpacity style={s.fab} onPress={() => setAddOpen(true)} activeOpacity={0.9}>
          <Ionicons name="add" size={28} color={colors.white} />
        </TouchableOpacity>
      </View>

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
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: HEADER_GREEN },
  sheet: { flex: 1, backgroundColor: "#f3f7f5", borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden" },
  scroll: { padding: 20, paddingBottom: 36 },
  weekCard: { backgroundColor: colors.white, borderRadius: 20, padding: 16 },
  weekHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  weekTitle: { fontSize: 18, fontWeight: "800", color: "#123047" },
  weekRange: { fontSize: 12, color: "#8aa0b4", marginTop: 4 },
  weekNav: { flexDirection: "row", gap: 4 },
  navHit: { padding: 6 },
  weekStrip: { flexDirection: "row" },
  weekCell: { flex: 1, alignItems: "center", gap: 8 },
  weekDow: { fontSize: 11, fontWeight: "700", color: "#9aa8b5" },
  weekDowActive: { color: colors.primary },
  dateChip: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  dateChipSel: { backgroundColor: HEADER_GREEN },
  dateChipToday: { borderWidth: 1.5, borderColor: colors.primary },
  dateNum: { fontSize: 14, fontWeight: "700", color: "#123047" },
  dateNumSel: { color: colors.white },
  dateNumToday: { color: colors.primary },
  planCard: { marginTop: 16, backgroundColor: "#eef8f3", borderRadius: 16, padding: 14 },
  planLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1, color: "#075c45", marginBottom: 8 },
  planBody: { fontSize: 13, color: colors.text, lineHeight: 20 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 22, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#123047", marginTop: 18, marginBottom: 10 },
  goalLink: { fontSize: 12, fontWeight: "700", color: colors.primary, marginTop: 18 },
  taskCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#cfe3d8",
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: "#12a06e", borderColor: "#12a06e" },
  taskTitle: { fontSize: 14, fontWeight: "700", color: "#123047" },
  taskDone: { textDecorationLine: "line-through", color: "#8aa0b4" },
  taskDetail: { fontSize: 12, color: "#8aa0b4", marginTop: 3 },
  upIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  empty: { fontSize: 13, color: "#8aa0b4", marginBottom: 8 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: HEADER_GREEN,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: HEADER_GREEN,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
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
