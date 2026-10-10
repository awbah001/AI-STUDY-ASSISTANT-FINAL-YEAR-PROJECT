import { design, elevation } from "../../src/theme/design";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
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
import { colors, gradients } from "../../src/theme/colors";
import { HeroGradient, IconTile, Pill } from "../../src/components/ui/Kit";
import type { IconToneName } from "../../src/components/ui/icons";
import {
  notificationsAllowed,
  registerForPushNotifications,
  scheduleCalendarReminders,
} from "../../src/lib/notifications";
import { useChatVoice, VoiceCapture } from "../../src/lib/useChatVoice";
import { useFieldErrors, validateNumber, validateText } from "../../src/lib/validation";
import { FieldError, FIELD_ERROR_COLOR } from "../../src/components/FieldError";

const EVENT_TITLE_MAX = 160;
const PLAN_REQUEST_MAX = 500;

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  flashcards: "layers-outline",
  assignment: "clipboard-outline",
  quiz: "help-circle-outline",
};

const TASK_TONES: Record<string, IconToneName> = {
  flashcards: "pink",
  assignment: "orange",
  quiz: "amber",
};

const EVENT_TYPES = ["exam", "test", "quiz", "study", "other"] as const;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TYPE_COLOR: Record<string, string> = {
  exam: "#b91c1c",
  test: "#c2410c",
  quiz: "#800020",
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
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
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
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, event => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.sheetRoot}>
        <Pressable style={s.sheetBackdrop} onPress={onClose} />
        <View style={[s.sheetCard, { marginBottom: keyboardHeight }]}>
          <View style={s.grabber} />
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
  if (type === "assignment")
    return { icon: "document-text" as const, bg: "#f8edf0", color: "#800020" };
  if (type === "quiz" || type === "test")
    return {
      icon: "help-buoy-outline" as const,
      bg: "#fce7f3",
      color: "#db2777",
    };
  if (type === "exam")
    return { icon: "school-outline" as const, bg: "#fee2e2", color: "#dc2626" };
  return {
    icon: "book-outline" as const,
    bg: "#e8f5ee",
    color: colors.primary,
  };
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
  const [eventType, setEventType] =
    useState<(typeof EVENT_TYPES)[number]>("exam");
  const [time, setTime] = useState("09:00");
  const { errors, check, clear, reset } = useFieldErrors<"minutes" | "cards" | "quizzes" | "ask" | "title" | "time">();
  const voice = useChatVoice(heard => {
    setAskText(current => {
      const next = current.trim() ? `${current.trim()} ${heard}` : heard;
      return next.slice(0, 500);
    });
  });

  const range = useMemo(() => {
    const monthStart = new Date(
      viewMonth.getFullYear(),
      viewMonth.getMonth(),
      1
    ).getTime();
    const monthEnd = new Date(
      viewMonth.getFullYear(),
      viewMonth.getMonth() + 2,
      1
    ).getTime();
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
      reset();
      utils.planner.today.invalidate();
    },
    onError: err => Alert.alert("Could not save goals", err.message),
  });
  const createEvent = trpc.planner.createEvent.useMutation({
    onSuccess: () => {
      setAddOpen(false);
      setTitle("");
      reset();
      utils.planner.calendar.invalidate();
    },
    onError: err => Alert.alert("Could not add event", err.message),
  });
  const deleteEvent = trpc.planner.deleteEvent.useMutation({
    onSuccess: () => utils.planner.calendar.invalidate(),
  });
  const generatePlan = trpc.planner.generatePlan.useMutation({
    onSuccess: result => {
      setAskOpen(false);
      setAskText("");
      setPlanText(result.reply);
      const focus =
        result.events.find(event => event.type !== "study") ?? result.events[0];
      if (focus) {
        const day = startOfDay(new Date(eventMs(focus.startsAt)));
        setViewMonth(day);
        setSelected(day);
      }
      void utils.planner.calendar.invalidate();
      void (async () => {
        const allowed = await notificationsAllowed();
        if (result.events.length)
          await scheduleCalendarReminders(result.events);
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
    onError: err => Alert.alert("Could not create plan", err.message),
  });

  const goal = data?.goal;
  const weekDays = weekOf(selected);
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];
  const dayEvents = events.filter(e =>
    sameDay(new Date(eventMs(e.startsAt)), selected)
  );
  const upcoming = [...events]
    .sort((a, b) => eventMs(a.startsAt) - eventMs(b.startsAt))
    .filter(
      e =>
        !sameDay(new Date(eventMs(e.startsAt)), selected) &&
        eventMs(e.startsAt) >= selected.getTime()
    );
  const todayLabel = selected.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
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
    const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
    const starts = new Date(selected);
    if (match) starts.setHours(Number(match[1]), Number(match[2]), 0, 0);
    const ok = check({
      title: validateText(title, { label: "Title", min: 2, max: EVENT_TITLE_MAX }),
      time: !match
        ? "Enter a time like 09:00 or 14:30."
        : starts.getTime() < Date.now() - 24 * 60 * 60 * 1000
          ? "Choose a date and time that is not in the past."
          : null,
    });
    if (!ok) return;
    createEvent.mutate({
      title: title.trim(),
      type: eventType,
      startsAt: starts.getTime(),
    });
  };

  const goalMins = goal?.dailyStudyMinutes ?? 30;
  const doneMins = data?.completedMinutes ?? 0;
  const goalPct = Math.min(100, Math.round((doneMins / Math.max(goalMins, 1)) * 100));
  const monthLabel = selected.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const hasEvents = (day: Date) =>
    events.some(e => sameDay(new Date(eventMs(e.startsAt)), day));

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>{monthLabel}</Text>
          <Text style={s.title}>Study planner</Text>
        </View>
        <TouchableOpacity
          onPress={() => setAskOpen(true)}
          activeOpacity={0.85}
          accessibilityLabel="Plan with AI"
          style={s.aiBtnWrap}
        >
          <LinearGradient
            colors={gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.aiBtn}
          >
            <Ionicons name="sparkles" size={15} color={colors.accentSoft} />
            <Text style={s.aiBtnText}>Plan with AI</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
      <VoiceCapture
        listening={voice.listening}
        usingWebSpeech={voice.usingWebSpeech}
        onMessage={voice.handleWebMessage}
      />
      <View style={s.sheet}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <TouchableOpacity activeOpacity={0.92} onPress={openGoalEditor} style={s.goalWrap}>
            <HeroGradient style={s.goalCard}>
              <View style={s.goalTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.goalLabel}>Today's goal</Text>
                  <View style={s.goalRow}>
                    <Text style={s.goalNum}>{doneMins}</Text>
                    <Text style={s.goalDenom}>/ {goalMins} min</Text>
                  </View>
                </View>
                <View style={s.goalEdit}>
                  <Ionicons name="create-outline" size={14} color={colors.white} />
                  <Text style={s.goalEditText}>Edit</Text>
                </View>
              </View>
              <View style={s.goalBar}>
                <View style={[s.goalBarFill, { width: `${goalPct}%` }]} />
              </View>
              <View style={s.goalChips}>
                <GoalChip icon="time-outline" label={`${goalMins} min`} />
                <GoalChip icon="layers-outline" label={`${goal?.dailyFlashcards ?? 10} cards`} />
                <GoalChip icon="help-circle-outline" label={`${goal?.dailyQuizzes ?? 1} quiz`} />
              </View>
            </HeroGradient>
          </TouchableOpacity>

          <View style={s.weekCard}>
            <View style={s.weekHead}>
              <View>
                <Text style={s.weekTitle}>This week</Text>
                <Text style={s.weekRange}>
                  {weekStart.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  –{" "}
                  {weekEnd.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              </View>
              <View style={s.weekNav}>
                <TouchableOpacity
                  onPress={() => shiftWeek(-1)}
                  style={s.navHit}
                  accessibilityLabel="Previous week"
                >
                  <Ionicons name="chevron-back" size={16} color={colors.textSub} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => shiftWeek(1)}
                  style={s.navHit}
                  accessibilityLabel="Next week"
                >
                  <Ionicons name="chevron-forward" size={16} color={colors.textSub} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={s.weekStrip}>
              {weekDays.map((day, i) => {
                const isSel = sameDay(day, selected);
                const isToday = sameDay(day, new Date());
                const dot = hasEvents(day);
                return (
                  <TouchableOpacity
                    key={day.toISOString()}
                    style={[s.weekCell, isSel && s.weekCellSel]}
                    onPress={() => setSelected(startOfDay(day))}
                  >
                    <Text
                      style={[
                        s.weekDow,
                        isToday && s.weekDowActive,
                        isSel && s.weekDowSel,
                      ]}
                    >
                      {WEEKDAYS[i]}
                    </Text>
                    <Text
                      style={[
                        s.dateNum,
                        isToday && !isSel && s.dateNumToday,
                        isSel && s.dateNumSel,
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                    <View
                      style={[
                        s.eventDot,
                        dot && s.eventDotOn,
                        dot && isSel && s.eventDotSel,
                      ]}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {!!planText && (
            <View style={s.planCard}>
              <View style={s.planHead}>
                <View style={s.planIcon}>
                  <Ionicons name="sparkles" size={13} color={colors.primary} />
                </View>
                <Text style={[s.planLabel, { flex: 1 }]}>Structured AI plan</Text>
                <TouchableOpacity
                  onPress={() => voice.toggleSpeak(planText, "plan")}
                  hitSlop={8}
                  accessibilityLabel={voice.speakingId === "plan" ? "Stop reading aloud" : "Read plan aloud"}
                >
                  <Ionicons
                    name={voice.speakingId === "plan" ? "stop-circle-outline" : "volume-medium-outline"}
                    size={18}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              </View>
              <Text style={s.planBody}>{planText}</Text>
            </View>
          )}

          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>{todayLabel}</Text>
            <Text style={s.sectionMeta}>
              {dayEvents.length
                ? `${dayEvents.length} ${dayEvents.length === 1 ? "item" : "items"}`
                : ""}
            </Text>
          </View>
          {dayEvents.length ? (
            dayEvents.map((event, i) => {
              const done = eventMs(event.startsAt) < Date.now();
              const vis = eventVisual(event.type);
              return (
                <View key={event.id} style={s.timelineRow}>
                  <View style={s.timeCol}>
                    <Text style={s.timeText}>
                      {new Date(eventMs(event.startsAt)).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </Text>
                    {i < dayEvents.length - 1 ? <View style={s.timeLine} /> : null}
                  </View>
                  <View style={[s.taskCard, s.timelineCard, { borderLeftColor: vis.color }]}>
                    <View style={[s.check, done && s.checkOn]}>
                      {done ? (
                        <Ionicons name="checkmark" size={13} color={colors.white} />
                      ) : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.taskTitle, done && s.taskDone]} numberOfLines={2}>
                        {event.title}
                      </Text>
                      <View style={s.taskMetaRow}>
                        <Pill label={event.type} color={vis.color} bg={vis.bg} />
                        {event.notes ? (
                          <Text style={s.taskDetail} numberOfLines={1}>
                            {event.notes}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <TouchableOpacity
                      style={s.trashBtn}
                      accessibilityLabel="Remove event"
                      onPress={() =>
                        Alert.alert("Remove event?", event.title, [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: () => deleteEvent.mutate({ id: event.id }),
                          },
                        ])
                      }
                    >
                      <Ionicons name="trash-outline" size={15} color={colors.textLight} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          ) : sameDay(selected, new Date()) && data?.tasks.length ? (
            data.tasks.map(task => (
              <TouchableOpacity
                key={task.id}
                style={s.taskCard}
                activeOpacity={0.85}
                onPress={() => router.push(task.href as any)}
              >
                <IconTile
                  icon={ICONS[task.type] ?? "ellipse-outline"}
                  tone={TASK_TONES[task.type]}
                  size={40}
                />
                <View style={{ flex: 1 }}>
                  <Text style={s.taskTitle}>{task.title}</Text>
                  <Text style={s.taskDetail}>{task.detail}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
              </TouchableOpacity>
            ))
          ) : (
            <View style={s.emptyDay}>
              <Ionicons name="calendar-clear-outline" size={20} color={colors.textLight} />
              <Text style={s.empty}>
                Nothing scheduled this day. Tap + to add a session.
              </Text>
            </View>
          )}

          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Upcoming</Text>
          </View>
          {upcoming.length ? (
            <View style={s.upList}>
              {upcoming.slice(0, 6).map((event, i, list) => {
                const vis = eventVisual(event.type);
                const d = new Date(eventMs(event.startsAt));
                return (
                  <TouchableOpacity
                    key={`up-${event.id}`}
                    style={[s.upRow, i < list.length - 1 && s.upDivider]}
                    activeOpacity={0.8}
                    onPress={() => setSelected(startOfDay(d))}
                  >
                    <View style={[s.upDate, { backgroundColor: vis.bg }]}>
                      <Text style={[s.upDay, { color: vis.color }]}>{d.getDate()}</Text>
                      <Text style={[s.upMonth, { color: vis.color }]}>
                        {d.toLocaleDateString(undefined, { month: "short" })}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={s.taskTitle} numberOfLines={1}>
                        {event.title}
                      </Text>
                      <View style={s.taskMetaRow}>
                        <Ionicons name={vis.icon} size={12} color={vis.color} />
                        <Text style={[s.upType, { color: vis.color }]}>
                          {event.type[0].toUpperCase() + event.type.slice(1)}
                        </Text>
                        <Text style={s.taskDetail}>
                          ·{" "}
                          {d.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={15} color={colors.textLight} />
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={s.emptyDay}>
              <Ionicons name="sparkles-outline" size={20} color={colors.textLight} />
              <Text style={s.empty}>
                No upcoming deadlines. Ask AI to plan an exam timetable.
              </Text>
            </View>
          )}
          <View style={{ height: 88 }} />
        </ScrollView>

        <TouchableOpacity
          style={s.fab}
          onPress={() => setAddOpen(true)}
          activeOpacity={0.9}
          accessibilityLabel="Add to calendar"
        >
          <LinearGradient
            colors={gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.fabInner}
          >
            <Ionicons name="add" size={28} color={colors.white} />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <KeyboardSheet visible={editing} onClose={() => setEditing(false)}>
        <SheetHeader icon="flag-outline" title="Set your daily goals" />
        <Text style={s.inputLabel}>Study minutes</Text>
        <TextInput
          keyboardType="number-pad"
          value={minutes}
          onChangeText={v => {
            setMinutes(v);
            clear("minutes");
          }}
          maxLength={3}
          style={[s.input, !!errors.minutes && s.inputError]}
          accessibilityLabel="Study minutes"
        />
        <FieldError message={errors.minutes} style={s.fieldError} />
        <Text style={s.inputLabel}>Flashcards to review</Text>
        <TextInput
          keyboardType="number-pad"
          value={cards}
          onChangeText={v => {
            setCards(v);
            clear("cards");
          }}
          maxLength={3}
          style={[s.input, !!errors.cards && s.inputError]}
          accessibilityLabel="Flashcards to review"
        />
        <FieldError message={errors.cards} style={s.fieldError} />
        <Text style={s.inputLabel}>Quizzes to complete</Text>
        <TextInput
          keyboardType="number-pad"
          value={quizzes}
          onChangeText={v => {
            setQuizzes(v);
            clear("quizzes");
          }}
          maxLength={2}
          style={[s.input, !!errors.quizzes && s.inputError]}
          accessibilityLabel="Quizzes to complete"
        />
        <FieldError message={errors.quizzes} style={s.fieldError} />
        <View style={s.actions}>
          <TouchableOpacity onPress={() => setEditing(false)} style={s.cancel}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              const ok = check({
                minutes: validateNumber(minutes, { label: "Study minutes", min: 5, max: 480, integer: true }),
                cards: validateNumber(cards, { label: "Flashcards", min: 1, max: 100, integer: true }),
                quizzes: validateNumber(quizzes, { label: "Quizzes", min: 1, max: 20, integer: true }),
              });
              if (!ok) return;
              saveGoal.mutate({
                dailyStudyMinutes: Number(minutes),
                dailyFlashcards: Number(cards),
                dailyQuizzes: Number(quizzes),
              });
            }}
            style={s.save}
          >
            <Text style={s.saveText}>
              {saveGoal.isPending ? "Saving…" : "Save goals"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardSheet>

      <KeyboardSheet visible={askOpen} onClose={() => setAskOpen(false)}>
        <SheetHeader icon="sparkles" title="Ask AI for a timetable" />
        <Text style={s.modalSubtitle}>
          Example: “Create a 5-day study plan for my GIS exam on 20 September at
          9am.”
        </Text>
        <TextInput
          value={askText}
          onChangeText={v => {
            setAskText(v);
            clear("ask");
          }}
          maxLength={PLAN_REQUEST_MAX}
          style={[s.input, s.askInput, !!errors.ask && s.inputError]}
          multiline
          autoFocus
          autoCorrect
          placeholder={
            voice.listening ? "Listening…" : "Exam, test, or quiz details…"
          }
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
        />
        <FieldError message={errors.ask} style={s.fieldError} />
        <View style={s.actions}>
          <TouchableOpacity
            onPress={voice.toggleListening}
            style={[s.micPill, voice.listening && s.micPillOn]}
          >
            <Ionicons
              name={voice.listening ? "stop" : "mic-outline"}
              size={15}
              color={voice.listening ? colors.white : colors.primary}
            />
            <Text style={[s.micPillText, voice.listening && { color: colors.white }]}>
              {voice.listening ? "Stop mic" : "Speak"}
            </Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => setAskOpen(false)} style={s.cancel}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              const askError =
                askText.trim().length > 0 && askText.trim().length < 8
                  ? "Add more detail: mention the exam or test and when it is."
                  : validateText(askText, { label: "Your request", min: 8, max: PLAN_REQUEST_MAX });
              if (!check({ ask: askError })) return;
              if (voice.listening) voice.stopListening();
              generatePlan.mutate({ message: askText.trim() });
            }}
            style={s.save}
          >
            <Text style={s.saveText}>
              {generatePlan.isPending ? "Planning…" : "Create plan"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardSheet>

      <KeyboardSheet visible={addOpen} onClose={() => setAddOpen(false)}>
        <SheetHeader
          icon="calendar-outline"
          title="Add to calendar"
          subtitle={selected.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        />
        <Text style={s.inputLabel}>Title</Text>
        <TextInput
          value={title}
          onChangeText={v => {
            setTitle(v);
            clear("title");
          }}
          maxLength={EVENT_TITLE_MAX}
          style={[s.input, !!errors.title && s.inputError]}
          placeholder="GIS midterm"
          placeholderTextColor={colors.textMuted}
          autoFocus
          selectionColor={colors.primary}
        />
        <FieldError message={errors.title} style={s.fieldError} />
        <Text style={s.inputLabel}>Type</Text>
        <View style={s.typeRow}>
          {EVENT_TYPES.map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setEventType(t)}
              style={[
                s.typeChip,
                eventType === t && {
                  backgroundColor: TYPE_COLOR[t],
                  borderColor: TYPE_COLOR[t],
                },
              ]}
            >
              <Text
                style={[
                  s.typeChipText,
                  eventType === t && { color: colors.white },
                ]}
              >
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.inputLabel}>Time (24h)</Text>
        <TextInput
          value={time}
          onChangeText={v => {
            setTime(v);
            clear("time");
          }}
          maxLength={5}
          keyboardType="numbers-and-punctuation"
          style={[s.input, !!errors.time && s.inputError]}
          placeholder="09:00"
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
        />
        <FieldError message={errors.time} style={s.fieldError} />
        <View style={s.actions}>
          <TouchableOpacity onPress={() => setAddOpen(false)} style={s.cancel}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={saveManual} style={s.save}>
            <Text style={s.saveText}>
              {createEvent.isPending ? "Saving…" : "Save"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardSheet>
    </SafeAreaView>
  );
}

function GoalChip({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={s.goalChip}>
      <Ionicons name={icon} size={12} color={colors.accentSoft} />
      <Text style={s.goalChipText}>{label}</Text>
    </View>
  );
}

function SheetHeader({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={s.sheetHeader}>
      <IconTile icon={icon} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={s.modalTitle}>{title}</Text>
        {subtitle ? <Text style={s.sheetSub}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, ...design.page },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
  },
  eyebrow: { ...design.eyebrow, color: colors.primary, marginBottom: 4 },
  title: { ...design.screenTitle },
  aiBtnWrap: { borderRadius: 21, ...elevation.brand },
  aiBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 21,
  },
  aiBtnText: { color: colors.white, fontWeight: "700", fontSize: 13.5 },
  sheet: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 36 },

  goalWrap: {
    borderRadius: 24,
    marginBottom: 16,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 7,
  },
  goalCard: { padding: 18, gap: 14 },
  goalTop: { flexDirection: "row", alignItems: "flex-start" },
  goalLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#a7f3d0",
  },
  goalRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 4 },
  goalNum: { fontSize: 34, lineHeight: 40, fontWeight: "800", color: colors.white, letterSpacing: -1 },
  goalDenom: { fontSize: 14, fontWeight: "600", color: "#bfe3d6" },
  goalEdit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  goalEditText: { color: colors.white, fontSize: 12, fontWeight: "700" },
  goalBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
  },
  goalBarFill: { height: "100%", borderRadius: 3, backgroundColor: colors.accent },
  goalChips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  goalChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  goalChipText: { color: colors.white, fontSize: 11.5, fontWeight: "600" },

  weekCard: { padding: 14, ...design.card },
  weekHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  weekTitle: { ...design.cardTitle },
  weekRange: { marginTop: 2, ...design.caption },
  weekNav: { flexDirection: "row", gap: 6 },
  navHit: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt,
  },
  weekStrip: { flexDirection: "row", gap: 4 },
  weekCell: {
    flex: 1,
    alignItems: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: 14,
  },
  weekCellSel: { backgroundColor: colors.primaryDark },
  weekDow: { fontSize: 11, fontWeight: "600", color: colors.textLight },
  weekDowActive: { color: colors.primary, fontWeight: "700" },
  weekDowSel: { color: "#a7f3d0" },
  dateNum: { fontSize: 16, fontWeight: "700", color: colors.text },
  dateNumSel: { color: colors.white },
  dateNumToday: { color: colors.primary },
  eventDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "transparent" },
  eventDotOn: { backgroundColor: colors.primary },
  eventDotSel: { backgroundColor: colors.accent },

  planCard: {
    marginTop: 16,
    padding: 16,
    ...design.card,
    backgroundColor: "#f7fcf9",
    borderColor: colors.primaryMuted,
  },
  planHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  planIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  planLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.primaryDark,
  },
  planBody: { fontSize: 13.5, color: colors.text, lineHeight: 21 },

  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: { ...design.sectionTitle },
  sectionMeta: { ...design.caption, fontWeight: "600" },

  timelineRow: { flexDirection: "row", gap: 10 },
  timeCol: { width: 56, alignItems: "flex-end", paddingTop: 16 },
  timeText: { fontSize: 11.5, fontWeight: "700", color: colors.textSub },
  timeLine: {
    position: "absolute",
    right: -6,
    top: 38,
    bottom: -6,
    width: 1,
    backgroundColor: colors.border,
  },
  timelineCard: { flex: 1, borderLeftWidth: 3 },
  taskCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    marginBottom: 10,
    ...design.card,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  taskTitle: { ...design.cardTitle, fontSize: 14.5 },
  taskDone: { textDecorationLine: "line-through", color: colors.textMuted },
  taskMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  taskDetail: { ...design.caption, flexShrink: 1 },
  trashBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt,
  },
  upList: { ...design.card, paddingHorizontal: 14 },
  upRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
  upDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  upDate: {
    width: 46,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  upDay: { fontSize: 17, lineHeight: 20, fontWeight: "800" },
  upMonth: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  upType: { fontSize: 12, fontWeight: "700" },
  emptyDay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  empty: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    borderRadius: 30,
    ...elevation.brand,
  },
  fabInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
  },

  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  sheetBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
  },
  sheetCard: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 28 : 20,
    maxHeight: "88%",
    ...design.sheet,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 14,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  sheetSub: { ...design.caption, marginTop: 2 },
  modalTitle: { ...design.sectionTitle },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    marginTop: -4,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.textSub,
    marginBottom: 7,
  },
  input: { lineHeight: 22, marginBottom: 14, ...design.input, backgroundColor: colors.bg },
  askInput: { height: 110, textAlignVertical: "top" },
  inputError: { borderColor: FIELD_ERROR_COLOR, borderWidth: 1.2 },
  fieldError: { marginTop: -8, marginBottom: 12 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  typeChip: { ...design.chip, minHeight: 34, paddingVertical: 6 },
  typeChipText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.textSub,
    textTransform: "capitalize",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  cancel: {
    paddingHorizontal: 18,
    height: 46,
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
  },
  cancelText: { fontSize: 14, fontWeight: "700", color: colors.textSub },
  micPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
  },
  micPillOn: { backgroundColor: colors.primary },
  micPillText: { fontSize: 13.5, fontWeight: "700", color: colors.primary },
  save: {
    paddingHorizontal: 20,
    height: 46,
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    ...elevation.brand,
  },
  saveText: { color: colors.white, fontWeight: "700", fontSize: 14 },
});
