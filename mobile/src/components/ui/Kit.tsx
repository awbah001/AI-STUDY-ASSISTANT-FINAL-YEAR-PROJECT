import type { ReactNode } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, gradients } from "../../theme/colors";
import { design, elevation, radius } from "../../theme/design";
import { ICON_TONES, solidIcon, toneForIcon, withAlpha, type IconToneName } from "./icons";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** Emerald gradient surface with soft decorative rings. */
export function HeroGradient({
  children,
  style,
  colors: stops = gradients.hero,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  colors?: readonly [string, string, ...string[]];
}) {
  return (
    <LinearGradient
      colors={stops}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[k.hero, style]}
    >
      <View pointerEvents="none" style={k.ringLg} />
      <View pointerEvents="none" style={k.ringSm} />
      <View pointerEvents="none" style={k.glow} />
      {children}
    </LinearGradient>
  );
}

/** Row of headline numbers on the brand gradient. */
export function StatBanner({
  items,
  style,
}: {
  items: { value: string | number; label: string; highlight?: boolean }[];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <HeroGradient style={[k.statBanner, style]}>
      {items.map((item, i) => (
        <View key={item.label} style={k.statBannerRow}>
          {i > 0 ? <View style={k.statBannerDivider} /> : null}
          <View style={k.statBannerItem}>
            <Text style={[k.statBannerValue, item.highlight && { color: colors.accent }]}>
              {item.value}
            </Text>
            <Text style={k.statBannerLabel}>{item.label}</Text>
          </View>
        </View>
      ))}
    </HeroGradient>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  eyebrow,
  right,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  right?: ReactNode;
}) {
  return (
    <View style={k.header}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        {eyebrow ? <Text style={k.eyebrow}>{eyebrow}</Text> : null}
        <Text style={k.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text style={k.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={k.headerRight}>{right}</View> : null}
    </View>
  );
}

export function HeaderIconButton({
  icon,
  onPress,
  badge,
  label,
}: {
  icon: IconName;
  onPress: () => void;
  badge?: number;
  label: string;
}) {
  return (
    <TouchableOpacity
      style={k.iconBtn}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.75}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
      {badge && badge > 0 ? (
        <View style={k.badge}>
          <Text style={k.badgeText}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[k.section, style]}>
      <Text style={k.sectionTitle}>{title}</Text>
      {action && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={10} style={k.sectionAction}>
          <Text style={k.sectionActionText}>{action}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function IconTile({
  icon,
  color: colorProp,
  bg: bgProp,
  size = 44,
  iconSize,
  tone,
}: {
  icon: IconName;
  color?: string;
  bg?: string;
  size?: number;
  iconSize?: number;
  tone?: IconToneName;
}) {
  const auto = tone
    ? ICON_TONES[tone]
    : colorProp == null && bgProp == null
      ? toneForIcon(String(icon))
      : null;
  const color = colorProp ?? auto?.fg ?? colors.primary;
  const bg = bgProp ?? auto?.bg ?? colors.primaryLight;
  return (
    <View
      style={[
        k.iconTile,
        {
          width: size,
          height: size,
          borderRadius: size * 0.32,
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: withAlpha(color, 0.16),
        },
      ]}
    >
      <Ionicons name={solidIcon(icon)} size={iconSize ?? Math.round(size * 0.45)} color={color} />
    </View>
  );
}

export function ProgressBar({
  value,
  color = colors.primary,
  track = colors.primaryLight,
  height = 6,
}: {
  value: number;
  color?: string;
  track?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={[k.track, { height, borderRadius: height, backgroundColor: track }]}>
      <View
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: height,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function Pill({
  label,
  color = colors.primary,
  bg = colors.primaryLight,
  icon,
}: {
  label: string;
  color?: string;
  bg?: string;
  icon?: IconName;
}) {
  return (
    <View style={[k.pill, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={11} color={color} /> : null}
      <Text style={[k.pillText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function EmptyCard({
  icon,
  title,
  body,
  action,
  onAction,
}: {
  icon: IconName;
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={k.empty}>
      <IconTile icon={icon} size={56} />
      <Text style={k.emptyTitle}>{title}</Text>
      {body ? <Text style={k.emptyBody}>{body}</Text> : null}
      {action && onAction ? (
        <TouchableOpacity style={k.emptyBtn} onPress={onAction} activeOpacity={0.85}>
          <Text style={k.emptyBtnText}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const k = StyleSheet.create({
  hero: {
    borderRadius: radius.xl,
    overflow: "hidden",
    ...elevation.md,
  },
  ringLg: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    right: -90,
    top: -110,
  },
  ringSm: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    right: -20,
    top: -40,
  },
  glow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(52,211,153,0.10)",
    left: -60,
    bottom: -90,
  },
  statBanner: { flexDirection: "row", paddingVertical: 20, paddingHorizontal: 8 },
  statBannerRow: { flex: 1, flexDirection: "row", alignItems: "center" },
  statBannerDivider: { width: 1, height: 34, backgroundColor: "rgba(255,255,255,0.14)" },
  statBannerItem: { flex: 1, alignItems: "center", gap: 3 },
  statBannerValue: {
    fontSize: 26,
    lineHeight: 31,
    fontWeight: "800",
    letterSpacing: -0.8,
    color: colors.white,
    fontVariant: ["tabular-nums"],
  },
  statBannerLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#a7d8c6",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  eyebrow: { ...design.eyebrow, color: colors.primary, marginBottom: 6 },
  title: { ...design.screenTitle },
  subtitle: { ...design.caption, fontSize: 13.5, lineHeight: 20, marginTop: 4 },
  iconBtn: { ...design.iconButton, borderRadius: 22 },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.white,
  },
  badgeText: { fontSize: 9, fontWeight: "800", color: colors.white },
  section: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { ...design.sectionTitle },
  sectionAction: { flexDirection: "row", alignItems: "center", gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: "700", color: colors.primary },
  iconTile: { alignItems: "center", justifyContent: "center" },
  track: { width: "100%", overflow: "hidden" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  pillText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  empty: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 8,
    ...design.card,
  },
  emptyTitle: { ...design.cardTitle, marginTop: 6, textAlign: "center" },
  emptyBody: { ...design.caption, textAlign: "center", maxWidth: 260 },
  emptyBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  emptyBtnText: { color: colors.white, fontWeight: "700", fontSize: 13 },
});
