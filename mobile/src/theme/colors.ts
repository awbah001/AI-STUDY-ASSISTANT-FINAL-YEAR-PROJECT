/**
 * App light theme.
 * One emerald brand scale, cool neutral surfaces, restrained burgundy accent.
 */
export const colors = {
  burgundy: "#800020",
  burgundySoft: "#f8edf0",
  burgundyBorder: "#ecc9d2",
  neutralGray: "#6b7280",
  neutralGraySoft: "#f3f4f6",
  // Backgrounds
  bg: "#f5f7f6",           // app canvas
  bgCard: "#ffffff",
  bgElevated: "#ffffff",
  bgInput: "#f3f6f5",

  // Brand — emerald
  primary: "#0a6e52",      // CTAs, active states, links
  primaryDark: "#053b30",  // feature surfaces, pressed state
  primaryDeep: "#0c5a45",  // gradient mid-stop
  primaryLight: "#e8f4ee", // subtle tint
  primaryMuted: "#c7e6d6", // selected / progress track
  accent: "#34d399",       // bright highlight for progress on dark surfaces
  accentSoft: "#a7f3d0",

  // Surface / cards
  surface: "#ffffff",
  surfaceAlt: "#f6f9f7",

  // Text
  text: "#0f1d18",
  textSub: "#35433e",
  textMuted: "#6b7280",
  textLight: "#9aa8a2",
  textPlaceholder: "#9aa8a2",

  // Borders / dividers
  border: "#dfe7e3",
  borderLight: "#ebf0ee",

  // Status colours
  error: "#e5484d",
  errorSoft: "#fdecec",
  warning: "#f59e0b",
  warningSoft: "#fff6e5",
  info: "#3b82f6",
  infoSoft: "#eaf2ff",
  success: "#16805d",
  successSoft: "#e6f6ef",
  // Secondary accent slot, rendered in burgundy.
  violet: "#800020",
  violetSoft: "#f8edf0",

  // Chart
  chartBar: "#0a6e52",
  chartBarDim: "#c7e6d6",

  // Misc
  white: "#ffffff",
  black: "#000000",
  overlay: "rgba(8,20,16,0.45)",

  // Tab bar
  tabBg: "#ffffff",
  tabActive: "#0a6e52",
  tabInactive: "#9aa8a2",
} as const;

/** Gradient stops for hero / feature surfaces. */
export const gradients = {
  hero: ["#0e7c5d", "#085a45", "#053b30"] as const,
  heroSoft: ["#e9f6ef", "#f5faf7"] as const,
  violet: ["#9b1b3d", "#800020"] as const,
  sunrise: ["#f59e0b", "#ea580c"] as const,
};
