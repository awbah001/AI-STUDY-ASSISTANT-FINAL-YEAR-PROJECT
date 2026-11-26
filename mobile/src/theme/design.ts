import type { TextStyle, ViewStyle } from "react-native";
import { colors } from "./colors";

/** Soft, tinted elevation used by cards and floating controls. */
export const elevation = {
  sm: {
    shadowColor: "#0b2a20",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  } satisfies ViewStyle,
  md: {
    shadowColor: "#0b2a20",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 3,
  } satisfies ViewStyle,
  brand: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  } satisfies ViewStyle,
};

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const layout = { contentMaxWidth: 760, phoneGutter: 20, wideGutter: 32, touchTarget: 48 } as const;

/** Shared visual language for learning, teaching, and administration. */
export const design = {
  page: { backgroundColor: colors.bg } satisfies ViewStyle,
  screenTitle: {
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "800",
    letterSpacing: -0.9,
    color: colors.text,
  } satisfies TextStyle,
  sectionTitle: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "700",
    letterSpacing: -0.35,
    color: colors.text,
  } satisfies TextStyle,
  cardTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
    letterSpacing: -0.2,
    color: colors.text,
  } satisfies TextStyle,
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSub,
  } satisfies TextStyle,
  caption: {
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textMuted,
  } satisfies TextStyle,
  eyebrow: {
    fontSize: 10.5,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.textMuted,
  } satisfies TextStyle,
  card: {
    backgroundColor: colors.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: "#0b2f2c",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.09,
    shadowRadius: 15,
    elevation: 2,
  } satisfies ViewStyle,
  feature: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.xl,
    overflow: "hidden",
    ...elevation.md,
  } satisfies ViewStyle,
  input: {
    minHeight: 52,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 15,
    color: colors.text,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 2,
  } satisfies TextStyle,
  form: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: colors.surface,
    padding: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 3,
  } satisfies ViewStyle,
  search: {
    minHeight: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    ...elevation.sm,
  } satisfies ViewStyle,
  chip: {
    minHeight: 38,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
  } satisfies ViewStyle,
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
    ...elevation.sm,
  } satisfies ViewStyle,
  action: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...elevation.brand,
  } satisfies ViewStyle,
  actionText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
    color: colors.white,
    letterSpacing: 0.1,
  } satisfies TextStyle,
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl + 4,
    borderTopRightRadius: radius.xl + 4,
  } satisfies ViewStyle,
  metric: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: -1,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  } satisfies TextStyle,
};
