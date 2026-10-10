import { design } from "../../theme/design";
import {
  useStaffStyles,
  useStaffAppearance,
  useStaffColor,
} from "../../contexts/StaffAppearance";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { Tabs } from "expo-router";
import { colors, gradients } from "../../theme/colors";
import { FieldError, FIELD_ERROR_COLOR } from "../FieldError";
import { elevation } from "../../theme/design";
import { resolveAvatarUri } from "../../lib/uploadAvatar";
import { ICON_TONES, solidIcon, toneForIcon, withAlpha, type IconToneName } from "../ui/icons";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
// expo-router bundles its own bottom-tabs types, which differ from @react-navigation/bottom-tabs.
type TabOptions = Exclude<
  NonNullable<React.ComponentProps<typeof Tabs.Screen>["options"]>,
  (...args: any[]) => any
>;
type BottomTabBarButtonProps = Parameters<
  NonNullable<TabOptions["tabBarButton"]>
>[0];

const cognifyBot = require("../../../assets/cognify-auth-bot.png");

export const staffTabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.tabInactive,
  tabBarShowLabel: true,
  tabBarStyle: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    height: Platform.OS === "ios" ? 84 : 64,
    paddingBottom: Platform.OS === "ios" ? 24 : 8,
    paddingTop: 8,
    shadowColor: "#0b2a20",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 12,
  },
  tabBarLabelStyle: { fontSize: 11, fontWeight: "600" as const, marginTop: 1 },
};

export function tabIcon(active: IconName, inactive: IconName, toneName?: IconToneName) {
  const accent = toneName ? ICON_TONES[toneName].fg : null;
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <View
      style={{
        width: 52,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: focused
          ? accent
            ? withAlpha(accent, 0.14)
            : colors.primaryLight
          : "transparent",
        borderWidth: 1,
        borderColor: focused ? withAlpha(accent ?? colors.primary, 0.22) : "transparent",
      }}
    >
      <Ionicons
        name={focused ? active : inactive}
        size={focused ? 22 : 20}
        color={focused && accent ? accent : color}
      />
    </View>
  );
}

/** Tab options with an icon flavour; the active label matches the icon colour. */
export function toneTab(
  title: string,
  active: IconName,
  inactive: IconName,
  toneName: IconToneName
): TabOptions {
  return {
    title,
    tabBarIcon: tabIcon(active, inactive, toneName),
    tabBarActiveTintColor: ICON_TONES[toneName].fg,
  };
}

export function useWorkspaceTabOptions() {
  const insets = useSafeAreaInsets();
  const { colors: palette } = useStaffAppearance();
  return {
    ...staffTabScreenOptions,
    tabBarActiveTintColor: palette.tabActive,
    tabBarInactiveTintColor: palette.textMuted,
    tabBarLabelStyle: {
      fontSize: 10.5,
      fontWeight: "600" as const,
      marginTop: 4,
      letterSpacing: 0.1,
    },
    tabBarStyle: {
      ...staffTabScreenOptions.tabBarStyle,
      height: 68 + Math.max(insets.bottom, 10),
      paddingBottom: Math.max(insets.bottom, 10),
      paddingTop: 8,
      backgroundColor: palette.surface,
      borderTopColor: palette.borderLight,
    },
  };
}

/** Primary workspace destination, kept within the navigation bar with a visible label. */
export function centerTabOptions(title: string, icon: IconName): TabOptions {
  return {
    title,
    tabBarIcon: () => <Ionicons name={icon} size={24} color={colors.white} />,
    tabBarLabel: () => null,
    tabBarButton: (props: BottomTabBarButtonProps) => (
      <CenterTabButton icon={icon} label={title} props={props} />
    ),
  };
}

function CenterTabButton({
  icon,
  label,
  props,
}: {
  icon: IconName;
  label: string;
  props: BottomTabBarButtonProps;
}) {
  const { colors: palette } = useStaffAppearance();
  return (
    <TouchableOpacity
      onPress={props.onPress}
      onLongPress={props.onLongPress ?? undefined}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={props.accessibilityState}
      testID={props.testID}
      style={fabStyles.wrapper}
      activeOpacity={0.85}
    >
      <View style={[fabStyles.ring, { backgroundColor: palette.surface }]}>
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={fabStyles.fab}
        >
          <Ionicons name={icon} size={22} color={colors.white} />
        </LinearGradient>
      </View>
      <Text
        style={[
          fabStyles.label,
          props.accessibilityState?.selected && fabStyles.labelActive,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const fabStyles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
  },
  ring: {
    marginTop: -26,
    padding: 4,
    borderRadius: 32,
    backgroundColor: colors.white,
    ...elevation.brand,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 10.5, fontWeight: "600", color: colors.tabInactive },
  labelActive: { color: colors.primary },
});

export function StaffScreen({
  children,
  onRefresh,
}: {
  children: ReactNode;
  onRefresh?: () => Promise<unknown>;
}) {
  const s = useStaffStyles(baseStyles);

  const [refreshing, setRefreshing] = useState(false);
  const refresh = onRefresh
    ? async () => {
        setRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
        }
      }
    : undefined;
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          refresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.primary}
            />
          ) : undefined
        }
      >
        {children}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

export function StaffHeader({
  title,
  subtitle,
  avatarUrl,
  name,
  onAvatarPress,
}: {
  title: string;
  subtitle?: string;
  avatarUrl?: string | null;
  name?: string | null;
  onAvatarPress?: () => void;
}) {
  const s = useStaffStyles(baseStyles);

  return (
    <View style={s.header}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={s.headerEyebrow}>AI LEARNING ASSISTANT</Text>
        <Text style={s.title}>{title}</Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      </View>
      {onAvatarPress ? (
        <TouchableOpacity
          onPress={onAvatarPress}
          accessibilityLabel="Open profile"
          style={s.avatarRing}
        >
          {avatarUrl ? (
            <Image
              source={{ uri: resolveAvatarUri(avatarUrl) }}
              style={s.avatar}
            />
          ) : (
            <LinearGradient
              colors={gradients.hero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[s.avatar, s.avatarFallback]}
            >
              <Text style={s.avatarText}>
                {name?.charAt(0).toUpperCase() ?? "?"}
              </Text>
            </LinearGradient>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/**
 * Dark-green summary card with the assistant bot, matching the student
 * dashboard's "Today's study" card.
 */
export function HeroCard({
  eyebrow,
  title,
  body,
  stat,
  statUnit,
  progress,
  onPress,
}: {
  eyebrow: string;
  title: string;
  body: string;
  stat?: string | number;
  statUnit?: string;
  progress?: number;
  onPress?: () => void;
}) {
  const s = useStaffStyles(baseStyles);
  const pct =
    progress == null ? null : Math.max(0, Math.min(100, Math.round(progress)));

  const content = (
    <LinearGradient
      colors={gradients.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.heroInner}
    >
      <View pointerEvents="none" style={s.heroOrbit} />
      <View pointerEvents="none" style={s.heroOrbitSm} />
      <View pointerEvents="none" style={s.heroGlow} />
      <View style={s.heroContent}>
        <Text style={s.heroEyebrow}>{eyebrow}</Text>
        {stat != null ? (
          <View style={s.heroStatRow}>
            <Text style={s.heroStat}>{stat}</Text>
            {statUnit ? <Text style={s.heroStatUnit}>{statUnit}</Text> : null}
          </View>
        ) : null}
        <Text style={s.heroTitle}>{title}</Text>
        {pct != null ? (
          <View style={s.heroBarBg}>
            <View style={[s.heroBarFill, { width: `${pct}%` }]} />
          </View>
        ) : null}
        <View style={s.heroFooter}>
          <Text style={s.heroBody}>{body}</Text>
          {onPress ? (
            <View style={s.heroGo}>
              <Ionicons name="arrow-forward" size={16} color={colors.primaryDark} />
            </View>
          ) : null}
        </View>
      </View>
      <Image
        source={cognifyBot}
        style={s.heroBot}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </LinearGradient>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={s.hero} activeOpacity={0.9} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={s.hero}>{content}</View>;
}

export function StatGrid({ children }: { children: ReactNode }) {
  const s = useStaffStyles(baseStyles);

  return <View style={s.statGrid}>{children}</View>;
}

export function StatTile({
  icon,
  label,
  value,
  hint,
  accent = colors.primary,
  accentBg = colors.primaryLight,
}: {
  icon: IconName;
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
  accentBg?: string;
}) {
  const s = useStaffStyles(baseStyles);
  const tone = useStaffColor();
  const bg = tone(accentBg);

  return (
    <View style={s.statTile}>
      <View style={[s.statAccent, { backgroundColor: accent }]} />
      <View style={s.statTopRow}>
        <View style={[s.statIcon, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={18} color={accent} />
        </View>
        {hint ? (
          <View style={[s.statHint, { backgroundColor: bg }]}>
            <Text style={[s.statHintText, { color: accent }]} numberOfLines={1}>
              {hint}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

/** Uppercase label + grouped white card, as on the student Profile tab. */
export function GroupSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const s = useStaffStyles(baseStyles);

  return (
    <View style={s.group}>
      <Text style={s.groupLabel}>{title}</Text>
      <View style={s.groupCard}>{children}</View>
    </View>
  );
}

export function GroupRow({
  icon,
  label,
  subtitle,
  value,
  onPress,
  last,
  iconColor: iconColorProp,
  iconBg: iconBgProp,
  tone: toneName,
}: {
  icon: IconName;
  label: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
  iconColor?: string;
  iconBg?: string;
  tone?: IconToneName;
}) {
  const s = useStaffStyles(baseStyles);
  const tone = useStaffColor();
  const { theme } = useStaffAppearance();
  const auto = toneName
    ? ICON_TONES[toneName]
    : iconColorProp == null && iconBgProp == null
      ? toneForIcon(String(icon))
      : null;
  const iconColor = iconColorProp ?? auto?.fg ?? colors.textMuted;
  const tileBg = auto
    ? theme === "light"
      ? auto.bg
      : withAlpha(auto.fg, 0.22)
    : tone(iconBgProp ?? colors.surfaceAlt);

  return (
    <TouchableOpacity
      style={[s.groupRow, !last && s.groupRowBorder]}
      onPress={onPress}
      activeOpacity={onPress ? 0.65 : 1}
      disabled={!onPress}
    >
      <View style={s.groupRowLeft}>
        <View style={[s.groupRowIcon, { backgroundColor: tileBg }]}>
          <Ionicons name={auto ? solidIcon(icon) : icon} size={17} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.groupRowLabel}>{label}</Text>
          {subtitle ? (
            <Text style={s.groupRowSubtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={s.groupRowRight}>
        {value ? (
          <Text style={s.groupRowValue} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {onPress ? (
          <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

/** Outlined red sign-out button used at the bottom of the student Profile tab. */
export function SignOutButton({ onPress }: { onPress: () => void }) {
  const s = useStaffStyles(baseStyles);

  return (
    <TouchableOpacity style={s.logoutBtn} onPress={onPress}>
      <Ionicons name="log-out-outline" size={19} color={colors.error} />
      <Text style={s.logoutText}>Sign Out</Text>
    </TouchableOpacity>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const s = useStaffStyles(baseStyles);

  return (
    <View style={s.sectionRow}>
      <Text style={s.sectionTitle}>{title}</Text>
      {action && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          hitSlop={8}
          style={s.sectionActionRow}
        >
          <Text style={s.sectionAction}>{action}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function Card({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const s = useStaffStyles(baseStyles);

  if (onPress) {
    return (
      <TouchableOpacity
        style={[s.card, style]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[s.card, style]}>{children}</View>;
}

export function ListItem({
  icon,
  iconColor: iconColorProp,
  iconBg: iconBgProp,
  title,
  subtitle,
  meta,
  right,
  onPress,
  tone: toneName,
}: {
  icon: IconName;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  right?: ReactNode;
  onPress?: () => void;
  tone?: IconToneName;
}) {
  const s = useStaffStyles(baseStyles);
  const tone = useStaffColor();
  const { theme } = useStaffAppearance();
  const auto = toneName
    ? ICON_TONES[toneName]
    : iconColorProp == null && iconBgProp == null
      ? toneForIcon(String(icon))
      : null;
  const iconColor = iconColorProp ?? auto?.fg ?? colors.primary;
  const tileBg = auto
    ? theme === "light"
      ? auto.bg
      : withAlpha(auto.fg, 0.22)
    : tone(iconBgProp ?? colors.primaryLight);

  return (
    <Card onPress={onPress} style={s.listItem}>
      <View
        style={[
          s.listIcon,
          {
            backgroundColor: tileBg,
            borderWidth: 1,
            borderColor: withAlpha(iconColor, 0.16),
          },
        ]}
      >
        <Ionicons name={solidIcon(icon)} size={20} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.listTitle} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={s.listSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text style={s.listMeta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {right ??
        (onPress ? (
          <View style={s.listChevron}>
            <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
          </View>
        ) : null)}
    </Card>
  );
}

export function EmptyState({ icon, text }: { icon: IconName; text: string }) {
  const s = useStaffStyles(baseStyles);

  return (
    <View style={s.empty}>
      <View style={s.emptyHalo}>
        <View style={s.emptyIcon}>
          <Ionicons name={solidIcon(icon)} size={26} color={colors.primary} />
        </View>
      </View>
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

export function Loading() {
  const s = useStaffStyles(baseStyles);

  return (
    <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
  );
}

export function Badge({
  label,
  tone = "green",
}: {
  label: string;
  tone?: "green" | "red" | "amber" | "blue" | "grey";
}) {
  const s = useStaffStyles(baseStyles);

  const palette = {
    green: [colors.successSoft, colors.success],
    red: [colors.errorSoft, colors.error],
    amber: [colors.warningSoft, "#b45309"],
    blue: [colors.infoSoft, "#2563eb"],
    grey: [colors.surfaceAlt, colors.textMuted],
  }[tone];
  return (
    <View style={[s.badge, { backgroundColor: palette[0] }]}>
      <Text style={[s.badgeText, { color: palette[1] }]}>{label}</Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  icon,
  variant = "solid",
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  variant?: "solid" | "outline" | "danger";
}) {
  const s = useStaffStyles(baseStyles);

  const off = disabled || loading;
  const appearance = useStaffAppearance();
  const color =
    variant === "solid"
      ? colors.white
      : variant === "danger"
        ? colors.error
        : appearance.colors.burgundy;
  const content = loading ? (
    <ActivityIndicator color={color} />
  ) : (
    <>
      {icon ? <Ionicons name={icon} size={18} color={color} /> : null}
      <Text style={[s.buttonText, { color }]}>{label}</Text>
    </>
  );
  if (variant === "solid") {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={off}
        style={[s.buttonSolidWrap, off && { opacity: 0.5 }]}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.buttonSolid}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={off}
      style={[
        s.button,
        variant === "outline" && s.buttonOutline,
        variant === "danger" && s.buttonDanger,
        off && { opacity: 0.5 },
      ]}
      activeOpacity={0.85}
    >
      {content}
    </TouchableOpacity>
  );
}

export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
  maxLength,
  error,
  secureTextEntry,
}: {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "email-address" | "numeric";
  autoCapitalize?: "none" | "sentences";
  maxLength?: number;
  error?: string | null;
  secureTextEntry?: boolean;
}) {
  const s = useStaffStyles(baseStyles);

  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
      <TextInput
        style={[s.input, multiline && s.inputMultiline, !!error && { borderColor: FIELD_ERROR_COLOR }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        secureTextEntry={secureTextEntry}
        accessibilityLabel={label ?? placeholder}
        accessibilityHint={error ?? undefined}
        textAlignVertical={multiline ? "top" : "center"}
      />
      <FieldError message={error} />
    </View>
  );
}

export function ChipSelect<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T | null;
  onChange: (value: T) => void;
}) {
  const s = useStaffStyles(baseStyles);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.chips}
    >
      {options.map(option => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            style={[s.chip, active && s.chipActive]}
          >
            <Text
              style={[s.chipText, active && s.chipTextActive]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function firstName(name: string | null | undefined) {
  return name?.trim().split(/\s+/)[0] || "there";
}

export function greeting() {
  const hour = new Date().getHours();
  return hour < 12
    ? "Good morning"
    : hour < 17
      ? "Good afternoon"
      : "Good evening";
}

const baseStyles = StyleSheet.create({
  headerEyebrow: { ...design.eyebrow, color: colors.primary, marginBottom: 6 },
  heroOrbit: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    right: -110,
    top: -100,
  },
  heroOrbitSm: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    right: -30,
    top: -40,
  },
  heroGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(52,211,153,0.10)",
    left: -60,
    bottom: -100,
  },
  safe: { flex: 1, ...design.page },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  header: { flexDirection: "row", alignItems: "flex-start", marginBottom: 20 },
  title: { ...design.screenTitle },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    marginTop: 4,
  },
  avatarRing: {
    padding: 2.5,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: colors.primaryMuted,
    backgroundColor: colors.surface,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.white, fontWeight: "800", fontSize: 17 },
  hero: {
    marginBottom: 26,
    ...design.feature,
  },
  heroInner: {
    paddingLeft: 20,
    paddingRight: 8,
    paddingVertical: 20,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 168,
  },
  heroContent: { flex: 1, gap: 8, zIndex: 2 },
  heroEyebrow: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.accentSoft,
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  heroStatRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  heroStat: {
    fontSize: 40,
    fontWeight: "800",
    color: colors.white,
    lineHeight: 46,
    letterSpacing: -1.2,
    fontVariant: ["tabular-nums"],
  },
  heroStatUnit: {
    fontSize: 14,
    color: "rgba(255,255,255,0.78)",
    fontWeight: "600",
  },
  heroTitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 23,
    letterSpacing: -0.3,
  },
  heroBarBg: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 3,
    overflow: "hidden",
  },
  heroBarFill: {
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  heroFooter: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroBody: {
    flex: 1,
    fontSize: 12.5,
    color: "rgba(255,255,255,0.74)",
    lineHeight: 18,
  },
  heroGo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBot: {
    width: 96,
    height: 128,
    marginLeft: 4,
    marginRight: -6,
    marginBottom: -24,
    alignSelf: "flex-end",
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 28,
  },
  statTile: {
    width: "47%",
    flexGrow: 1,
    padding: 16,
    gap: 4,
    ...design.card,
  },
  statAccent: {
    position: "absolute",
    top: 0,
    left: 18,
    width: 28,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  statTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statHint: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 1,
  },
  statHintText: { fontSize: 11, fontWeight: "700" },
  statValue: { ...design.metric },
  statLabel: { fontWeight: "500", ...design.caption },
  group: { marginBottom: 16 },
  groupLabel: { marginBottom: 8, paddingLeft: 4, ...design.eyebrow },
  groupCard: { overflow: "hidden", ...design.card },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  groupRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  groupRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  groupRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  groupRowLabel: { ...design.cardTitle, fontWeight: "600" },
  groupRowSubtitle: { marginTop: 2, ...design.caption },
  groupRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
    marginLeft: 12,
  },
  groupRowValue: { fontSize: 13, color: colors.textMuted, flexShrink: 1 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.errorSoft,
    borderRadius: 16,
    paddingVertical: 15,
    marginTop: 4,
  },
  logoutText: { fontSize: 15, fontWeight: "700", color: colors.error },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: { ...design.sectionTitle },
  sectionActionRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  sectionAction: { fontSize: 13, fontWeight: "700", color: colors.primary },
  card: { padding: 16, marginBottom: 12, ...design.card },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
  },
  listIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  listChevron: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  listTitle: { ...design.cardTitle },
  listSubtitle: { marginTop: 3, ...design.caption, fontSize: 13 },
  listMeta: { marginTop: 4, ...design.caption },
  empty: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 12,
    marginBottom: 12,
    ...design.card,
  },
  emptyHalo: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { textAlign: "center", paddingHorizontal: 24, ...design.body },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
  button: {
    paddingVertical: 12,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    ...design.action,
  },
  buttonSolidWrap: { borderRadius: 14, ...elevation.brand },
  buttonSolid: {
    minHeight: 52,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonOutline: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.burgundyBorder,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonDanger: {
    backgroundColor: colors.errorSoft,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: { flexShrink: 1, textAlign: "center", ...design.actionText },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSub,
    marginBottom: 6,
  },
  input: { ...design.input },
  inputMultiline: { minHeight: 110 },
  chips: { gap: 8, paddingBottom: 12 },
  chip: { maxWidth: 220, ...design.chip },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.textSub },
  chipTextActive: { color: colors.white },
});
