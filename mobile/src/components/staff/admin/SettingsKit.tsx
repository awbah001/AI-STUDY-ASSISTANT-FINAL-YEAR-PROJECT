import { design } from "../../../theme/design";
import { useEffect, useState, type ReactNode } from "react";
import {
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors } from "../../../theme/colors";
import { Badge, Card, FormField, PrimaryButton } from "../StaffUi";
import { InlineButton, Sheet } from "./AdminKit";
import type { RouterOutputs } from "../lecturer-workspace/helpers";

export type SettingsBundle = RouterOutputs["admin"]["settings"]["get"];
export type SystemSettings = SettingsBundle["settings"];
export type SettingsMe = SettingsBundle["me"];
export type SaveSettings = (patch: Record<string, unknown>) => void;

export const monoFont = Platform.select({ ios: "Menlo", default: "monospace" });

export function useDraft<T>(source: T) {
  const key = JSON.stringify(source);
  const [draft, setDraft] = useState<T>(source);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setDraft(source), [key]);
  const set = <K extends keyof T>(field: K, value: T[K]) =>
    setDraft(prev => ({ ...prev, [field]: value }));
  return {
    draft,
    set,
    dirty: JSON.stringify(draft) !== key,
    reset: () => setDraft(source),
  };
}

export function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card style={st.card}>
      <Text style={st.cardTitle}>{title}</Text>
      {description ? <Text style={st.cardBody}>{description}</Text> : null}
      <View style={{ marginTop: 12 }}>{children}</View>
    </Card>
  );
}

export function TextSetting({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  hint,
  maxLength,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  hint?: string;
  maxLength?: number;
  error?: string | null;
}) {
  return (
    <>
      <FormField
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        multiline={multiline}
        autoCapitalize="none"
        maxLength={maxLength}
        error={error}
      />
      {hint ? <Text style={st.hint}>{hint}</Text> : null}
    </>
  );
}

export function NumberSetting({
  label,
  value,
  onChange,
  decimal,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  decimal?: boolean;
  hint?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={st.label}>{label}</Text>
      <TextInput
        style={st.input}
        value={text}
        keyboardType={decimal ? "decimal-pad" : "number-pad"}
        onChangeText={next => {
          setText(next);
          const parsed = decimal ? parseFloat(next) : parseInt(next, 10);
          if (!Number.isNaN(parsed)) onChange(parsed);
        }}
      />
      {hint ? <Text style={[st.hint, { marginTop: 4 }]}>{hint}</Text> : null}
    </View>
  );
}

export function ToggleSetting({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={st.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={st.toggleLabel}>{label}</Text>
        {hint ? <Text style={st.toggleHint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.white}
      />
    </View>
  );
}

export function SaveBar({
  dirty,
  saving,
  onSave,
  onReset,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <View style={st.saveBar}>
      {dirty ? (
        <View style={st.discard}>
          <View style={st.unsavedPill}>
            <View style={st.unsavedDot} />
            <Text style={st.unsaved}>Unsaved changes</Text>
          </View>
          <InlineButton
            label="Discard"
            icon="close"
            tone="muted"
            onPress={onReset}
          />
        </View>
      ) : null}
      <PrimaryButton
        label="Save changes"
        icon="save-outline"
        loading={saving}
        disabled={!dirty}
        onPress={onSave}
      />
    </View>
  );
}

const STATUS_TONE: Record<
  string,
  { label: string; tone: "green" | "amber" | "red" | "grey" }
> = {
  operational: { label: "Operational", tone: "green" },
  connected: { label: "Connected", tone: "green" },
  warning: { label: "Warning", tone: "amber" },
  degraded: { label: "Degraded", tone: "amber" },
  not_connected: { label: "Not connected", tone: "grey" },
  misconfigured: { label: "Misconfigured", tone: "red" },
  unavailable: { label: "Unavailable", tone: "red" },
  error: { label: "Error", tone: "red" },
};

export function StatusRow({
  label,
  status,
  detail,
}: {
  label: string;
  status: string;
  detail?: string | null;
}) {
  const meta = STATUS_TONE[status] ?? { label: status, tone: "grey" as const };
  return (
    <View style={st.statusRow}>
      <View style={{ flex: 1 }}>
        <Text style={st.toggleLabel}>{label}</Text>
        {detail ? (
          <Text style={st.toggleHint} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Badge label={meta.label} tone={meta.tone} />
    </View>
  );
}

export function ConfirmSheet({
  visible,
  title,
  hint,
  word,
  confirmLabel,
  loading,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  hint: string;
  word: string;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (visible) setTyped("");
  }, [visible]);
  return (
    <Sheet
      visible={visible}
      title={title}
      hint={hint}
      onClose={onClose}
      cancelLabel="Cancel"
    >
      <FormField
        label={`Type ${word} to confirm`}
        value={typed}
        onChangeText={setTyped}
        placeholder={word}
        autoCapitalize="none"
      />
      <PrimaryButton
        label={confirmLabel}
        variant="danger"
        loading={loading}
        disabled={typed.trim() !== word}
        onPress={onConfirm}
      />
    </Sheet>
  );
}

const st = StyleSheet.create({
  card: { marginBottom: 14, ...design.card },
  cardTitle: { ...design.sectionTitle, fontSize: 16 },
  cardBody: { marginTop: 4, ...design.caption, fontSize: 13 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 6,
  },
  input: { ...design.input },
  hint: { marginTop: -6, marginBottom: 12, ...design.caption },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  toggleLabel: { fontSize: 14, fontWeight: "600", color: colors.text },
  toggleHint: { marginTop: 2, ...design.caption },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  saveBar: { marginTop: 8 },
  discard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  unsavedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: colors.warningSoft,
  },
  unsavedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.warning,
  },
  unsaved: { fontSize: 12, fontWeight: "700", color: "#b45309" },
});
