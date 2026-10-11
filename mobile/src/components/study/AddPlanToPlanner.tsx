import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { trpc } from "../../lib/api";
import { friendlyError } from "../../lib/friendlyError";
import { notificationsAllowed, registerForPushNotifications, scheduleCalendarReminders } from "../../lib/notifications";
import { colors } from "../../theme/colors";
import { design, radius } from "../../theme/design";
import {
  fromLocalParts,
  looksLikeStudyPlan,
  PLAN_LIMITS,
  PLAN_SAVED_PATTERN,
  PLAN_SESSION_TYPES,
  planSessionError,
  WEEKDAYS,
  type PlanSessionDraft,
} from "../../../../shared/studyPlan";

const TYPE_LABEL = { study: "Study", quiz: "Quiz", test: "Test", exam: "Exam", other: "Other" } as const;

const clampMinutes = (value: number) =>
  Math.min(PLAN_LIMITS.duration.max, Math.max(PLAN_LIMITS.duration.min, Math.round(value) || 60));

function weekdayOf(date: string, time: string, tzOffset: number) {
  const at = fromLocalParts(date, time, tzOffset);
  return at === null ? null : WEEKDAYS[new Date(at - tzOffset * 60_000).getUTCDay()];
}

/** "Add to planner" chip under an Ask AI reply, with an editable preview before saving. */
export function AddPlanToPlanner({ content }: { content: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PlanSessionDraft[]>([]);
  const [tzOffset] = useState(() => new Date().getTimezoneOffset());
  const [saved, setSaved] = useState(false);

  const draft = trpc.planner.draftFromText.useMutation({
    onSuccess: (data) => {
      setRows(data.sessions);
      setOpen(true);
    },
    onError: (error) => Alert.alert("Couldn't read this plan", friendlyError(error.message, "Please try again.")),
  });
  const save = trpc.planner.savePlan.useMutation({
    onSuccess: async (result) => {
      setSaved(true);
      setOpen(false);
      void utils.planner.invalidate();
      await registerForPushNotifications();
      const allowed = await notificationsAllowed();
      if (result.events.length) await scheduleCalendarReminders(result.events);
      Alert.alert(
        "Added to your planner",
        `${result.created} session${result.created === 1 ? "" : "s"} saved.${
          allowed ? " You'll get a reminder before each one." : " Allow notifications in Settings to get reminders."
        }`,
        [
          { text: "Stay here", style: "cancel" },
          { text: "Open planner", onPress: () => router.push("/(tabs)/planner") },
        ]
      );
    },
    onError: (error) => Alert.alert("Couldn't save the plan", friendlyError(error.message, "Please try again.")),
  });

  if (PLAN_SAVED_PATTERN.test(content) || saved) {
    return (
      <TouchableOpacity style={s.chip} onPress={() => router.push("/(tabs)/planner")} hitSlop={6}>
        <Ionicons name="calendar" size={12} color={colors.primary} />
        <Text style={s.chipText}>Open planner</Text>
      </TouchableOpacity>
    );
  }
  if (!looksLikeStudyPlan(content)) return null;

  const errors = rows.map((row) => planSessionError(row, tzOffset));
  const firstError = errors.findIndex(Boolean);
  const update = (index: number, patch: Partial<PlanSessionDraft>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const confirm = () => {
    if (!rows.length) return Alert.alert("Nothing to save", "Keep at least one session.");
    if (firstError >= 0) return Alert.alert(`Check session ${firstError + 1}`, errors[firstError]!);
    save.mutate({
      sessions: rows.map((row) => ({
        title: row.title.trim(),
        type: row.type,
        startsAt: fromLocalParts(row.date, row.time, tzOffset)!,
        durationMinutes: clampMinutes(row.durationMinutes),
        notes: row.notes.trim() || undefined,
      })),
    });
  };

  return (
    <>
      <TouchableOpacity
        style={s.chip}
        disabled={draft.isPending}
        hitSlop={6}
        accessibilityLabel="Add this plan to your study planner"
        onPress={() => {
          if (rows.length) setOpen(true);
          else draft.mutate({ text: content.slice(0, PLAN_LIMITS.text.max), timezoneOffset: tzOffset });
        }}
      >
        {draft.isPending ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ transform: [{ scale: 0.6 }] }} />
        ) : (
          <Ionicons name="calendar-outline" size={12} color={colors.primary} />
        )}
        <Text style={s.chipText}>{draft.isPending ? "Reading plan..." : "Add to planner"}</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => !save.isPending && setOpen(false)}
      >
        <SafeAreaView style={s.sheet} edges={["top", "bottom"]}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Add to study planner</Text>
              <Text style={s.caption}>Check each session, edit anything you like, then save.</Text>
            </View>
            <TouchableOpacity
              style={s.close}
              onPress={() => setOpen(false)}
              disabled={save.isPending}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView contentContainerStyle={s.list} keyboardShouldPersistTaps="handled">
              {rows.map((row, index) => {
                const weekday = weekdayOf(row.date, row.time, tzOffset);
                return (
                  <View key={index} style={[s.card, errors[index] && s.cardError]}>
                    <View style={s.cardHead}>
                      <Text style={s.cardIndex}>
                        Session {index + 1}
                        {weekday ? ` · ${weekday}` : ""}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setRows((current) => current.filter((_, i) => i !== index))}
                        hitSlop={8}
                        accessibilityLabel={`Remove session ${index + 1}`}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={s.input}
                      value={row.title}
                      maxLength={PLAN_LIMITS.title.max}
                      placeholder="Session title"
                      placeholderTextColor={colors.textLight}
                      onChangeText={(title) => update(index, { title })}
                    />
                    <View style={s.types}>
                      {PLAN_SESSION_TYPES.map((type) => {
                        const active = row.type === type;
                        return (
                          <TouchableOpacity
                            key={type}
                            style={[s.type, active && s.typeActive]}
                            onPress={() => update(index, { type })}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: active }}
                          >
                            <Text style={[s.typeText, active && s.typeTextActive]}>{TYPE_LABEL[type]}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <View style={s.row}>
                      <View style={{ flex: 1.4 }}>
                        <Text style={s.label}>Date</Text>
                        <TextInput
                          style={s.input}
                          value={row.date}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={colors.textLight}
                          maxLength={10}
                          keyboardType="numbers-and-punctuation"
                          onChangeText={(date) => update(index, { date })}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.label}>Time</Text>
                        <TextInput
                          style={s.input}
                          value={row.time}
                          placeholder="18:00"
                          placeholderTextColor={colors.textLight}
                          maxLength={5}
                          keyboardType="numbers-and-punctuation"
                          onChangeText={(time) => update(index, { time })}
                        />
                      </View>
                      <View style={{ flex: 0.9 }}>
                        <Text style={s.label}>Minutes</Text>
                        <TextInput
                          style={s.input}
                          value={row.durationMinutes ? String(row.durationMinutes) : ""}
                          maxLength={3}
                          keyboardType="number-pad"
                          onChangeText={(text) => update(index, { durationMinutes: Number(text.replace(/\D/g, "")) || 0 })}
                          onBlur={() => update(index, { durationMinutes: clampMinutes(row.durationMinutes) })}
                        />
                      </View>
                    </View>
                    <TextInput
                      style={[s.input, s.notes]}
                      value={row.notes}
                      maxLength={PLAN_LIMITS.notes}
                      placeholder="What to do (optional)"
                      placeholderTextColor={colors.textLight}
                      multiline
                      onChangeText={(notes) => update(index, { notes })}
                    />
                    {errors[index] ? <Text style={s.error}>{errors[index]}</Text> : null}
                  </View>
                );
              })}
              {!rows.length ? <Text style={[s.caption, { textAlign: "center" }]}>No sessions left.</Text> : null}
            </ScrollView>
          </KeyboardAvoidingView>

          <View style={s.footer}>
            <TouchableOpacity
              style={[s.save, (save.isPending || !rows.length || firstError >= 0) && { opacity: 0.6 }]}
              disabled={save.isPending || !rows.length}
              onPress={confirm}
              activeOpacity={0.85}
            >
              {save.isPending ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Ionicons name="calendar" size={18} color={colors.white} />
              )}
              <Text style={s.saveText}>
                Save {rows.length} session{rows.length === 1 ? "" : "s"}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 24,
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
  },
  chipText: { fontSize: 11.5, fontWeight: "700", color: colors.primary },
  sheet: { flex: 1, ...design.page },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { ...design.cardTitle, fontSize: 17 },
  caption: { ...design.caption },
  close: { ...design.iconButton, width: 38, height: 38, borderRadius: 19 },
  list: { padding: 16, gap: 12 },
  card: { ...design.card, padding: 14, gap: 10 },
  cardError: { borderColor: colors.error },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardIndex: { fontSize: 12, fontWeight: "700", color: colors.textSub, letterSpacing: 0.3 },
  input: { ...design.input, minHeight: 42, paddingVertical: 8, fontSize: 14 },
  notes: { minHeight: 64, textAlignVertical: "top" },
  label: { fontSize: 11.5, fontWeight: "600", color: colors.textMuted, marginBottom: 4 },
  row: { flexDirection: "row", gap: 8 },
  types: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  type: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  typeActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  typeText: { fontSize: 12.5, fontWeight: "600", color: colors.textSub },
  typeTextActive: { color: colors.white },
  error: { fontSize: 12, color: colors.error },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  save: { ...design.action, flexDirection: "row", gap: 8 },
  saveText: { ...design.actionText },
});
