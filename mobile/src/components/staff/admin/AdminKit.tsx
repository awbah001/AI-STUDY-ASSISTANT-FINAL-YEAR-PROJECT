import { design } from "../../../theme/design";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
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
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../theme/colors";
import { FormField, PrimaryButton } from "../StaffUi";
import { FIELD_ERROR_COLOR, FieldError } from "../../FieldError";
import { LIMITS, validateText } from "../../../lib/validation";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export function useScreenFocused() {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );
  return focused;
}

export function formatBytes(bytes: number | null | undefined) {
  const value = bytes ?? 0;
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(value / 1024)} KB`;
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function timeAgo(value: Date | string) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function Sheet({
  visible,
  title,
  hint,
  onClose,
  children,
  cancelLabel = "Close",
}: {
  visible: boolean;
  title: string;
  hint?: string | null;
  onClose: () => void;
  children: ReactNode;
  cancelLabel?: string;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={st.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity
          style={st.dismissArea}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel="Close sheet"
        />
        <View style={st.sheet}>
          <View style={st.grabber} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={st.sheetTitle}>{title}</Text>
            {hint ? (
              <Text style={st.sheetHint}>{hint}</Text>
            ) : (
              <View style={{ height: 14 }} />
            )}
            {children}
            <TouchableOpacity style={st.cancel} onPress={onClose}>
              <Text style={st.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function ReasonForm({
  confirmLabel,
  variant = "solid",
  loading,
  initialReason = "",
  disabled,
  placeholder = "At least 3 characters",
  onSubmit,
  resetKey,
}: {
  confirmLabel: string;
  variant?: "solid" | "outline" | "danger";
  loading?: boolean;
  initialReason?: string;
  disabled?: boolean;
  placeholder?: string;
  onSubmit: (reason: string) => void;
  resetKey?: unknown;
}) {
  const [reason, setReason] = useState(initialReason);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setReason(initialReason);
    setError(null);
  }, [initialReason, resetKey]);
  return (
    <>
      <FormField
        label="Reason (saved to the audit log)"
        value={reason}
        onChangeText={v => {
          setReason(v);
          setError(null);
        }}
        placeholder={placeholder}
        multiline
        maxLength={LIMITS.reason.max}
        error={error}
      />
      <PrimaryButton
        label={confirmLabel}
        variant={variant}
        loading={loading}
        disabled={disabled}
        onPress={() => {
          const message = validateText(reason, { label: "Reason", ...LIMITS.reason });
          setError(message);
          if (!message) onSubmit(reason.trim());
        }}
      />
    </>
  );
}

export function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  error?: string | null;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={st.fieldLabel}>{label}</Text>
      <View style={[st.passwordWrap, error ? { borderColor: FIELD_ERROR_COLOR } : null]}>
        <TextInput
          style={st.passwordInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textLight}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          onPress={() => setVisible(v => !v)}
          hitSlop={10}
          accessibilityLabel={visible ? "Hide password" : "Show password"}
        >
          <Ionicons
            name={visible ? "eye-off-outline" : "eye-outline"}
            size={20}
            color={colors.textMuted}
          />
        </TouchableOpacity>
      </View>
      <FieldError message={error} />
    </View>
  );
}

export function SearchBox({
  value,
  onChangeText,
  placeholder,
  onSubmit,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  onSubmit?: () => void;
}) {
  return (
    <View style={st.search}>
      <Ionicons name="search" size={18} color={colors.textLight} />
      <TextInput
        style={st.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
      />
      {value ? (
        <TouchableOpacity
          onPress={() => onChangeText("")}
          hitSlop={10}
          accessibilityLabel="Clear search"
        >
          <Ionicons name="close-circle" size={18} color={colors.textLight} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function FilterLabel({ children }: { children: string }) {
  return <Text style={st.filterLabel}>{children}</Text>;
}

export function Pager({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <View style={st.pagerWrap}>
      <Text style={st.pagerSummary}>
        Showing {from}–{to} of {total}
      </Text>
      {totalPages > 1 ? (
        <View style={st.pager}>
          <TouchableOpacity
            disabled={page <= 1}
            onPress={() => onChange(page - 1)}
            style={[st.pageBtn, page <= 1 && st.off]}
            accessibilityLabel="Previous page"
          >
            <Ionicons name="chevron-back" size={16} color={colors.primary} />
            <Text style={st.pageText}>Prev</Text>
          </TouchableOpacity>
          <Text style={st.pageInfo}>
            Page {page} of {totalPages}
          </Text>
          <TouchableOpacity
            disabled={page >= totalPages}
            onPress={() => onChange(page + 1)}
            style={[st.pageBtn, page >= totalPages && st.off]}
            accessibilityLabel="Next page"
          >
            <Text style={st.pageText}>Next</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

export function DetailRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger";
}) {
  return (
    <View style={st.detailRow}>
      <Text style={st.detailLabel}>{label}</Text>
      <Text
        style={[st.detailValue, tone === "danger" && { color: colors.error }]}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

export function ActionRow({
  icon,
  label,
  hint,
  onPress,
  danger,
  disabled,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const tint = danger ? colors.error : colors.primary;
  return (
    <TouchableOpacity
      style={[st.actionRow, disabled && st.off]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <View
        style={[
          st.actionIcon,
          { backgroundColor: danger ? colors.errorSoft : colors.primaryLight },
        ]}
      >
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[st.actionLabel, danger && { color: colors.error }]}>
          {label}
        </Text>
        {hint ? <Text style={st.actionHint}>{hint}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
    </TouchableOpacity>
  );
}

export function MetricTile({
  icon,
  label,
  value,
  hint,
  accent,
  accentBg,
  onPress,
}: {
  icon: IconName;
  label: string;
  value: string | number;
  hint?: string;
  accent: string;
  accentBg: string;
  onPress?: () => void;
}) {
  const body = (
    <>
      <View style={st.metricTop}>
        <View style={[st.metricIcon, { backgroundColor: accentBg }]}>
          <Ionicons name={icon} size={17} color={accent} />
        </View>
        {onPress ? (
          <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
        ) : null}
      </View>
      <Text style={st.metricValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={st.metricLabel} numberOfLines={1}>
        {label}
      </Text>
      {hint ? (
        <Text style={st.metricHint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </>
  );
  return onPress ? (
    <TouchableOpacity style={st.metric} onPress={onPress} activeOpacity={0.8}>
      {body}
    </TouchableOpacity>
  ) : (
    <View style={st.metric}>{body}</View>
  );
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return <View style={st.metricGrid}>{children}</View>;
}

export function MiniBars({
  values,
  labels,
  color,
  height = 120,
}: {
  values: number[];
  labels: string[];
  color: string;
  height?: number;
}) {
  const max = Math.max(1, ...values);
  return (
    <View>
      <View style={st.barsHead}>
        <Text style={st.barsAxis}>max {max}</Text>
      </View>
      <View style={[st.bars, { height }]}>
        {values.map((value, index) => (
          <View key={`${labels[index]}-${index}`} style={st.barSlot}>
            <View
              style={[
                st.bar,
                {
                  height: value ? Math.max(3, (value / max) * height) : 2,
                  backgroundColor: value ? color : colors.borderLight,
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={st.barsFoot}>
        <Text style={st.barsAxis}>{labels[0] ?? ""}</Text>
        <Text style={st.barsAxis}>
          {labels[Math.floor(labels.length / 2)] ?? ""}
        </Text>
        <Text style={st.barsAxis}>{labels[labels.length - 1] ?? ""}</Text>
      </View>
    </View>
  );
}

export function ScoreBar({
  value,
  color = colors.primary,
}: {
  value: number;
  color?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={st.scoreTrack}>
      <View
        style={[st.scoreFill, { width: `${pct}%`, backgroundColor: color }]}
      />
    </View>
  );
}

export function scoreColor(score: number) {
  if (score >= 70) return colors.success;
  if (score >= 50) return "#d97706";
  return colors.error;
}

export type PickOption = {
  id: number;
  title: string;
  subtitle?: string | null;
};

export function OptionPicker({
  options,
  value,
  onChange,
  emptyText,
  excludeId,
}: {
  options: PickOption[];
  value: number | null;
  onChange: (id: number) => void;
  emptyText: string;
  excludeId?: number | null;
}) {
  const visible = options.filter(option => option.id !== excludeId);
  if (!visible.length) return <Text style={st.warn}>{emptyText}</Text>;
  return (
    <View style={st.picker}>
      <ScrollView
        nestedScrollEnabled
        style={{ maxHeight: 220 }}
        keyboardShouldPersistTaps="handled"
      >
        {visible.map(option => {
          const active = option.id === value;
          return (
            <TouchableOpacity
              key={option.id}
              style={[st.pickRow, active && st.pickRowActive]}
              onPress={() => onChange(option.id)}
            >
              <Ionicons
                name={active ? "radio-button-on" : "radio-button-off"}
                size={18}
                color={active ? colors.primary : colors.textLight}
              />
              <View style={{ flex: 1 }}>
                <Text style={st.pickTitle} numberOfLines={1}>
                  {option.title}
                </Text>
                {option.subtitle ? (
                  <Text style={st.pickSub} numberOfLines={1}>
                    {option.subtitle}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function InlineButton({
  label,
  icon,
  onPress,
  tone = "primary",
  disabled,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  tone?: "primary" | "danger" | "muted";
  disabled?: boolean;
}) {
  const color =
    tone === "danger"
      ? colors.error
      : tone === "muted"
        ? colors.neutralGray
        : colors.primary;
  const bg =
    tone === "danger"
      ? colors.errorSoft
      : tone === "muted"
        ? colors.neutralGraySoft
        : colors.primaryLight;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[st.inline, { backgroundColor: bg }, disabled && st.off]}
      activeOpacity={0.8}
    >
      {icon ? <Ionicons name={icon} size={14} color={color} /> : null}
      <Text style={[st.inlineText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  dismissArea: { flex: 1 },
  sheet: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: "90%",
    ...design.sheet,
  },
  grabber: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  sheetTitle: { ...design.sectionTitle, fontSize: 20, lineHeight: 26 },
  sheetHint: { marginTop: 6, marginBottom: 14, ...design.body },
  cancel: { alignItems: "center", paddingVertical: 12, marginTop: 4 },
  cancelText: { fontSize: 15, fontWeight: "700", color: colors.textMuted },
  warn: { fontSize: 12, color: "#b45309", marginBottom: 10, lineHeight: 17 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSub,
    marginBottom: 6,
  },
  passwordWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    ...design.search,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    ...design.search,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  pagerWrap: { marginTop: 4, gap: 10 },
  pagerSummary: { fontSize: 12, color: colors.textMuted, textAlign: "center" },
  pager: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    ...design.chip,
  },
  off: { opacity: 0.4 },
  pageText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  pageInfo: { color: colors.textMuted, fontSize: 13 },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  detailLabel: { fontSize: 13, color: colors.textMuted },
  detailValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    textAlign: "right",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { ...design.cardTitle },
  actionHint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 22,
  },
  metric: { width: "47%", flexGrow: 1, padding: 14, ...design.card },
  metricTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: { ...design.metric },
  metricLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSub,
    marginTop: 2,
  },
  metricHint: { marginTop: 1, ...design.caption },
  barsHead: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  barSlot: { flex: 1, justifyContent: "flex-end" },
  bar: { width: "100%", borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  barsFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  barsAxis: { fontSize: 10, color: colors.textLight, fontWeight: "600" },
  scoreTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderLight,
    overflow: "hidden",
    marginTop: 8,
  },
  scoreFill: { height: 6, borderRadius: 3 },
  picker: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    marginBottom: 12,
    overflow: "hidden",
  },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  pickRowActive: { backgroundColor: colors.primaryLight },
  pickTitle: { ...design.cardTitle },
  pickSub: { marginTop: 1, ...design.caption },
  inline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  inlineText: { fontSize: 12, fontWeight: "700" },
});
