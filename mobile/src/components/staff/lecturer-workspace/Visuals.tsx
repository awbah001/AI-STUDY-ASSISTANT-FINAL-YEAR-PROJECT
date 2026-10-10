import { design } from "../../../theme/design";
import { useStaffStyles } from "../../../contexts/StaffAppearance";
import { Image, StyleSheet, Text, View } from "react-native";
import { colors } from "../../../theme/colors";
import { resolveAvatarUri } from "../../../lib/uploadAvatar";
import { initials } from "./helpers";

const TONES = [
  { bg: "#e8f5ee", fg: colors.primary },
  { bg: "#eff6ff", fg: "#2563eb" },
  { bg: colors.burgundySoft, fg: colors.burgundy },
];

export function Avatar({
  name,
  url,
  size = 40,
  index = 0,
}: {
  name: string | null | undefined;
  url?: string | null;
  size?: number;
  index?: number;
}) {
  const st = useStaffStyles(baseStyles);

  const dims = { width: size, height: size, borderRadius: size / 2 };
  if (url)
    return <Image source={{ uri: resolveAvatarUri(url) }} style={dims} />;
  const tone = TONES[index % TONES.length];
  return (
    <View style={[st.avatar, dims, { backgroundColor: tone.bg }]}>
      <Text
        style={[
          st.avatarText,
          { color: tone.fg, fontSize: Math.round(size * 0.36) },
        ]}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

export function BarRow({
  label,
  value,
  max,
  color = colors.primary,
  display,
  sublabel,
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
  display?: string;
  sublabel?: string | null;
}) {
  const st = useStaffStyles(baseStyles);

  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <View style={st.barRow}>
      <View style={st.barHead}>
        <Text style={st.barLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[st.barValue, { color }]}>{display ?? String(value)}</Text>
      </View>
      <View style={[st.barTrack, { backgroundColor: `${color}1f` }]}>
        <View
          style={[st.barFill, { width: `${pct}%`, backgroundColor: color }]}
        />
      </View>
      {sublabel ? <Text style={st.barSub}>{sublabel}</Text> : null}
    </View>
  );
}

export function MiniBar({
  label,
  value,
  max,
  color,
  display,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  display: string;
}) {
  const st = useStaffStyles(baseStyles);

  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <View style={st.miniRow}>
      <Text style={st.miniLabel}>{label}</Text>
      <View style={st.miniTrack}>
        <View
          style={[st.miniFill, { width: `${pct}%`, backgroundColor: color }]}
        />
      </View>
      <Text style={st.miniValue}>{display}</Text>
    </View>
  );
}

export function Legend({
  items,
}: {
  items: Array<{ label: string; color: string }>;
}) {
  const st = useStaffStyles(baseStyles);

  return (
    <View style={st.legend}>
      {items.map(item => (
        <View key={item.label} style={st.legendItem}>
          <View style={[st.legendDot, { backgroundColor: item.color }]} />
          <Text style={st.legendText}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function KeyValue({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  const st = useStaffStyles(baseStyles);

  return (
    <View style={st.kv}>
      <Text style={st.kvValue}>{value}</Text>
      <Text style={st.kvLabel}>{label}</Text>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center" },
  avatarText: { fontWeight: "800" },
  barRow: { marginBottom: 14 },
  barHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  barLabel: { flex: 1, ...design.cardTitle },
  barValue: { fontSize: 14, fontWeight: "800" },
  barTrack: { height: 8, borderRadius: 4, marginTop: 8, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  barSub: { marginTop: 6, ...design.caption },
  miniRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  miniLabel: {
    width: 78,
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
  miniTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderLight,
    overflow: "hidden",
  },
  miniFill: { height: 6, borderRadius: 3 },
  miniValue: {
    width: 46,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSub,
  },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginBottom: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, fontWeight: "600", color: colors.textSub },
  kv: {
    flexGrow: 1,
    flexBasis: "30%",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  kvValue: { ...design.metric },
  kvLabel: { fontWeight: "600", marginTop: 2, ...design.caption },
});
